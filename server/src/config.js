import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the project's .env (real environment variables take precedence).
if (process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile(path.join(__dirname, '..', '..', '.env'));
  } catch {
    // No .env file — that's fine.
  }
}
const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

export const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'store.db');
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Without JWT_SECRET, generate a random one once and keep it next to the database,
// so tokens can never be forged with a known default and survive restarts.
function loadJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(path.dirname(DB_PATH), '.jwt-secret');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}

export const config = {
  port: num(process.env.PORT, 4000),
  jwtSecret: loadJwtSecret(),
  storeName: process.env.STORE_NAME || 'سوق',
  currency: (process.env.CURRENCY || 'EGP').toUpperCase(),
  shippingFee: num(process.env.SHIPPING_FEE, 50),
  freeShippingMin: num(process.env.FREE_SHIPPING_MIN, 1000),
  publicUrl: process.env.PUBLIC_URL?.replace(/\/$/, '') || '',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  maxUploadMb: num(process.env.MAX_UPLOAD_MB, 5),
};

export const round2 = (n) => Math.round(n * 100) / 100;
export const shippingFor = (subtotal) =>
  subtotal <= 0 || (config.freeShippingMin > 0 && subtotal >= config.freeShippingMin) ? 0 : config.shippingFee;
