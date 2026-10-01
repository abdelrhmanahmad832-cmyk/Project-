import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';

const router = Router();

function parseProduct(body, partial = false) {
  const out = {};
  const errors = [];
  if (body.name !== undefined || !partial) {
    if (!String(body.name ?? '').trim()) errors.push('اسم المنتج مطلوب');
    else out.name = String(body.name).trim();
  }
  if (body.price !== undefined || !partial) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) errors.push('السعر غير صالح');
    else out.price = price;
  }
  if (body.stock !== undefined || !partial) {
    const stock = Number(body.stock ?? 0);
    if (!Number.isInteger(stock) || stock < 0) errors.push('المخزون غير صالح');
    else out.stock = stock;
  }
  for (const key of ['description', 'category', 'image_url']) {
    if (body[key] !== undefined) out[key] = String(body[key]).trim();
  }
  if (out.category === '') out.category = 'عام';
  return { data: out, errors };
}

router.get('/', (req, res) => {
  const { q, category } = req.query;
  const where = [];
  const params = [];
  if (q) {
    where.push('(name LIKE ? OR description LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  const sql = `SELECT * FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`;
  res.json(db.prepare(sql).all(...params));
});

router.get('/categories', (_req, res) => {
  res.json(db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all().map((r) => r.category));
});

router.get('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json(product);
});

router.post('/', requireAdmin, (req, res) => {
  const { data, errors } = parseProduct(req.body ?? {});
  if (errors.length) return res.status(400).json({ error: errors.join('، ') });
  const cols = Object.keys(data);
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(data));
  res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(lastInsertRowid));
});

router.put('/:id', requireAdmin, (req, res) => {
  const { data, errors } = parseProduct(req.body ?? {}, true);
  if (errors.length) return res.status(400).json({ error: errors.join('، ') });
  const cols = Object.keys(data);
  if (cols.length) {
    const result = db
      .prepare(`UPDATE products SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
      .run(...Object.values(data), req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'المنتج غير موجود' });
  }
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json(product);
});

router.delete('/:id', requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.status(204).end();
});

export default router;
