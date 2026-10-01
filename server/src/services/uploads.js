import { pool, one } from '../db.js';

const SIGNATURES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/gif': (b) => b.subarray(0, 4).toString('ascii') === 'GIF8',
  'image/webp': (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
};
export const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };

// Checks the file's actual bytes, not just the client-declared type.
export const hasValidImageSignature = (buffer, mimetype) => buffer.length >= 12 && !!SIGNATURES[mimetype]?.(buffer);

// Deletes an uploaded image once no product references it.
export async function removeUploadIfUnused(url) {
  if (!url?.startsWith('/uploads/')) return;
  const { n } = await one('SELECT COUNT(*) AS n FROM products WHERE image_url = $1', [url]);
  if (!n) await pool.query('DELETE FROM images WHERE key = $1', [url.slice('/uploads/'.length)]);
}
