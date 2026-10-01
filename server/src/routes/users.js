import { Router } from 'express';
import { pool, all, HttpError } from '../db.js';
import { requireAdmin } from '../auth.js';

const router = Router();
router.use(requireAdmin);

router.get('/', async (_req, res) => {
  res.json(
    await all(
      `SELECT u.id, u.name, u.email, u.role, u.phone, u.created_at,
         COUNT(o.id) AS orders_count,
         COALESCE(SUM(o.total) FILTER (WHERE o.status != 'cancelled'), 0) AS total_spent
       FROM users u LEFT JOIN orders o ON o.user_id = u.id
       GROUP BY u.id ORDER BY u.id DESC`
    )
  );
});

router.patch('/:id/role', async (req, res) => {
  const { role } = req.body ?? {};
  if (!['customer', 'admin'].includes(role)) throw new HttpError(400, 'صلاحية غير صالحة');
  if (!/^\d{1,9}$/.test(req.params.id)) throw new HttpError(404, 'المستخدم غير موجود');
  if (Number(req.params.id) === req.user.id) throw new HttpError(400, 'لا يمكنك تغيير صلاحيتك بنفسك');
  const result = await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
  if (!result.rowCount) throw new HttpError(404, 'المستخدم غير موجود');
  res.json({ ok: true });
});

export default router;
