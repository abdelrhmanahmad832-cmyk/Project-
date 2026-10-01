import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db.js';
import { UPLOAD_DIR } from '../config.js';

const SIGNATURES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/gif': (b) => b.subarray(0, 4).toString('ascii') === 'GIF8',
  'image/webp': (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
};
export const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };

// Checks the file's actual bytes, not just the client-declared type.
export function hasValidImageSignature(filePath, mimetype) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    return !!SIGNATURES[mimetype]?.(buf);
  } finally {
    fs.closeSync(fd);
  }
}

// Deletes a locally uploaded image once no product references it.
export function removeUploadIfUnused(url) {
  if (!url?.startsWith('/uploads/')) return;
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM products WHERE image_url = ?').get(url);
  if (n) return;
  const file = path.join(UPLOAD_DIR, path.basename(url));
  fs.rm(file, { force: true }, () => {});
}
