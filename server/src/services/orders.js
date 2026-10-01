import { db, transaction, HttpError } from '../db.js';
import { round2, shippingFor } from '../config.js';
import { evaluateCoupon } from './coupons.js';

export function withItems(orders) {
  const stmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  return orders.map((o) => ({ ...o, items: stmt.all(o.id) }));
}

export function getOrder(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  return order ? withItems([order])[0] : null;
}

// Validates cart lines against current stock/prices and computes all totals.
// With `strictCoupon` a bad coupon throws; otherwise it is reported in `couponError`.
export function priceCart(items, couponCode, { strictCoupon = true } = {}) {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'السلة فارغة');
  const merged = new Map();
  for (const { productId, quantity } of items) {
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) throw new HttpError(400, 'كمية غير صالحة');
    const id = Number(productId);
    merged.set(id, (merged.get(id) || 0) + qty);
  }
  const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
  const lines = [...merged].map(([id, qty]) => {
    const product = getProduct.get(id);
    if (!product) throw new HttpError(400, 'أحد المنتجات لم يعد متاحاً');
    if (product.stock < qty) throw new HttpError(400, `الكمية المتاحة من "${product.name}" هي ${product.stock} فقط`);
    return { product, qty };
  });

  const subtotal = round2(lines.reduce((s, l) => s + l.product.price * l.qty, 0));
  let discount = 0;
  let coupon = null;
  let couponError = null;
  if (couponCode && String(couponCode).trim()) {
    try {
      ({ coupon, discount } = evaluateCoupon(couponCode, subtotal));
    } catch (err) {
      if (strictCoupon || !(err instanceof HttpError)) throw err;
      couponError = err.message;
    }
  }
  const shipping = shippingFor(subtotal - discount);
  const total = round2(subtotal - discount + shipping);
  return { lines, subtotal, discount, shipping, total, coupon, couponError };
}

export function createOrder(userId, { items, address, phone, couponCode, paymentMethod }) {
  if (!address?.trim() || !phone?.trim()) throw new HttpError(400, 'العنوان ورقم الهاتف مطلوبان');
  return transaction(() => {
    const { lines, subtotal, discount, shipping, total, coupon } = priceCart(items, couponCode);
    const { lastInsertRowid: orderId } = db
      .prepare(
        `INSERT INTO orders (user_id, subtotal, discount, shipping, total, coupon_code, payment_method, address, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(userId, subtotal, discount, shipping, total, coupon?.code ?? null, paymentMethod, address.trim(), phone.trim());
    const insertItem = db.prepare(
      'INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES (?, ?, ?, ?, ?)'
    );
    const decStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    for (const { product, qty } of lines) {
      insertItem.run(orderId, product.id, product.name, product.price, qty);
      decStock.run(qty, product.id);
    }
    if (coupon) db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(coupon.id);
    return orderId;
  });
}

// Cancels an order and returns its stock and coupon use. Idempotent.
export function cancelOrderInDb(orderId, { refunded = false } = {}) {
  transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new HttpError(404, 'الطلب غير موجود');
    if (order.status === 'cancelled') return;
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? AND product_id IS NOT NULL').all(orderId);
    const restock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
    for (const item of items) restock.run(item.quantity, item.product_id);
    if (order.coupon_code) {
      db.prepare('UPDATE coupons SET used_count = MAX(used_count - 1, 0) WHERE code = ?').run(order.coupon_code);
    }
    db.prepare(
      `UPDATE orders SET status = 'cancelled', payment_status = CASE WHEN ? THEN 'refunded' ELSE payment_status END WHERE id = ?`
    ).run(refunded ? 1 : 0, orderId);
  });
}
