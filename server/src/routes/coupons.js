import { Router } from 'express';
import { db, HttpError } from '../db.js';
import { requireAdmin } from '../auth.js';

const router = Router();
router.use(requireAdmin);

function parseCoupon(body) {
  const code = String(body.code ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new HttpError(400, 'الكود يجب أن يكون 3-30 حرفاً إنجليزياً أو رقماً');
  const type = body.type === 'fixed' ? 'fixed' : 'percent';
  const value = Number(body.value);
  if (!Number.isFinite(value) || value <= 0 || (type === 'percent' && value > 100)) throw new HttpError(400, 'قيمة الخصم غير صالحة');
  const minTotal = Number(body.min_total || 0);
  if (!Number.isFinite(minTotal) || minTotal < 0) throw new HttpError(400, 'الحد الأدنى غير صالح');
  const maxUses = body.max_uses === '' || body.max_uses == null ? null : Number(body.max_uses);
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) throw new HttpError(400, 'عدد الاستخدامات غير صالح');
  const expiresAt = body.expires_at ? String(body.expires_at) : null;
  if (expiresAt && Number.isNaN(Date.parse(expiresAt))) throw new HttpError(400, 'تاريخ الانتهاء غير صالح');
  return { code, type, value, min_total: minTotal, max_uses: maxUses, expires_at: expiresAt, active: body.active === false ? 0 : 1 };
}

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM coupons ORDER BY id DESC').all());
});

router.post('/', (req, res) => {
  const c = parseCoupon(req.body ?? {});
  if (db.prepare('SELECT id FROM coupons WHERE code = ?').get(c.code)) throw new HttpError(409, 'هذا الكود موجود بالفعل');
  const { lastInsertRowid } = db
    .prepare('INSERT INTO coupons (code, type, value, min_total, max_uses, expires_at, active) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(c.code, c.type, c.value, c.min_total, c.max_uses, c.expires_at, c.active);
  res.status(201).json(db.prepare('SELECT * FROM coupons WHERE id = ?').get(lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const coupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(req.params.id);
  if (!coupon) throw new HttpError(404, 'الكود غير موجود');
  if (typeof req.body?.active !== 'boolean') throw new HttpError(400, 'قيمة غير صالحة');
  db.prepare('UPDATE coupons SET active = ? WHERE id = ?').run(req.body.active ? 1 : 0, coupon.id);
  res.json(db.prepare('SELECT * FROM coupons WHERE id = ?').get(coupon.id));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
  if (!result.changes) throw new HttpError(404, 'الكود غير موجود');
  res.status(204).end();
});

export default router;
