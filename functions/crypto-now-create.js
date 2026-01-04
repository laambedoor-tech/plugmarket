/**
 * POST /api/crypto/now/create
 * Body: { cart: [{ pid, plan, qty }], customerEmail, payCurrency }
 * Creates a NOWPayments payment with unique address and exact amount.
 */

const PRICES_USD = {
  netflix: { '1 Month': 1.5, '3 Months': 3.5, '6 Months': 6.0, '12 Months': 11.0, 'Lifetime': 16.65 },
  spotify: { '1 Month': 2.2, '3 Months': 3.8, '6 Months': 6.2, '12 Months': 11.88 },
  'youtube-premium': { '1 Month': 1.6, '3 Months': 3.2, '6 Months': 5.5, '12 Months': 10.5 },
  disney: { '1 Month': 1.1, '3 Months': 2.7, '6 Months': 4.8, '12 Months': 9.5 },
  prime: { '1 Month': 1.8, '3 Months': 3.4, '6 Months': 5.8, '12 Months': 10.64 },
  hbomax: { '1 Month': 1.4, '3 Months': 3.1, '6 Months': 4.7, '12 Months': 9.8 },
  nordvpn: { '1 Month': 0.85, '3 Months': 2.0, '6 Months': 3.6, '12 Months': 6.9 },
  crunchy: { '1 Month': 0.9, '3 Months': 2.1, '6 Months': 3.8, '12 Months': 7.2 },
  nitro: { 'Boost 1m': 4.79, 'Boost 1 Year': 15.17, 'Basic 1m': 1.35 },
  chatgpt: { '1 Month': 3.2, '3 Months': 7.8, '6 Months': 11.88, '12 Months': 16.85 },
  capcut: { '1 Month': 1.2, '3 Months': 2.5, '6 Months': 4.2, '12 Months': 8.0 },
  geoguessr: { '1 Month': 2.0, '3 Months': 5.0, '12 Months': 10.0 },
  filmora: { '1 Month': 2.5, '3 Months': 6.0, '6 Months': 10.5, '12 Months': 16.0 },
};

function normalizePlan(raw){
  if(!raw) return raw; const key = raw.trim(); return key;
}

function validateAndPriceCart(cart){
  let totalUSD = 0;
  const normalized = [];
  for (const item of cart){
    if (!item.pid || !item.plan) throw new Error('Missing pid or plan');
    const table = PRICES_USD[item.pid];
    if (!table) throw new Error(`Unknown product: ${item.pid}`);
    const plan = normalizePlan(item.plan);
    const unit = table[plan];
    if (unit === undefined) throw new Error(`Unknown plan "${item.plan}" for ${item.pid}`);
    const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
    totalUSD += unit * qty;
    normalized.push({ pid: item.pid, plan, qty });
  }
  return { totalUSD: Number(totalUSD.toFixed(2)), items: normalized };
}

export default {
  async fetch(request, env){
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/crypto/now/create')) return new Response('Not Found', { status: 404 });

    try{
      const { cart, customerEmail, payCurrency } = await request.json();
      if (!Array.isArray(cart) || !cart.length) return new Response(JSON.stringify({ error: 'Empty cart' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      if (!customerEmail) return new Response(JSON.stringify({ error: 'Missing customerEmail' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      const { totalUSD, items } = validateAndPriceCart(cart);

      const apiKey = env.NOWPAYMENTS_API_KEY;
      if (!apiKey) throw new Error('Missing NOWPayments API key');

      // Map UI currency codes to NOWPayments API codes
      const currencyMap = {
        'usdcpoly': 'usdcmatic',
        'usdttrc20': 'usdttrx',
        'ltc': 'ltc',
        'btc': 'btc'
      };
      const mappedCurrency = currencyMap[payCurrency] || payCurrency || 'ltc';
      
      const orderId = 'np_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const body = {
        price_amount: totalUSD,
        price_currency: 'usd',
        pay_currency: mappedCurrency.toLowerCase(),
        ipn_callback_url: (env.APP_URL || 'https://plugmarket-api.laambedoor.workers.dev') + '/api/crypto/now/ipn',
        order_id: orderId,
        order_description: btoa(JSON.stringify({ cart: items, email: customerEmail }))
      };

      const res = await fetch('https://api.nowpayments.io/v1/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok || !data || !data.payment_id){
        const errMsg = data?.message || data?.error || 'Failed to create payment';
        return new Response(JSON.stringify({ error: errMsg, details: data }), { status: res.status || 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }

      // Return essentials to client
      const out = {
        paymentId: data.payment_id,
        payAddress: data.pay_address,
        payAmount: data.pay_amount,
        payCurrency: data.pay_currency,
        priceAmount: data.price_amount,
        orderId,
        status: data.payment_status
      };
      return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }catch(err){
      return new Response(JSON.stringify({ error: err.message || 'Failed' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
  }
};
