import path from 'node:path';
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

export const config = {
  port: num(process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL || '',
  // Filled from the database at startup when JWT_SECRET isn't set (see db.js).
  jwtSecret: process.env.JWT_SECRET || '',
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
