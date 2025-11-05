const stripeLib = require('stripe');

// Minimal currency-safe math helpers (store amounts in cents)
const toCents = (n) => Math.round(Number(n) * 100);

// Price source of truth. Keep in sync with frontend subscriptions in js/main.js
const PRICES_USD = {
  netflix: { '1 Month': 1.5, '3 Months': 3.5, '6 Months': 6.0, '12 Months': 11.0, 'Lifetime': 18.0 },
  spotify: { '1 Month': 2.2, '3 Months': 3.8, '6 Months': 6.2, '12 Months': 12.5 },
  youtube: { '1 Month': 1.6, '3 Months': 3.2, '6 Months': 5.5, '12 Months': 10.5 },
  disney:  { '1 Month': 1.1, '3 Months': 2.7, '6 Months': 4.8, '12 Months': 9.5 },
  prime:   { '1 Month': 1.8, '3 Months': 3.4, '6 Months': 5.8, '12 Months': 11.2 },
  hbomax:  { '1 Month': 1.4, '3 Months': 3.1, '6 Months': 4.7, '12 Months': 9.8 },
  nordvpn: { '1 Month': 0.85, '3 Months': 2.0, '6 Months': 3.6, '12 Months': 6.9 },
  crunchy: { '1 Month': 0.9, '3 Months': 2.1, '6 Months': 3.8, '12 Months': 7.2 },
  nitro:   { 'Boost 1m': 4.79, 'Boost 1 Year': 15.97, 'Basic 1m': 1.35 },
  chatgpt: { '1 Month': 3.2, '3 Months': 7.8, '6 Months': 12.5, '12 Months': 24.0 },
  capcut:  { '1 Month': 1.2, '3 Months': 2.5, '6 Months': 4.2, '12 Months': 8.0 },
};

function validateAndPriceCart(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Empty cart');
  }
  let totalCents = 0;
  const normalized = [];
  for (const it of items) {
    const { pid, plan, qty } = it || {};
    if (!pid || !plan) throw new Error('Invalid item');
    const catalog = PRICES_USD[pid];
    if (!catalog) throw new Error(`Unknown product: ${pid}`);
    const price = catalog[plan];
    if (!price) throw new Error(`Unknown plan for ${pid}: ${plan}`);
    const q = Math.max(1, Math.min(99, Number(qty || 1)));
    const line = toCents(price) * q;
    totalCents += line;
    normalized.push({ pid, plan, unitAmount: toCents(price), qty: q });
  }
  if (totalCents <= 0) throw new Error('Invalid total');
  return { totalCents, normalized };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY' }) };
    }

    const stripe = stripeLib(stripeSecret);

    const { items } = JSON.parse(event.body || '{}');
    const { totalCents, normalized } = validateAndPriceCart(items);

    const intent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        cart: JSON.stringify(normalized),
        site: 'plugmarket',
      },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ clientSecret: intent.client_secret }),
    };
  } catch (err) {
    console.error('create-payment-intent error', err);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Bad Request' }),
    };
  }
};
