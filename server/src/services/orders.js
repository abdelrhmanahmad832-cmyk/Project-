import { pool, all, one, transaction, HttpError } from '../db.js';
import { round2, shippingFor } from '../config.js';
import { evaluateCoupon } from './coupons.js';

export async function withItems(orders, db = pool) {
  if (!orders.length) return [];
  const items = await all('SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY id', [orders.map((o) => o.id)], db);
  return orders.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) }));
}

export async function getOrder(id, db = pool) {
  if (!Number.isInteger(Number(id))) return null;
  const order = await one('SELECT * FROM orders WHERE id = $1', [id], db);
  return order ? (await withItems([order], db))[0] : null;
}

// Validates cart lines against current stock/prices and computes all totals.
// With `strictCoupon` a bad coupon throws; otherwise it is reported in `couponError`.
// Inside a transaction (`lock`), product rows are locked so concurrent orders can't oversell.
export async function priceCart(items, couponCode, { strictCoupon = true, db = pool, lock = false } = {}) {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'السلة فارغة');
  const merged = new Map();
  for (const { productId, quantity } of items) {
    const qty = Number(quantity);
    const id = Number(productId);
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) throw new HttpError(400, 'كمية غير صالحة');
    if (!Number.isInteger(id)) throw new HttpError(400, 'أحد المنتجات لم يعد متاحاً');
    merged.set(id, (merged.get(id) || 0) + qty);
  }
  const products = await all(
    `SELECT * FROM products WHERE id = ANY($1) ORDER BY id ${lock ? 'FOR UPDATE' : ''}`,
    [[...merged.keys()]],
    db
  );
  const lines = [...merged].map(([id, qty]) => {
    const product = products.find((p) => p.id === id);
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
      ({ coupon, discount } = await evaluateCoupon(couponCode, subtotal, db));
    } catch (err) {
      if (strictCoupon || !(err instanceof HttpError)) throw err;
      couponError = err.message;
    }
  }
  const shipping = shippingFor(subtotal - discount);
  const total = round2(subtotal - discount + shipping);
  return { lines, subtotal, discount, shipping, total, coupon, couponError };
}

export async function createOrder(userId, { items, address, phone, couponCode, paymentMethod }) {
  if (!address?.trim() || !phone?.trim()) throw new HttpError(400, 'العنوان ورقم الهاتف مطلوبان');
  return transaction(async (db) => {
    const { lines, subtotal, discount, shipping, total, coupon } = await priceCart(items, couponCode, { db, lock: true });
    if (coupon) {
      // Re-check the usage limit atomically so two orders can't both take the last use.
      const used = await one(
        'UPDATE coupons SET used_count = used_count + 1 WHERE id = $1 AND (max_uses IS NULL OR used_count < max_uses) RETURNING id',
        [coupon.id],
        db
      );
      if (!used) throw new HttpError(400, 'تم استهلاك كود الخصم بالكامل');
    }
    const { id: orderId } = await one(
      `INSERT INTO orders (user_id, subtotal, discount, shipping, total, coupon_code, payment_method, address, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [userId, subtotal, discount, shipping, total, coupon?.code ?? null, paymentMethod, address.trim(), phone.trim()],
      db
    );
    for (const { product, qty } of lines) {
      await db.query(
        'INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES ($1, $2, $3, $4, $5)',
        [orderId, product.id, product.name, product.price, qty]
      );
      await db.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [qty, product.id]);
    }
    return orderId;
  });
}

// Cancels an order and returns its stock and coupon use. Idempotent.
export async function cancelOrderInDb(orderId, { refunded = false } = {}) {
  await transaction(async (db) => {
    const order = await one('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId], db);
    if (!order) throw new HttpError(404, 'الطلب غير موجود');
    if (order.status === 'cancelled') return;
    await db.query(
      `UPDATE products p SET stock = p.stock + i.quantity
       FROM order_items i WHERE i.order_id = $1 AND i.product_id = p.id`,
      [orderId]
    );
    if (order.coupon_code) {
      await db.query('UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE code = $1', [order.coupon_code]);
    }
    await db.query(
      `UPDATE orders SET status = 'cancelled',
         payment_status = CASE WHEN $2 THEN 'refunded' ELSE payment_status END
       WHERE id = $1`,
      [orderId, refunded]
    );
  });
}
