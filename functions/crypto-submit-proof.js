// Record a pending crypto payment for manual verification

async function insertOrder(env, payload){
  const url = `${env.SUPABASE_URL}/rest/v1/orders`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok){
    let msg = 'DB insert failed';
    try { const j = await res.json(); msg = j.message || JSON.stringify(j); } catch {}
    throw new Error(msg);
  }
  return res.json();
}

const PRICES_USD = {
  boosts: { '3 Months': 5.25 },
  netflix: { '1 mes': 1.5, '1 Month':1.5, '3 meses': 3.5, '3 Months':3.5, '6 meses': 6.0, '6 Months':6.0, '12 meses': 11.0, '12 Months':11.0, 'Lifetime': 1.10, 'FA': 8.50 },
  spotify: { '1 mes': 2.2, '1 Month':2.2, '6 meses': 6.2, '6 Months':6.2, '12 meses': 11.88, '12 Months':11.88, 'Lifetime': 2.70 },
  disney: { '1 mes': 1.1, '1 Month':1.1, '6 meses': 4.8, '6 Months':4.8, '12 meses': 9.5, '12 Months':9.5, 'Lifetime': 0.89 },
  'youtube-premium': { 'Lifetime': 2.27, 'fowner': 4.74 },
  hbo: { '1 mes': 1.4, '1 Month':1.4, '6 meses': 4.7, '6 Months':4.7, '12 meses': 9.8, '12 Months':9.8, 'Lifetime': 13.0 },
  crunchyroll: { '1 mes': 0.9, '1 Month':0.9, '6 meses': 3.8, '6 Months':3.8, '12 meses': 7.2, '12 Months':7.2, 'Lifetime': 1.05 },
  youtube: { '1 mes': 1.6, '1 Month':1.6, '6 meses': 5.5, '6 Months':5.5, '12 meses': 10.5, '12 Months':10.5, 'Lifetime': 2.27 },
  prime: { 'Lifetime': 14.0 },
  nordvpn: { 'Lifetime': 1.46 },
  capcut: { 'Lifetime': 2.35 },
  geoguessr: { 'Lifetime': 0.81 },
  filmora: { 'Lifetime': 7.29 },
  duolingo: { '12 Months': 1.24, 'Lifetime': 1.62 },
  movistar: { '12 Months': 2.44, 'Lifetime': 2.92 },
  discordpromocode: { '1 Month': 0.6, '3 Months': 1.05, 'Boost 1m': 4.00, 'Boost 3m': 15.0 },
  realmembers: { '[500]': 2.25, '[1000]': 4.25, '[2000]': 7.88, '[3000]': 11.63, '[4000]': 12.24, '[5000]': 15.61 },
  steamaccount: { 'Random Games': 0.25 },
  dazn: { 'Lifetime': 1.5 },
  microsoft: { 'Random Codes': 0.40 },
  rockstar: { 'Activation Code': 0.25 },
  minecraft: { 'NFA Lifetime': 1.00, 'FA Lifetime': 4.50 },
  stake: { 'Level 2 Verified': 0.60 },
  xbox: { 'Game Pass Lifetime': 0.60 },
  gemini: { '1 Month': 1.75, '6 Months': 7.30 }
};

function validateAndPriceCart(cart){
  if (!Array.isArray(cart) || !cart.length) throw new Error('Cart is empty');
  let total = 0;
  for (const item of cart){
    const { pid, plan, qty } = item || {};
    if (!pid || !plan || !qty) throw new Error('Invalid cart item');
    const product = PRICES_USD[pid];
    if (!product) throw new Error(`Unknown product: ${pid}`);
    const unit = product[plan];
    if (!unit) throw new Error(`Unknown plan ${plan} for ${pid}`);
    total += unit * qty;
  }
  return { totalUSD: Number(total.toFixed(2)) };
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    try{
      const { cart, customerEmail, txHash, token, network, amount } = await request.json();
      const { totalUSD } = validateAndPriceCart(cart);
      const cartItems = cart.map(i => ({ pid: i.pid, plan: i.plan, qty: i.qty }));
      const items = [
        { type: 'cart', items: cartItems },
        { type: 'crypto', token: (token||'').toUpperCase(), network: network || null, txHash: txHash || null, paidAmount: amount || null }
      ];
      const payload = {
        customer_email: customerEmail,
        payment_intent_id: txHash || 'crypto-manual',
        total_cents: Math.round(totalUSD * 100),
        items
      };
      await insertOrder(env, payload);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }catch(err){
      return new Response(JSON.stringify({ error: err.message || 'Failed to record payment' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  }
};
