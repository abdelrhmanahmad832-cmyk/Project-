import { Router } from 'express';
import { db, transaction } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

const router = Router();
const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

function withItems(orders) {
  const stmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  return orders.map((o) => ({ ...o, items: stmt.all(o.id) }));
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

router.post('/', requireAuth, (req, res) => {
  const { items, address, phone } = req.body ?? {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'السلة فارغة' });
  if (!address?.trim() || !phone?.trim()) return res.status(400).json({ error: 'العنوان ورقم الهاتف مطلوبان' });

  try {
    const orderId = transaction(() => {
      const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
      const lines = items.map(({ productId, quantity }) => {
        const qty = Number(quantity);
        if (!Number.isInteger(qty) || qty < 1) throw new HttpError(400, 'كمية غير صالحة');
        const product = getProduct.get(productId);
        if (!product) throw new HttpError(400, 'أحد المنتجات لم يعد متاحاً');
        if (product.stock < qty) throw new HttpError(400, `الكمية المتاحة من "${product.name}" هي ${product.stock} فقط`);
        return { product, qty };
      });
      const total = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
      const { lastInsertRowid } = db
        .prepare('INSERT INTO orders (user_id, total, address, phone) VALUES (?, ?, ?, ?)')
        .run(req.user.id, Math.round(total * 100) / 100, address.trim(), phone.trim());
      const insertItem = db.prepare(
        'INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES (?, ?, ?, ?, ?)'
      );
      const decStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
      for (const { product, qty } of lines) {
        insertItem.run(lastInsertRowid, product.id, product.name, product.price, qty);
        decStock.run(qty, product.id);
      }
      return lastInsertRowid;
    });
    const [order] = withItems([db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)]);
    res.status(201).json(order);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

router.get('/mine', requireAuth, (req, res) => {
  res.json(withItems(db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id)));
});

router.get('/', requireAdmin, (_req, res) => {
  const orders = db
    .prepare(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC`
    )
    .all();
  res.json(withItems(orders));
});

router.patch('/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body ?? {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'حالة غير صالحة' });
  try {
    transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!order) throw new HttpError(404, 'الطلب غير موجود');
      // Return stock to inventory when an order is cancelled (and take it again if un-cancelled).
      if (status !== order.status && (status === 'cancelled' || order.status === 'cancelled')) {
        const sign = status === 'cancelled' ? 1 : -1;
        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? AND product_id IS NOT NULL').all(order.id);
        const update = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
        for (const item of items) update.run(sign * item.quantity, item.product_id);
      }
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);
    });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (String(err.message).includes('CHECK constraint')) {
      return res.status(400).json({ error: 'لا يوجد مخزون كافٍ لإعادة تفعيل الطلب' });
    }
    throw err;
  }
  res.json(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
});

router.get('/stats', requireAdmin, (_req, res) => {
  const row = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM orders) AS orders,
         (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status != 'cancelled') AS revenue,
         (SELECT COUNT(*) FROM products) AS products,
         (SELECT COUNT(*) FROM users WHERE role = 'customer') AS customers`
    )
    .get();
  res.json(row);
});

export default router;
