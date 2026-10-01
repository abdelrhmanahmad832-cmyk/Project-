import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';

// Tests wipe and recreate the schema, so they need their own database.
if (!process.env.TEST_DATABASE_URL) {
  console.error('Set TEST_DATABASE_URL to an empty PostgreSQL database to run the tests.');
  process.exit(1);
}
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: process.env.TEST_DATABASE_URL,
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  SHIPPING_FEE: '50',
  FREE_SHIPPING_MIN: '1000',
});

const { app } = await import('../src/app.js');
const { seedIfEmpty } = await import('../src/seed.js');
const { setStripeClient, reconcilePendingPayments } = await import('../src/services/payments.js');
const { pool, one, initDb } = await import('../src/db.js');

// Minimal in-memory stand-in for the Stripe API.
const sessions = new Map();
const refunds = [];
setStripeClient({
  checkout: {
    sessions: {
      create: async (params) => {
        const id = `cs_test_${sessions.size + 1}`;
        const s = { id, url: `https://checkout.stripe.test/${id}`, status: 'open', payment_status: 'unpaid', metadata: params.metadata, params };
        sessions.set(id, s);
        return s;
      },
      retrieve: async (id) => sessions.get(id),
      expire: async (id) => {
        const s = sessions.get(id);
        if (s.status !== 'open') throw new Error('session not open');
        s.status = 'expired';
        return s;
      },
    },
  },
  refunds: { create: async (p) => (refunds.push(p), { id: `re_${refunds.length}` }) },
});
const pay = (id) => Object.assign(sessions.get(id), { status: 'complete', payment_status: 'paid', payment_intent: `pi_${id}` });

let server, base, admin, alice, bob;

async function call(method, url, { token, body, form, headers = {} } = {}) {
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + url, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
const stock = async (id) => (await one('SELECT stock FROM products WHERE id = $1', [id])).stock;
const backdate = (orderId) => pool.query("UPDATE orders SET created_at = now() - interval '10 minutes' WHERE id = $1", [orderId]);

before(async () => {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await initDb();
  await seedIfEmpty();
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  admin = (await call('POST', '/api/auth/login', { body: { email: 'admin@store.com', password: 'admin123' } })).data.token;
  alice = (await call('POST', '/api/auth/register', { body: { name: 'Alice', email: 'alice@x.com', password: 'secret1' } })).data.token;
  bob = (await call('POST', '/api/auth/register', { body: { name: 'Bob', email: 'bob@x.com', password: 'secret1' } })).data.token;
});
after(async () => {
  server.close();
  await pool.end();
});

test('config exposes store settings and card availability', async () => {
  const { data } = await call('GET', '/api/config');
  assert.equal(data.currency, 'EGP');
  assert.equal(data.shippingFee, 50);
  assert.equal(data.cardPayments, true);
});

test('auth: bad login, profile update, password change', async () => {
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'alice@x.com', password: 'nope' } })).status, 401);
  const { data } = await call('PUT', '/api/auth/me', { token: alice, body: { phone: '0100', address: 'Cairo' } });
  assert.equal(data.user.phone, '0100');
  assert.equal(data.user.name, 'Alice');
  assert.equal((await call('PUT', '/api/auth/me/password', { token: alice, body: { currentPassword: 'x', newPassword: 'newpass1' } })).status, 400);
  assert.equal((await call('PUT', '/api/auth/me/password', { token: alice, body: { currentPassword: 'secret1', newPassword: 'newpass1' } })).status, 200);
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'alice@x.com', password: 'newpass1' } })).status, 200);
});

test('products: pagination, sorting, ids filter', async () => {
  const p1 = (await call('GET', '/api/products?limit=3&page=1&sort=price_asc')).data;
  assert.equal(p1.items.length, 3);
  assert.equal(p1.total, 8);
  assert.equal(p1.pages, 3);
  assert.ok(p1.items[0].price <= p1.items[1].price);
  const p3 = (await call('GET', '/api/products?limit=3&page=99')).data;
  assert.equal(p3.page, 3);
  assert.equal(p3.items.length, 2);
  const byIds = (await call('GET', '/api/products?ids=1,2')).data;
  assert.deepEqual(byIds.items.map((p) => p.id).sort(), [1, 2]);
});

test('admin-only endpoints reject customers', async () => {
  for (const [m, u] of [['GET', '/api/orders'], ['GET', '/api/coupons'], ['GET', '/api/users'], ['POST', '/api/products']]) {
    assert.equal((await call(m, u, { token: alice, body: m === 'GET' ? undefined : {} })).status, 403, `${m} ${u}`);
  }
  assert.equal((await call('GET', '/api/orders/mine')).status, 401);
});

test('image upload: validates type and content, cleans up replaced files', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
  const form = () => { const f = new FormData(); f.append('image', new Blob([png], { type: 'image/png' }), 'a.png'); return f; };

  assert.equal((await call('POST', '/api/uploads', { token: alice, form: form() })).status, 403);

  const fake = new FormData();
  fake.append('image', new Blob(['<script>alert(1)</script>'], { type: 'image/png' }), 'evil.png');
  const bad = await call('POST', '/api/uploads', { token: admin, form: fake });
  assert.equal(bad.status, 400);

  const pdf = new FormData();
  pdf.append('image', new Blob(['%PDF'], { type: 'application/pdf' }), 'a.pdf');
  assert.equal((await call('POST', '/api/uploads', { token: admin, form: pdf })).status, 400);

  const up = await call('POST', '/api/uploads', { token: admin, form: form() });
  assert.equal(up.status, 201);
  assert.match(up.data.url, /^\/uploads\/.+\.png$/);
  const served = await fetch(base + up.data.url);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');

  const prod = await call('POST', '/api/products', { token: admin, body: { name: 'With image', price: 10, stock: 1, image_url: up.data.url } });
  assert.equal(prod.status, 201);
  const key = up.data.url.slice('/uploads/'.length);
  const imageCount = async () => (await one('SELECT COUNT(*) AS n FROM images WHERE key = $1', [key])).n;
  assert.equal(await imageCount(), 1);
  await call('PUT', `/api/products/${prod.data.id}`, { token: admin, body: { image_url: 'https://example.com/x.jpg' } });
  assert.equal(await imageCount(), 0, 'old upload should be removed');
  assert.equal((await fetch(base + up.data.url)).status, 404);

  assert.equal((await call('POST', '/api/products', { token: admin, body: { name: 'x', price: 1, image_url: 'javascript:alert(1)' } })).status, 400);
  await call('DELETE', `/api/products/${prod.data.id}`, { token: admin });
});

test('quote: shipping fee below threshold, free above, coupon errors are soft', async () => {
  const cheap = (await call('POST', '/api/orders/quote', { token: bob, body: { items: [{ productId: 7, quantity: 1 }] } })).data;
  assert.deepEqual([cheap.subtotal, cheap.shipping, cheap.total], [180, 50, 230]);
  const big = (await call('POST', '/api/orders/quote', { token: bob, body: { items: [{ productId: 2, quantity: 1 }] } })).data;
  assert.equal(big.shipping, 0);
  const bad = (await call('POST', '/api/orders/quote', { token: bob, body: { items: [{ productId: 7, quantity: 1 }], couponCode: 'NOPE' } })).data;
  assert.equal(bad.couponError, 'كود الخصم غير صالح');
  assert.equal(bad.discount, 0);
});

test('coupons: discount applied, usage limit enforced, released on cancel', async () => {
  const c = await call('POST', '/api/coupons', { token: admin, body: { code: 'save10', type: 'percent', value: 10, max_uses: 1 } });
  assert.equal(c.status, 201);
  assert.equal(c.data.code, 'SAVE10');
  assert.equal((await call('POST', '/api/coupons', { token: admin, body: { code: 'x', type: 'percent', value: 10 } })).status, 400);
  assert.equal((await call('POST', '/api/coupons', { token: admin, body: { code: 'BIG', type: 'percent', value: 150 } })).status, 400);

  const items = [{ productId: 4, quantity: 1 }]; // 1200
  const order = await call('POST', '/api/orders', { token: bob, body: { items, address: 'A', phone: '1', couponCode: 'save10' } });
  assert.equal(order.status, 201);
  assert.deepEqual([order.data.order.subtotal, order.data.order.discount, order.data.order.shipping, order.data.order.total], [1200, 120, 0, 1080]);

  const again = await call('POST', '/api/orders', { token: bob, body: { items, address: 'A', phone: '1', couponCode: 'SAVE10' } });
  assert.equal(again.status, 400);
  assert.match(again.data.error, /استهلاك/);

  await call('POST', `/api/orders/${order.data.order.id}/cancel`, { token: bob });
  assert.equal((await one("SELECT used_count FROM coupons WHERE code = 'SAVE10'")).used_count, 0);
  await call('PATCH', `/api/coupons/${c.data.id}`, { token: admin, body: { active: false } });
  const off = await call('POST', '/api/orders/quote', { token: bob, body: { items, couponCode: 'SAVE10' } });
  assert.ok(off.data.couponError);
});

test('cash on delivery: stock, ownership, cancel rules, delivered marks paid', async () => {
  const before = (await stock(1));
  const { data } = await call('POST', '/api/orders', {
    token: bob,
    body: { items: [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 1 }], address: 'A', phone: '1' },
  });
  const id = data.order.id;
  assert.equal(data.checkoutUrl, null);
  assert.equal(data.order.items.length, 1, 'duplicate lines are merged');
  assert.equal((await stock(1)), before - 2);

  assert.equal((await call('GET', `/api/orders/${id}`, { token: alice })).status, 404, 'other users cannot see it');
  assert.equal((await call('POST', `/api/orders/${id}/cancel`, { token: alice })).status, 404);

  const over = await call('POST', '/api/orders', { token: bob, body: { items: [{ productId: 3, quantity: 999 }], address: 'A', phone: '1' } });
  assert.equal(over.status, 400);

  await call('PATCH', `/api/orders/${id}/status`, { token: admin, body: { status: 'processing' } });
  assert.equal((await call('POST', `/api/orders/${id}/cancel`, { token: bob })).status, 400, 'too late to cancel');
  const delivered = await call('PATCH', `/api/orders/${id}/status`, { token: admin, body: { status: 'delivered' } });
  assert.equal(delivered.data.payment_status, 'paid');

  const o2 = (await call('POST', '/api/orders', { token: bob, body: { items: [{ productId: 1, quantity: 3 }], address: 'A', phone: '1' } })).data.order;
  const s = (await stock(1));
  const cancelled = await call('POST', `/api/orders/${o2.id}/cancel`, { token: bob });
  assert.equal(cancelled.data.status, 'cancelled');
  assert.equal((await stock(1)), s + 3);
  assert.equal((await call('PATCH', `/api/orders/${o2.id}/status`, { token: admin, body: { status: 'pending' } })).status, 400);
});

test('card payment: checkout session, verify on return, retry', async () => {
  const res = await call('POST', '/api/orders', {
    token: alice,
    body: { items: [{ productId: 2, quantity: 1 }], address: 'A', phone: '1', paymentMethod: 'card' },
    headers: { Origin: 'http://shop.test' },
  });
  assert.equal(res.status, 201);
  const order = res.data.order;
  assert.equal(order.payment_method, 'card');
  assert.equal(order.payment_status, 'unpaid');
  assert.match(res.data.checkoutUrl, /checkout\.stripe\.test/);
  const session = sessions.get(order.stripe_session_id);
  assert.equal(session.params.line_items[0].price_data.unit_amount, order.total * 100);
  assert.equal(session.params.success_url, `http://shop.test/orders/${order.id}?session_id={CHECKOUT_SESSION_ID}`);

  // Customer backs out and retries: old session is expired, a new one is issued.
  const retry = await call('POST', `/api/orders/${order.id}/pay`, { token: alice });
  const newId = retry.data.order.stripe_session_id;
  assert.notEqual(newId, order.stripe_session_id);
  assert.equal(sessions.get(order.stripe_session_id).status, 'expired');

  // The expired old session must not cancel the order.
  await reconcilePendingPayments();
  assert.equal((await call('GET', `/api/orders/${order.id}`, { token: alice })).data.status, 'pending');

  pay(newId);
  const verified = await call('POST', `/api/orders/${order.id}/verify-payment`, { token: alice });
  assert.equal(verified.data.payment_status, 'paid');
  assert.equal(verified.data.stripe_payment_intent, `pi_${newId}`);
  assert.equal((await call('POST', `/api/orders/${order.id}/pay`, { token: alice })).status, 400);

  // Admin cancellation of a paid order refunds it.
  const cancelled = await call('PATCH', `/api/orders/${order.id}/status`, { token: admin, body: { status: 'cancelled' } });
  assert.equal(cancelled.data.payment_status, 'refunded');
  assert.deepEqual(refunds.at(-1), { payment_intent: `pi_${newId}` });
});

test('card payment: signed webhook marks paid, bad signature rejected', async () => {
  const { order } = (await call('POST', '/api/orders', {
    token: alice,
    body: { items: [{ productId: 5, quantity: 1 }], address: 'A', phone: '1', paymentMethod: 'card' },
  })).data;
  const session = pay(order.stripe_session_id);
  const payload = JSON.stringify({ id: 'evt_1', object: 'event', type: 'checkout.session.completed', data: { object: session } });
  const sig = Stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test' });

  const bad = await fetch(`${base}/api/payments/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=1,v1=bad' }, body: payload });
  assert.equal(bad.status, 400);
  const ok = await fetch(`${base}/api/payments/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sig }, body: payload });
  assert.equal(ok.status, 200);
  assert.equal((await call('GET', `/api/orders/${order.id}`, { token: alice })).data.payment_status, 'paid');
});

test('card payment: abandoned session expires and releases stock', async () => {
  const s = (await stock(6));
  const { order } = (await call('POST', '/api/orders', {
    token: alice,
    body: { items: [{ productId: 6, quantity: 2 }], address: 'A', phone: '1', paymentMethod: 'card' },
  })).data;
  assert.equal((await stock(6)), s - 2);
  sessions.get(order.stripe_session_id).status = 'expired';
  backdate(order.id);
  await reconcilePendingPayments();
  const after = (await call('GET', `/api/orders/${order.id}`, { token: alice })).data;
  assert.equal(after.status, 'cancelled');
  assert.equal((await stock(6)), s);
});

test('card payment: customer cancels unpaid order, session is closed', async () => {
  const { order } = (await call('POST', '/api/orders', {
    token: alice,
    body: { items: [{ productId: 8, quantity: 1 }], address: 'A', phone: '1', paymentMethod: 'card' },
  })).data;
  const res = await call('POST', `/api/orders/${order.id}/cancel`, { token: alice });
  assert.equal(res.data.status, 'cancelled');
  assert.equal(res.data.payment_status, 'unpaid');
  assert.equal(sessions.get(order.stripe_session_id).status, 'expired');
});

test('reviews: only buyers can review, rating aggregates', async () => {
  assert.equal((await call('POST', '/api/products/3/reviews', { token: bob, body: { rating: 5 } })).status, 403);
  // bob bought product 1 earlier
  assert.equal((await call('POST', '/api/products/1/reviews', { token: bob, body: { rating: 9 } })).status, 400);
  assert.equal((await call('POST', '/api/products/1/reviews', { token: bob, body: { rating: 4, comment: 'جيد' } })).status, 201);
  assert.equal((await call('POST', '/api/products/1/reviews', { token: bob, body: { rating: 2 } })).status, 201, 'second review updates');
  const product = (await call('GET', '/api/products/1')).data;
  assert.equal(product.review_count, 1);
  assert.equal(product.avg_rating, 2);
  const [review] = (await call('GET', '/api/products/1/reviews')).data;
  assert.equal(review.user_name, 'Bob');
  assert.equal((await call('DELETE', `/api/products/1/reviews/${review.id}`, { token: alice })).status, 403);
  assert.equal((await call('DELETE', `/api/products/1/reviews/${review.id}`, { token: admin })).status, 204);
});

test('users: admin can promote others but not change own role; stats', async () => {
  const users = (await call('GET', '/api/users', { token: admin })).data;
  const bobRow = users.find((u) => u.email === 'bob@x.com');
  assert.ok(bobRow.orders_count >= 1);
  assert.equal((await call('PATCH', '/api/users/1/role', { token: admin, body: { role: 'customer' } })).status, 400);
  assert.equal((await call('PATCH', `/api/users/${bobRow.id}/role`, { token: admin, body: { role: 'admin' } })).status, 200);
  assert.equal((await call('GET', '/api/users', { token: bob })).status, 200, 'promotion takes effect immediately');
  await call('PATCH', `/api/users/${bobRow.id}/role`, { token: admin, body: { role: 'customer' } });
  assert.equal((await call('GET', '/api/users', { token: bob })).status, 403, 'demotion takes effect immediately');

  const stats = (await call('GET', '/api/orders/stats', { token: admin })).data;
  assert.ok(stats.revenue > 0);
  assert.equal(stats.customers, 2);
});

test('concurrency: two simultaneous orders for the last unit — only one wins', async () => {
  const { data: p } = await call('POST', '/api/products', { token: admin, body: { name: 'Last one', price: 100, stock: 1 } });
  const body = { items: [{ productId: p.id, quantity: 1 }], address: 'A', phone: '1' };
  const results = await Promise.all([call('POST', '/api/orders', { token: alice, body }), call('POST', '/api/orders', { token: bob, body })]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
  assert.equal(await stock(p.id), 0);
});

test('coupons: expired code is rejected', async () => {
  await call('POST', '/api/coupons', { token: admin, body: { code: 'OLD', type: 'fixed', value: 5, expires_at: '2020-01-01' } });
  const q = await call('POST', '/api/orders/quote', { token: bob, body: { items: [{ productId: 7, quantity: 1 }], couponCode: 'old' } });
  assert.equal(q.data.couponError, 'كود الخصم منتهي الصلاحية');
});
