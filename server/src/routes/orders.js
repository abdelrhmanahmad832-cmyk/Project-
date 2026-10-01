import { Router } from 'express';
import { pool, all, one, HttpError } from '../db.js';
import { config } from '../config.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { priceCart, createOrder, cancelOrderInDb, getOrder, withItems } from '../services/orders.js';
import {
  cardPaymentsEnabled,
  createCheckoutSession,
  syncCheckoutSession,
  refundOrder,
  getStripe,
} from '../services/payments.js';

const router = Router();
const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const baseUrl = (req) => config.publicUrl || req.get('origin') || `${req.protocol}://${req.get('host')}`;

async function ownOrder(req) {
  const order = await getOrder(req.params.id);
  if (!order || (order.user_id !== req.user.id && req.user.role !== 'admin')) throw new HttpError(404, 'الطلب غير موجود');
  return order;
}

// Price preview for the checkout page (same logic the order uses).
router.post('/quote', requireAuth, async (req, res) => {
  const { subtotal, discount, shipping, total, coupon, couponError } = await priceCart(req.body?.items, req.body?.couponCode, {
    strictCoupon: false,
  });
  res.json({ subtotal, discount, shipping, total, couponCode: coupon?.code ?? null, couponError });
});

router.post('/', requireAuth, async (req, res) => {
  const paymentMethod = req.body?.paymentMethod === 'card' ? 'card' : 'cod';
  if (paymentMethod === 'card' && !cardPaymentsEnabled()) {
    throw new HttpError(400, 'الدفع الإلكتروني غير مفعّل حالياً');
  }
  const orderId = await createOrder(req.user.id, { ...req.body, paymentMethod });
  let checkoutUrl = null;
  if (paymentMethod === 'card') {
    try {
      checkoutUrl = await createCheckoutSession(await getOrder(orderId), baseUrl(req), req.user.email);
    } catch (err) {
      console.error('Stripe checkout error:', err.message);
      await cancelOrderInDb(orderId);
      throw new HttpError(502, 'تعذر بدء عملية الدفع، حاول مرة أخرى أو اختر الدفع عند الاستلام');
    }
  }
  res.status(201).json({ order: await getOrder(orderId), checkoutUrl });
});

router.get('/mine', requireAuth, async (req, res) => {
  res.json(await withItems(await all('SELECT * FROM orders WHERE user_id = $1 ORDER BY id DESC', [req.user.id])));
});

router.get('/stats', requireAdmin, async (_req, res) => {
  res.json(
    await one(
      `SELECT
         (SELECT COUNT(*) FROM orders) AS orders,
         (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS pending,
         (SELECT COALESCE(SUM(total), 0) FROM orders
            WHERE status != 'cancelled' AND (payment_method = 'cod' OR payment_status = 'paid')) AS revenue,
         (SELECT COUNT(*) FROM products) AS products,
         (SELECT COUNT(*) FROM products WHERE stock <= 3) AS low_stock,
         (SELECT COUNT(*) FROM users WHERE role = 'customer') AS customers`
    )
  );
});

router.get('/', requireAdmin, async (req, res) => {
  const { status } = req.query;
  const filter = STATUSES.includes(status);
  const orders = await all(
    `SELECT o.*, u.name AS customer_name, u.email AS customer_email
     FROM orders o JOIN users u ON u.id = o.user_id ${filter ? 'WHERE o.status = $1' : ''} ORDER BY o.id DESC LIMIT 200`,
    filter ? [status] : []
  );
  res.json(await withItems(orders));
});

router.get('/:id', requireAuth, async (req, res) => {
  res.json(await ownOrder(req));
});

// Confirms payment after the customer returns from Stripe (the webhook does the same in the background).
router.post('/:id/verify-payment', requireAuth, async (req, res) => {
  const order = await ownOrder(req);
  if (order.payment_method !== 'card' || !order.stripe_session_id || !getStripe()) return res.json(order);
  res.json((await syncCheckoutSession(order.stripe_session_id)) ?? order);
});

// Starts a fresh Stripe session for an unpaid card order (e.g. after the customer backed out).
router.post('/:id/pay', requireAuth, async (req, res) => {
  const order = await ownOrder(req);
  if (order.payment_method !== 'card' || !cardPaymentsEnabled()) throw new HttpError(400, 'هذا الطلب ليس للدفع الإلكتروني');
  if (order.status === 'cancelled') throw new HttpError(400, 'تم إلغاء هذا الطلب');
  if (order.payment_status !== 'unpaid') throw new HttpError(400, 'تم دفع هذا الطلب بالفعل');
  // checkoutUrl is null if the previous session turned out to be paid already.
  const checkoutUrl = await createCheckoutSession(order, baseUrl(req), req.user.email);
  res.json({ order: await getOrder(order.id), checkoutUrl });
});

async function cancelWithRefund(order) {
  if (order.status === 'cancelled') return;
  if (order.payment_method === 'card' && order.stripe_session_id && order.payment_status === 'unpaid' && getStripe()) {
    // Close the open Stripe session first; if it turns out it was already paid, handle it as paid.
    order = (await syncCheckoutSession(order.stripe_session_id)) ?? order;
    if (order.status === 'cancelled') return;
    if (order.payment_status === 'unpaid') {
      try {
        await getStripe().checkout.sessions.expire(order.stripe_session_id);
      } catch {
        order = (await syncCheckoutSession(order.stripe_session_id)) ?? order;
      }
    }
  }
  if (order.payment_status === 'paid') {
    await refundOrder(order);
    await cancelOrderInDb(order.id, { refunded: true });
  } else {
    await cancelOrderInDb(order.id);
  }
}

router.post('/:id/cancel', requireAuth, async (req, res) => {
  const order = await ownOrder(req);
  if (order.status !== 'pending') throw new HttpError(400, 'لا يمكن إلغاء الطلب بعد بدء تجهيزه، تواصل معنا');
  await cancelWithRefund(order);
  res.json(await getOrder(order.id));
});

router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body ?? {};
  if (!STATUSES.includes(status)) throw new HttpError(400, 'حالة غير صالحة');
  const order = await getOrder(req.params.id);
  if (!order) throw new HttpError(404, 'الطلب غير موجود');
  if (order.status === 'cancelled' && status !== 'cancelled') throw new HttpError(400, 'لا يمكن إعادة تفعيل طلب ملغي');
  if (status === 'cancelled') {
    await cancelWithRefund(order);
  } else if (status === 'delivered' && order.payment_method === 'cod') {
    // Cash on delivery: delivered means collected.
    await pool.query(
      "UPDATE orders SET status = $1, payment_status = 'paid', paid_at = COALESCE(paid_at, now()) WHERE id = $2",
      [status, order.id]
    );
  } else {
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, order.id]);
  }
  res.json(await getOrder(order.id));
});

export default router;
