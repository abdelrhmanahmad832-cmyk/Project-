import { Router } from 'express';
import { db, HttpError } from '../db.js';
import { requireAdmin } from '../auth.js';

const router = Router();
router.use(requireAdmin);

router.get('/', (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT u.id, u.name, u.email, u.role, u.phone, u.created_at,
           COUNT(o.id) AS orders_count,
           COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total END), 0) AS total_spent
         FROM users u LEFT JOIN orders o ON o.user_id = u.id
         GROUP BY u.id ORDER BY u.id DESC`
      )
      .all()
  );
});

router.patch('/:id/role', (req, res) => {
  const { role } = req.body ?? {};
  if (!['customer', 'admin'].includes(role)) throw new HttpError(400, 'صلاحية غير صالحة');
  if (Number(req.params.id) === req.user.id) throw new HttpError(400, 'لا يمكنك تغيير صلاحيتك بنفسك');
  const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  if (!result.changes) throw new HttpError(404, 'المستخدم غير موجود');
  res.json({ ok: true });
});

export default router;
