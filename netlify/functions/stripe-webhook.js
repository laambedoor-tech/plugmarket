const stripeLib = require('stripe');

// Stripe webhook endpoint for Netlify Functions
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecret || !webhookSecret) {
    return { statusCode: 500, body: 'Missing Stripe env vars' };
  }

  const stripe = stripeLib(stripeSecret);

  const sig = event.headers['stripe-signature'];
  if (!sig) return { statusCode: 400, body: 'Missing Stripe signature' };

  let evt;
  try {
    // event.body is a raw string; don't JSON.parse before verification
    evt = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    switch (evt.type) {
      case 'payment_intent.succeeded': {
        const pi = evt.data.object;
        // TODO: fulfill the order (e.g., update DB, send email/Discord DM)
        console.log('Payment succeeded', { id: pi.id, amount: pi.amount, metadata: pi.metadata });
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = evt.data.object;
        console.warn('Payment failed', { id: pi.id, last_payment_error: pi.last_payment_error?.message });
        break;
      }
      default:
        console.log(`Unhandled event type ${evt.type}`);
    }
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (e) {
    console.error('Webhook handler error', e);
    return { statusCode: 500, body: 'Webhook handler error' };
  }
};
