import { app } from './app.js';
import { config } from './config.js';
import { seedIfEmpty } from './seed.js';
import { cardPaymentsEnabled, reconcilePendingPayments } from './services/payments.js';

seedIfEmpty();

if (cardPaymentsEnabled()) {
  setInterval(reconcilePendingPayments, 5 * 60 * 1000).unref();
  reconcilePendingPayments();
} else {
  console.log('الدفع الإلكتروني غير مفعّل (STRIPE_SECRET_KEY غير مضبوط) — الدفع عند الاستلام فقط');
}

app.listen(config.port, () => console.log(`الخادم يعمل على http://localhost:${config.port}`));
