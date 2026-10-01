import { Router } from 'express';
import { db, HttpError } from '../db.js';
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

function ownOrder(req) {
  const order = getOrder(req.params.id);
  if (!order || (order.user_id !== req.user.id && req.user.role !== 'admin')) throw new HttpError(404, 'الطلب غير موجود');
  return order;
}

// Price preview for the checkout page (same logic the order uses).
router.post('/quote', requireAuth, (req, res) => {
  const { subtotal, discount, shipping, total, coupon, couponError } = priceCart(req.body?.items, req.body?.couponCode, {
    strictCoupon: false,
  });
  res.json({ subtotal, discount, shipping, total, couponCode: coupon?.code ?? null, couponError });
});

router.post('/', requireAuth, async (req, res) => {
  const paymentMethod = req.body?.paymentMethod === 'card' ? 'card' : 'cod';
  if (paymentMethod === 'card' && !cardPaymentsEnabled()) {
    throw new HttpError(400, 'الدفع الإلكتروني غير مفعّل حالياً');
  }
  const orderId = createOrder(req.user.id, { ...req.body, paymentMethod });
  const order = getOrder(orderId);
  let checkoutUrl = null;
  if (paymentMethod === 'card') {
    try {
      checkoutUrl = await createCheckoutSession(order, baseUrl(req), req.user.email);
    } catch (err) {
      console.error('Stripe checkout error:', err.message);
      cancelOrderInDb(orderId);
      throw new HttpError(502, 'تعذر بدء عملية الدفع، حاول مرة أخرى أو اختر الدفع عند الاستلام');
    }
  }
  res.status(201).json({ order: getOrder(orderId), checkoutUrl });
});

router.get('/mine', requireAuth, (req, res) => {
  res.json(withItems(db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id)));
});

router.get('/stats', requireAdmin, (_req, res) => {
  const row = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM orders) AS orders,
         (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS pending,
         (SELECT COALESCE(SUM(total), 0) FROM orders
            WHERE status != 'cancelled' AND (payment_method = 'cod' OR payment_status = 'paid')) AS revenue,
         (SELECT COUNT(*) FROM products) AS products,
         (SELECT COUNT(*) FROM products WHERE stock <= 3) AS low_stock,
         (SELECT COUNT(*) FROM users WHERE role = 'customer') AS customers`
    )
    .get();
  res.json(row);
});

router.get('/', requireAdmin, (req, res) => {
  const { status } = req.query;
  const filter = STATUSES.includes(status) ? 'WHERE o.status = ?' : '';
  const orders = db
    .prepare(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id = o.user_id ${filter} ORDER BY o.id DESC LIMIT 200`
    )
    .all(...(filter ? [status] : []));
  res.json(withItems(orders));
});

router.get('/:id', requireAuth, (req, res) => {
  res.json(ownOrder(req));
});

// Confirms payment after the customer returns from Stripe (the webhook does the same in the background).
router.post('/:id/verify-payment', requireAuth, async (req, res) => {
  const order = ownOrder(req);
  if (order.payment_method !== 'card' || !order.stripe_session_id || !getStripe()) return res.json(order);
  res.json((await syncCheckoutSession(order.stripe_session_id)) ?? order);
});

// Starts a fresh Stripe session for an unpaid card order (e.g. after the customer backed out).
router.post('/:id/pay', requireAuth, async (req, res) => {
  const order = ownOrder(req);
  if (order.payment_method !== 'card' || !cardPaymentsEnabled()) throw new HttpError(400, 'هذا الطلب ليس للدفع الإلكتروني');
  if (order.status === 'cancelled') throw new HttpError(400, 'تم إلغاء هذا الطلب');
  if (order.payment_status !== 'unpaid') throw new HttpError(400, 'تم دفع هذا الطلب بالفعل');
  // checkoutUrl is null if the previous session turned out to be paid already.
  const checkoutUrl = await createCheckoutSession(order, baseUrl(req), req.user.email);
  res.json({ order: getOrder(order.id), checkoutUrl });
});

async function cancelWithRefund(order) {
  if (order.status === 'cancelled') return;
  if (order.payment_method === 'card' && order.stripe_session_id && order.payment_status === 'unpaid' && getStripe()) {
    // Close the open Stripe session first; if it turns out it was already paid, handle it as paid.
    const synced = await syncCheckoutSession(order.stripe_session_id);
    if (synced) order = synced;
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
    cancelOrderInDb(order.id, { refunded: true });
  } else {
    cancelOrderInDb(order.id);
  }
}

router.post('/:id/cancel', requireAuth, async (req, res) => {
  const order = ownOrder(req);
  if (order.status !== 'pending') {
    throw new HttpError(400, 'لا يمكن إلغاء الطلب بعد بدء تجهيزه، تواصل معنا');
  }
  await cancelWithRefund(order);
  res.json(getOrder(order.id));
});

router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body ?? {};
  if (!STATUSES.includes(status)) throw new HttpError(400, 'حالة غير صالحة');
  const order = getOrder(req.params.id);
  if (!order) throw new HttpError(404, 'الطلب غير موجود');
  if (order.status === 'cancelled' && status !== 'cancelled') throw new HttpError(400, 'لا يمكن إعادة تفعيل طلب ملغي');
  if (status === 'cancelled') {
    await cancelWithRefund(order);
  } else {
    if (status === 'delivered' && order.payment_method === 'cod') {
      // Cash on delivery: delivered means collected.
      db.prepare(
        "UPDATE orders SET status = ?, payment_status = 'paid', paid_at = COALESCE(paid_at, datetime('now')) WHERE id = ?"
      ).run(status, order.id);
    } else {
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);
    }
  }
  res.json(getOrder(order.id));
});

export default router;
