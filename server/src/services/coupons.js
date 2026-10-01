import { db, HttpError } from '../db.js';
import { round2 } from '../config.js';

export function findCoupon(code) {
  return db.prepare('SELECT * FROM coupons WHERE code = ?').get(String(code).trim());
}

// Returns the discount a coupon gives on `subtotal`, or throws an HttpError explaining why it can't be used.
export function evaluateCoupon(code, subtotal) {
  const coupon = findCoupon(code);
  if (!coupon || !coupon.active) throw new HttpError(400, 'كود الخصم غير صالح');
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) throw new HttpError(400, 'كود الخصم منتهي الصلاحية');
  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) throw new HttpError(400, 'تم استهلاك كود الخصم بالكامل');
  if (subtotal < coupon.min_total) throw new HttpError(400, `كود الخصم يتطلب حداً أدنى للطلب ${coupon.min_total}`);
  const raw = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
  return { coupon, discount: round2(Math.min(raw, subtotal)) };
}
