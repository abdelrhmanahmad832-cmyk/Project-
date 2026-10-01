import Stripe from 'stripe';
import { pool, all, one } from '../db.js';
import { config } from '../config.js';
import { cancelOrderInDb, getOrder } from './orders.js';

let stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey) : null;

export const cardPaymentsEnabled = () => !!stripe;
export const getStripe = () => stripe;
// Lets tests swap in a fake Stripe client.
export const setStripeClient = (client) => (stripe = client);

const SESSION_TTL_SECONDS = 30 * 60; // Stripe's minimum expiry

export async function createCheckoutSession(order, baseUrl, customerEmail) {
  if (order.stripe_session_id) {
    // Never leave two payable sessions open for one order.
    const synced = await syncCheckoutSession(order.stripe_session_id);
    if (synced?.payment_status === 'paid') return null;
    try {
      await stripe.checkout.sessions.expire(order.stripe_session_id);
    } catch {
      // Already expired or completed — nothing to do.
    }
  }
  const summary = order.items.map((i) => `${i.product_name} × ${i.quantity}`).join('، ').slice(0, 480);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: config.currency.toLowerCase(),
          unit_amount: Math.round(order.total * 100),
          product_data: { name: `${config.storeName} — طلب رقم ${order.id}`, description: summary },
        },
      },
    ],
    customer_email: customerEmail,
    client_reference_id: String(order.id),
    metadata: { order_id: String(order.id) },
    expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    success_url: `${baseUrl}/orders/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/orders/${order.id}?canceled=1`,
  });
  await pool.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, order.id]);
  return session.url;
}

// Applies a Checkout Session's state to its order: marks it paid, or releases stock once the session expired.
// Safe to call repeatedly (from the webhook, the success redirect, and the background sweep).
export async function syncCheckoutSession(sessionOrId) {
  const session =
    typeof sessionOrId === 'string' ? await stripe.checkout.sessions.retrieve(sessionOrId) : sessionOrId;
  const orderId = Number(session.metadata?.order_id);
  const order = Number.isInteger(orderId) && orderId > 0 && (await one('SELECT * FROM orders WHERE id = $1', [orderId]));
  if (!order || order.payment_method !== 'card') return null;

  if (session.payment_status === 'paid' && order.payment_status === 'unpaid') {
    const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    const updated = await one(
      `UPDATE orders SET payment_status = 'paid', paid_at = now(), stripe_payment_intent = $1
       WHERE id = $2 AND payment_status = 'unpaid' RETURNING status`,
      [paymentIntent ?? null, order.id]
    );
    if (updated?.status === 'cancelled') {
      // Paid after the order was cancelled (race with the expiry sweep) — give the money back.
      await refundOrder({ ...order, stripe_payment_intent: paymentIntent });
      await pool.query("UPDATE orders SET payment_status = 'refunded' WHERE id = $1", [order.id]);
    }
  } else if (
    session.status === 'expired' &&
    order.payment_status === 'unpaid' &&
    order.status !== 'cancelled' &&
    session.id === order.stripe_session_id
  ) {
    await cancelOrderInDb(order.id);
  }
  return getOrder(order.id);
}

export async function refundOrder(order) {
  if (!order.stripe_payment_intent) throw new Error('لا يوجد معرّف دفع لاسترداده');
  return stripe.refunds.create({ payment_intent: order.stripe_payment_intent });
}

// Catches payments whose webhook never arrived and frees stock held by abandoned card orders.
export async function reconcilePendingPayments() {
  if (!stripe) return;
  const pending = await all(
    `SELECT * FROM orders WHERE payment_method = 'card' AND payment_status = 'unpaid' AND status != 'cancelled'
     AND created_at < now() - interval '5 minutes'`
  );
  for (const order of pending) {
    try {
      if (order.stripe_session_id) await syncCheckoutSession(order.stripe_session_id);
      else if (order.created_at < Date.now() - SESSION_TTL_SECONDS * 1000) await cancelOrderInDb(order.id);
    } catch (err) {
      console.error(`تعذر مزامنة الدفع للطلب ${order.id}:`, err.message);
    }
  }
}

export function constructWebhookEvent(rawBody, signature) {
  return Stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
}
