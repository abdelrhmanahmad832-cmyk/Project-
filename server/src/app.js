import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { cardPaymentsEnabled } from './services/payments.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import couponRoutes from './routes/coupons.js';
import userRoutes from './routes/users.js';
import { uploadRoutes, serveUploads } from './routes/uploads.js';
import paymentRoutes from './routes/payments.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'upgrade-insecure-requests': null,
      },
    },
  })
);

app.use('/api/payments', paymentRoutes); // before express.json(): the webhook needs the raw body
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/config', (_req, res) =>
  res.json({
    storeName: config.storeName,
    currency: config.currency,
    shippingFee: config.shippingFee,
    freeShippingMin: config.freeShippingMin,
    cardPayments: cardPaymentsEnabled(),
  })
);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/users', userRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'المسار غير موجود' }));

app.use('/uploads', serveUploads);

// In production, serve the built React app.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'بيانات غير صالحة' });
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'حدث خطأ في الخادم' });
});
