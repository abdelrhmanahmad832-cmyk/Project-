import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { signToken, requireAuth } from '../auth.js';

const router = Router();
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, address: u.address });
const getUser = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'محاولات كثيرة، حاول مرة أخرى بعد قليل' },
});

router.post('/register', authLimiter, (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'الاسم والبريد وكلمة المرور مطلوبة' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'البريد الإلكتروني غير صالح' });
  if (password.length < 6) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });

  const normalized = email.trim().toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(normalized)) {
    return res.status(409).json({ error: 'هذا البريد مسجل بالفعل' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name.trim(), normalized, hash);
  const user = getUser(lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', authLimiter, (req, res) => {
  const { email, password } = req.body ?? {};
  const user = email && db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase());
  if (!user || !password || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(getUser(req.user.id)) });
});

router.put('/me', requireAuth, (req, res) => {
  const { name, phone, address } = req.body ?? {};
  if (name !== undefined && !String(name).trim()) return res.status(400).json({ error: 'الاسم مطلوب' });
  const current = getUser(req.user.id);
  db.prepare('UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?').run(
    name !== undefined ? String(name).trim() : current.name,
    phone !== undefined ? String(phone).trim() : current.phone,
    address !== undefined ? String(address).trim() : current.address,
    req.user.id
  );
  res.json({ user: publicUser(getUser(req.user.id)) });
});

router.put('/me/password', requireAuth, authLimiter, (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  const user = getUser(req.user.id);
  if (!currentPassword || !bcrypt.compareSync(String(currentPassword), user.password_hash)) {
    return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  }
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(newPassword), 10), user.id);
  res.json({ ok: true });
});

export default router;
