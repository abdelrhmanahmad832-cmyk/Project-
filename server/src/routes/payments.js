import { Router } from 'express';
import express from 'express';
import { config } from '../config.js';
import { cardPaymentsEnabled, constructWebhookEvent, syncCheckoutSession } from '../services/payments.js';

const router = Router();

// Stripe needs the raw body to verify the signature, so this is mounted before express.json().
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!cardPaymentsEnabled() || !config.stripeWebhookSecret) return res.status(404).end();
  let event;
  try {
    event = constructWebhookEvent(req.body, req.get('stripe-signature'));
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (
    ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired'].includes(event.type)
  ) {
    await syncCheckoutSession(event.data.object);
  }
  res.json({ received: true });
});

export default router;
