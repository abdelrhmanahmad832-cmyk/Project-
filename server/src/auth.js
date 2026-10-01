import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { db } from './db.js';

export function signToken(user) {
  return jwt.sign({ id: user.id }, config.jwtSecret, { expiresIn: '7d' });
}

// Role is re-read from the DB on every request so demotions/deletions take effect immediately.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'جلسة غير صالحة، سجّل الدخول مرة أخرى' });
  }
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(payload.id);
  if (!user) return res.status(401).json({ error: 'جلسة غير صالحة، سجّل الدخول مرة أخرى' });
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح لك' });
    next();
  });
}
