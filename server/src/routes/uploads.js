import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { requireAdmin } from '../auth.js';
import { UPLOAD_DIR, config } from '../config.js';
import { HttpError } from '../db.js';
import { EXTENSIONS, hasValidImageSignature } from '../services/uploads.js';

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${EXTENSIONS[file.mimetype]}`),
  }),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    EXTENSIONS[file.mimetype] ? cb(null, true) : cb(new HttpError(400, 'نوع الملف غير مدعوم (JPG, PNG, WEBP, GIF فقط)')),
});

const router = Router();

router.post('/', requireAdmin, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return next(new HttpError(400, `حجم الصورة يجب ألا يتجاوز ${config.maxUploadMb} ميجابايت`));
    if (err) return next(err instanceof HttpError ? err : new HttpError(400, 'تعذر رفع الملف'));
    if (!req.file) return next(new HttpError(400, 'لم يتم اختيار صورة'));
    if (!hasValidImageSignature(req.file.path, req.file.mimetype)) {
      fs.rm(req.file.path, { force: true }, () => {});
      return next(new HttpError(400, 'الملف ليس صورة صالحة'));
    }
    res.status(201).json({ url: `/uploads/${path.basename(req.file.path)}` });
  });
});

export default router;
