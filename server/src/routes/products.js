import { Router } from 'express';
import { pool, all, one, HttpError } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { removeUploadIfUnused } from '../services/uploads.js';

const router = Router();

const SELECT = `
  SELECT p.*, r.avg_rating, COALESCE(r.review_count, 0) AS review_count
  FROM products p
  LEFT JOIN (
    SELECT product_id, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count FROM reviews GROUP BY product_id
  ) r ON r.product_id = p.id`;
const SORTS = {
  newest: 'p.id DESC',
  price_asc: 'p.price ASC, p.id DESC',
  price_desc: 'p.price DESC, p.id DESC',
  rating: 'r.avg_rating DESC NULLS LAST, review_count DESC, p.id DESC',
  name: 'lower(p.name) ASC',
};
const isId = (v) => /^\d{1,9}$/.test(String(v));
const getProduct = (id) => (isId(id) ? one(`${SELECT} WHERE p.id = $1`, [id]) : null);

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

router.get('/', async (req, res) => {
  const { q, category, sort, ids, inStock } = req.query;
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (ids) add('p.id = ANY(?)', String(ids).split(',').filter(isId).map(Number).slice(0, 100));
  if (q) {
    params.push(`%${String(q).replace(/[\\%_]/g, '\\$&')}%`);
    where.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
  }
  if (category) add('p.category = ?', String(category));
  if (inStock === '1') where.push('p.stock > 0');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 100);
  const { total } = await one(`SELECT COUNT(*) AS total FROM products p ${whereSql}`, params);
  const pages = Math.max(Math.ceil(total / limit), 1);
  const page = Math.min(Math.max(parseInt(req.query.page) || 1, 1), pages);
  const items = await all(
    `${SELECT} ${whereSql} ORDER BY ${SORTS[sort] || SORTS.newest} LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    params
  );
  res.json({ items, total, page, pages });
});

router.get('/categories', async (_req, res) => {
  res.json((await all('SELECT DISTINCT category FROM products ORDER BY category')).map((r) => r.category));
});

router.get('/:id', async (req, res) => {
  const product = await getProduct(req.params.id);
  if (!product) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json(product);
});

router.post('/', requireAdmin, async (req, res) => {
  const { data, errors } = parseProduct(req.body ?? {});
  if (errors.length) return res.status(400).json({ error: errors.join('، ') });
  const cols = Object.keys(data);
  const { id } = await one(
    `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    Object.values(data)
  );
  res.status(201).json(await getProduct(id));
});

router.put('/:id', requireAdmin, async (req, res) => {
  const { data, errors } = parseProduct(req.body ?? {}, true);
  if (errors.length) return res.status(400).json({ error: errors.join('، ') });
  const before = isId(req.params.id) && (await one('SELECT * FROM products WHERE id = $1', [req.params.id]));
  if (!before) return res.status(404).json({ error: 'المنتج غير موجود' });
  const cols = Object.keys(data);
  if (cols.length) {
    await pool.query(
      `UPDATE products SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${cols.length + 1}`,
      [...Object.values(data), before.id]
    );
  }
  if (data.image_url !== undefined && data.image_url !== before.image_url) await removeUploadIfUnused(before.image_url);
  res.json(await getProduct(before.id));
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const product = isId(req.params.id) && (await one('DELETE FROM products WHERE id = $1 RETURNING *', [req.params.id]));
  if (!product) return res.status(404).json({ error: 'المنتج غير موجود' });
  await removeUploadIfUnused(product.image_url);
  res.status(204).end();
});

// Reviews
router.get('/:id/reviews', async (req, res) => {
  if (!isId(req.params.id)) return res.json([]);
  res.json(
    await all(
      `SELECT r.id, r.rating, r.comment, r.created_at, r.user_id, u.name AS user_name
       FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.product_id = $1 ORDER BY r.id DESC`,
      [req.params.id]
    )
  );
});

router.post('/:id/reviews', requireAuth, async (req, res) => {
  if (!(await getProduct(req.params.id))) throw new HttpError(404, 'المنتج غير موجود');
  const productId = Number(req.params.id);
  const purchased = await one(
    `SELECT 1 FROM orders o JOIN order_items i ON i.order_id = o.id
     WHERE o.user_id = $1 AND i.product_id = $2 AND o.status != 'cancelled' LIMIT 1`,
    [req.user.id, productId]
  );
  if (!purchased) return res.status(403).json({ error: 'يمكنك تقييم المنتجات التي اشتريتها فقط' });

  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'التقييم يجب أن يكون من 1 إلى 5' });
  const comment = String(req.body?.comment ?? '').trim().slice(0, 1000);
  await pool.query(
    `INSERT INTO reviews (product_id, user_id, rating, comment) VALUES ($1, $2, $3, $4)
     ON CONFLICT (product_id, user_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, created_at = now()`,
    [productId, req.user.id, rating, comment]
  );
  res.status(201).json({ ok: true });
});

router.delete('/:id/reviews/:reviewId', requireAuth, async (req, res) => {
  const review =
    isId(req.params.id) && isId(req.params.reviewId) &&
    (await one('SELECT * FROM reviews WHERE id = $1 AND product_id = $2', [req.params.reviewId, req.params.id]));
  if (!review) return res.status(404).json({ error: 'التقييم غير موجود' });
  if (review.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح لك' });
  await pool.query('DELETE FROM reviews WHERE id = $1', [review.id]);
  res.status(204).end();
});

export default router;
