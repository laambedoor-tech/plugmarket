/**
 * POST /api/paypal/create-order
 * Body: { cart: [{ pid, plan, qty } ...] }
 * Creates a PayPal order using Orders API and returns { id }
 */

// Copy of pricing helper used in Stripe PI endpoint (keep in sync)
const PRICES_USD = {
  netflix: { '1 Month': 150, '3 Months': 400, 'Yearly': 1200 },
  spotify: { '1 Month': 120, '3 Months': 300, 'Yearly': 1000 },
  'youtube-premium': { '1 Month': 150, '3 Months': 400, 'Yearly': 1300 },
  'hulu': { 'Standard': 1500, 'Ad-Free': 1700 }
};

function validateAndPriceCart(cart){
  let totalCents = 0;
  for (const item of cart){
    if (!item.pid || !item.plan) throw new Error('Missing pid or plan');
    const priceTable = PRICES_USD[item.pid];
    if (!priceTable) throw new Error(`Unknown product: ${item.pid}`);
    const unit = priceTable[item.plan];
    if (unit === undefined) throw new Error(`Unknown plan "${item.plan}" for ${item.pid}`);
    const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
    totalCents += unit * qty;
  }
  return totalCents;
}

async function getAccessToken(env){
  const base = (env.PAYPAL_ENV || 'sandbox') === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const clientId = env.PAYPAL_CLIENT_ID;
  const secret = env.PAYPAL_SECRET;
  if (!clientId || !secret) throw new Error('Missing PayPal credentials');
  const creds = btoa(`${clientId}:${secret}`);
  const res = await fetch(base + '/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || 'Failed to get token');
  return { token: json.access_token, base };
}

export default {
  async fetch(request, env){
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/paypal/create-order')) return new Response('Not Found', { status: 404 });

    try {
      const { cart } = await request.json();
      if (!Array.isArray(cart) || !cart.length) return new Response(JSON.stringify({ error: 'Empty cart' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

      const totalCents = validateAndPriceCart(cart);
      const amount = (totalCents / 100).toFixed(2);
      const currency = env.PAYPAL_CURRENCY || 'USD';

      const { token, base } = await getAccessToken(env);

      const payload = {
        intent: 'CAPTURE',
        purchase_units: [{ amount: { currency_code: currency, value: amount } }],
        application_context: { shipping_preference: 'NO_SHIPPING' }
      };

      const res = await fetch(base + '/v2/checkout/orders', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) return new Response(JSON.stringify({ error: data.message || 'Failed to create order' }), { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

      return new Response(JSON.stringify({ id: data.id }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    } catch (err){
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
  }
};
