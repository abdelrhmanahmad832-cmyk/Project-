import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { pool, one } from '../db.js';
import { signToken, requireAuth } from '../auth.js';

const router = Router();
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, address: u.address });
const getUser = (id) => one('SELECT * FROM users WHERE id = $1', [id]);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'محاولات كثيرة، حاول مرة أخرى بعد قليل' },
});

router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!String(name ?? '').trim() || !String(email ?? '').trim() || !password) {
    return res.status(400).json({ error: 'الاسم والبريد وكلمة المرور مطلوبة' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'البريد الإلكتروني غير صالح' });
  if (String(password).length < 6) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });

  const user = await one(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING *',
    [String(name).trim(), String(email).trim().toLowerCase(), bcrypt.hashSync(String(password), 10)]
  );
  if (!user) return res.status(409).json({ error: 'هذا البريد مسجل بالفعل' });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = email && (await one('SELECT * FROM users WHERE email = $1', [String(email).trim().toLowerCase()]));
  if (!user || !password || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: publicUser(await getUser(req.user.id)) });
});

router.put('/me', requireAuth, async (req, res) => {
  const { name, phone, address } = req.body ?? {};
  if (name !== undefined && !String(name).trim()) return res.status(400).json({ error: 'الاسم مطلوب' });
  const user = await one(
    `UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone), address = COALESCE($3, address)
     WHERE id = $4 RETURNING *`,
    [
      name !== undefined ? String(name).trim() : null,
      phone !== undefined ? String(phone).trim() : null,
      address !== undefined ? String(address).trim() : null,
      req.user.id,
    ]
  );
  res.json({ user: publicUser(user) });
});

router.put('/me/password', requireAuth, authLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  const user = await getUser(req.user.id);
  if (!currentPassword || !bcrypt.compareSync(String(currentPassword), user.password_hash)) {
    return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  }
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
  }
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [bcrypt.hashSync(String(newPassword), 10), user.id]);
  res.json({ ok: true });
});

export default router;
