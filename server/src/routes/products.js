import { Router } from 'express';
import { db, HttpError } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { removeUploadIfUnused } from '../services/uploads.js';

const router = Router();

const SELECT = `
  SELECT p.*,
    (SELECT ROUND(AVG(rating), 1) FROM reviews r WHERE r.product_id = p.id) AS avg_rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count
  FROM products p`;
const SORTS = {
  newest: 'p.id DESC',
  price_asc: 'p.price ASC, p.id DESC',
  price_desc: 'p.price DESC, p.id DESC',
  rating: 'avg_rating IS NULL, avg_rating DESC, review_count DESC',
  name: 'p.name COLLATE NOCASE ASC',
};
const getProduct = (id) => db.prepare(`${SELECT} WHERE p.id = ?`).get(id);

function parseProduct(body, partial = false) {
  const out = {};
  const errors = [];
  if (body.name !== undefined || !partial) {
    if (!String(body.name ?? '').trim()) errors.push('اسم المنتج مطلوب');
    else out.name = String(body.name).trim();
  }
  if (body.price !== undefined || !partial) {
    const price = Number(body.price);
    if (body.price === '' || !Number.isFinite(price) || price < 0) errors.push('السعر غير صالح');
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
  if (out.image_url && !/^(https?:\/\/|\/uploads\/)/.test(out.image_url)) errors.push('رابط الصورة غير صالح');
  return { data: out, errors };
}

router.get('/', (req, res) => {
  const { q, category, sort, ids, inStock } = req.query;
  const where = [];
  const params = [];
  if (ids) {
    const list = String(ids).split(',').map(Number).filter(Number.isInteger).slice(0, 100);
    where.push(`p.id IN (${list.map(() => '?').join(',') || 'NULL'})`);
    params.push(...list);
  }
  if (q) {
    where.push('(p.name LIKE ? OR p.description LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category) {
    where.push('p.category = ?');
    params.push(category);
  }
  if (inStock === '1') where.push('p.stock > 0');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 100);
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM products p ${whereSql}`).get(...params);
  const pages = Math.max(Math.ceil(total / limit), 1);
  const page = Math.min(Math.max(parseInt(req.query.page) || 1, 1), pages);
  const items = db
    .prepare(`${SELECT} ${whereSql} ORDER BY ${SORTS[sort] || SORTS.newest} LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit);
  res.json({ items, total, page, pages });
});

router.get('/categories', (_req, res) => {
  res.json(db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all().map((r) => r.category));
});

router.get('/:id', (req, res) => {
  const product = getProduct(req.params.id);
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
  res.status(201).json(getProduct(lastInsertRowid));
});

router.put('/:id', requireAdmin, (req, res) => {
  const { data, errors } = parseProduct(req.body ?? {}, true);
  if (errors.length) return res.status(400).json({ error: errors.join('، ') });
  const before = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!before) return res.status(404).json({ error: 'المنتج غير موجود' });
  const cols = Object.keys(data);
  if (cols.length) {
    db.prepare(`UPDATE products SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(
      ...Object.values(data),
      req.params.id
    );
  }
  if (data.image_url !== undefined && data.image_url !== before.image_url) removeUploadIfUnused(before.image_url);
  res.json(getProduct(req.params.id));
});

router.delete('/:id', requireAdmin, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'المنتج غير موجود' });
  db.prepare('DELETE FROM products WHERE id = ?').run(product.id);
  removeUploadIfUnused(product.image_url);
  res.status(204).end();
});

// Reviews
router.get('/:id/reviews', (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT r.id, r.rating, r.comment, r.created_at, r.user_id, u.name AS user_name
         FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.product_id = ? ORDER BY r.id DESC`
      )
      .all(req.params.id)
  );
});

router.post('/:id/reviews', requireAuth, (req, res) => {
  const productId = Number(req.params.id);
  if (!db.prepare('SELECT id FROM products WHERE id = ?').get(productId)) {
    throw new HttpError(404, 'المنتج غير موجود');
  }
  const purchased = db
    .prepare(
      `SELECT 1 FROM orders o JOIN order_items i ON i.order_id = o.id
       WHERE o.user_id = ? AND i.product_id = ? AND o.status != 'cancelled' LIMIT 1`
    )
    .get(req.user.id, productId);
  if (!purchased) return res.status(403).json({ error: 'يمكنك تقييم المنتجات التي اشتريتها فقط' });

  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'التقييم يجب أن يكون من 1 إلى 5' });
  const comment = String(req.body?.comment ?? '').trim().slice(0, 1000);
  db.prepare(
    `INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)
     ON CONFLICT (product_id, user_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, created_at = datetime('now')`
  ).run(productId, req.user.id, rating, comment);
  res.status(201).json({ ok: true });
});

router.delete('/:id/reviews/:reviewId', requireAuth, (req, res) => {
  const review = db.prepare('SELECT * FROM reviews WHERE id = ? AND product_id = ?').get(req.params.reviewId, req.params.id);
  if (!review) return res.status(404).json({ error: 'التقييم غير موجود' });
  if (review.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح لك' });
  db.prepare('DELETE FROM reviews WHERE id = ?').run(review.id);
  res.status(204).end();
});

export default router;
