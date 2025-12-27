/**
 * POST /api/paypal/create-order
 * Body: { cart: [{ pid, plan, qty } ...] }
 * Creates a PayPal order using Orders API and returns { id }
 */

// Copy of pricing helper used in Stripe PI endpoint (keep in sync)
const PRICES_USD = {
  netflix: { '1 Month': 150, '3 Months': 350, '6 Months': 600, '12 Months': 1100, 'Lifetime': 1800 },
  spotify: { '1 Month': 220, '3 Months': 380, '6 Months': 620, '12 Months': 1250 },
  'youtube-premium': { '1 Month': 160, '3 Months': 320, '6 Months': 550, '12 Months': 1050 },
  disney: { '1 Month': 110, '3 Months': 270, '6 Months': 480, '12 Months': 950 },
  prime: { '1 Month': 180, '3 Months': 340, '6 Months': 580, '12 Months': 1120 },
  hbomax: { '1 Month': 140, '3 Months': 310, '6 Months': 470, '12 Months': 980 },
  nordvpn: { '1 Month': 85, '3 Months': 200, '6 Months': 360, '12 Months': 690 },
  crunchy: { '1 Month': 90, '3 Months': 210, '6 Months': 380, '12 Months': 720 },
  nitro: { 'Boost 1m': 479, 'Boost 1 Year': 1597, 'Basic 1m': 135 },
  chatgpt: { '1 Month': 320, '3 Months': 780, '6 Months': 1250, '12 Months': 2400 },
  capcut: { '1 Month': 120, '3 Months': 250, '6 Months': 420, '12 Months': 800 },
  geoguessr: { '1 Month': 200, '3 Months': 500, '12 Months': 1000 }
};

const PLAN_ALIASES = {
  '1 mes':'1 Month','1 month':'1 Month','1m':'1 Month',
  '3 meses':'3 Months','3 month':'3 Months','3m':'3 Months',
  '6 meses':'6 Months','6 month':'6 Months','6m':'6 Months',
  '12 meses':'12 Months','12 month':'12 Months','12m':'12 Months',
  'lifetime':'Lifetime','de por vida':'Lifetime'
};
function normalizePlan(raw){
  if(!raw) return raw; const key = raw.trim().toLowerCase(); return PLAN_ALIASES[key] || raw.trim();
}
function validateAndPriceCart(cart){
  let totalCents = 0;
  for (const item of cart){
    if (!item.pid || !item.plan) throw new Error('Missing pid or plan');
    const priceTable = PRICES_USD[item.pid];
    if (!priceTable) throw new Error(`Unknown product: ${item.pid}`);
    const originalPlan = item.plan;
    const plan = normalizePlan(originalPlan);
    const unit = priceTable[plan];
    if (unit === undefined) throw new Error(`Unknown plan "${originalPlan}" (normalized="${plan}") for ${item.pid}`);
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
  if (!res.ok) throw new Error(json.error_description || json.error || 'Failed to get PayPal token');
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
      let amount = (totalCents / 100).toFixed(2);
      const currency = env.PAYPAL_CURRENCY || 'USD';

      const { token, base } = await getAccessToken(env);

      // PayPal (live) often rejects amounts below $1.00 in USD.
      // To avoid semantic/business validation errors, enforce a minimum of $1.00.
      // Client-side will warn users; server enforces as a safety net.
      if ((env.PAYPAL_ENV || 'sandbox') === 'live') {
        const amtNum = Number(amount);
        if (!Number.isNaN(amtNum) && amtNum < 1) {
          amount = '1.00';
        }
      }

      const payload = {
        intent: 'CAPTURE',
        purchase_units: [{ 
          amount: { currency_code: currency, value: amount },
          description: 'Plug Market order'
        }],
        application_context: { shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW' }
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
