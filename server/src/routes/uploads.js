import { Router } from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import { requireAdmin } from '../auth.js';
import { config } from '../config.js';
import { pool, one, HttpError } from '../db.js';
import { EXTENSIONS, hasValidImageSignature } from '../services/uploads.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    EXTENSIONS[file.mimetype] ? cb(null, true) : cb(new HttpError(400, 'نوع الملف غير مدعوم (JPG, PNG, WEBP, GIF فقط)')),
});

export const uploadRoutes = Router();

uploadRoutes.post('/', requireAdmin, (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    try {
      if (err?.code === 'LIMIT_FILE_SIZE') throw new HttpError(400, `حجم الصورة يجب ألا يتجاوز ${config.maxUploadMb} ميجابايت`);
      if (err) throw err instanceof HttpError ? err : new HttpError(400, 'تعذر رفع الملف');
      if (!req.file) throw new HttpError(400, 'لم يتم اختيار صورة');
      if (!hasValidImageSignature(req.file.buffer, req.file.mimetype)) throw new HttpError(400, 'الملف ليس صورة صالحة');
      const key = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${EXTENSIONS[req.file.mimetype]}`;
      await pool.query('INSERT INTO images (key, mime, data) VALUES ($1, $2, $3)', [key, req.file.mimetype, req.file.buffer]);
      res.status(201).json({ url: `/uploads/${key}` });
    } catch (e) {
      next(e);
    }
  });
});

// Serves uploaded images from the database.
export const serveUploads = Router();

serveUploads.get('/:key', async (req, res) => {
  const image = await one('SELECT mime, data FROM images WHERE key = $1', [req.params.key]);
  if (!image) return res.status(404).end();
  res.set({ 'Content-Type': image.mime, 'Cache-Control': 'public, max-age=31536000, immutable' });
  res.send(image.data);
});
