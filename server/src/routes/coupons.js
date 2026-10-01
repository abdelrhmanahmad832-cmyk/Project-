import { Router } from 'express';
import { pool, all, one, HttpError } from '../db.js';
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
  if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) throw new HttpError(400, 'تاريخ الانتهاء غير صالح');
  return [code, type, value, minTotal, maxUses, expiresAt, body.active !== false];
}

const isId = (v) => /^\d{1,9}$/.test(String(v));

router.get('/', async (_req, res) => {
  res.json(await all('SELECT * FROM coupons ORDER BY id DESC'));
});

router.post('/', async (req, res) => {
  const coupon = await one(
    `INSERT INTO coupons (code, type, value, min_total, max_uses, expires_at, active) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (code) DO NOTHING RETURNING *`,
    parseCoupon(req.body ?? {})
  );
  if (!coupon) throw new HttpError(409, 'هذا الكود موجود بالفعل');
  res.status(201).json(coupon);
});

router.patch('/:id', async (req, res) => {
  if (typeof req.body?.active !== 'boolean') throw new HttpError(400, 'قيمة غير صالحة');
  const coupon = isId(req.params.id) && (await one('UPDATE coupons SET active = $1 WHERE id = $2 RETURNING *', [req.body.active, req.params.id]));
  if (!coupon) throw new HttpError(404, 'الكود غير موجود');
  res.json(coupon);
});

router.delete('/:id', async (req, res) => {
  const result = isId(req.params.id) && (await pool.query('DELETE FROM coupons WHERE id = $1', [req.params.id]));
  if (!result?.rowCount) throw new HttpError(404, 'الكود غير موجود');
  res.status(204).end();
});

export default router;
