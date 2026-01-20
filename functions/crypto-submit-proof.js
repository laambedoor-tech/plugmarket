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
  netflix: { '1 mes': 1.5, '1 Month':1.5, '3 meses': 3.5, '3 Months':3.5, '6 meses': 6.0, '6 Months':6.0, '12 meses': 11.0, '12 Months':11.0, 'Lifetime': 16.65 },
  spotify: { '1 mes': 2.2, '1 Month':2.2, '6 meses': 6.2, '6 Months':6.2, '12 meses': 11.88, '12 Months':11.88, 'Lifetime': 22.0 },
  disney: { '1 mes': 1.1, '1 Month':1.1, '6 meses': 4.8, '6 Months':4.8, '12 meses': 9.5, '12 Months':9.5, 'Lifetime': 15.0 },
  'youtube-premium': { 'Lifetime': 20.0 },
  hbo: { '1 mes': 1.4, '1 Month':1.4, '6 meses': 4.7, '6 Months':4.7, '12 meses': 9.8, '12 Months':9.8, 'Lifetime': 13.0 },
  crunchyroll: { '1 mes': 0.9, '1 Month':0.9, '6 meses': 3.8, '6 Months':3.8, '12 meses': 7.2, '12 Months':7.2, 'Lifetime': 16.0 },
  youtube: { '1 mes': 1.6, '1 Month':1.6, '6 meses': 5.5, '6 Months':5.5, '12 meses': 10.5, '12 Months':10.5, 'Lifetime': 20.0 },
  prime: { 'Lifetime': 14.0 },
  nordvpn: { 'Lifetime': 17.0 },
  capcut: { 'Lifetime': 35.0 },
  geoguessr: { 'Lifetime': 14.0 },
  filmora: { 'Lifetime': 172.0 },
  duolingo: { '12 Months': 1.24, 'Lifetime': 2.2 },
  movistar: { '12 Months': 2.44, 'Lifetime': 49.5 },
  discordpromocode: { '1 Month': 0.6, '3 Months': 1.05, 'Boost 1m': 4.95, 'Boost 3m': 15.0 },
  realmembers: { '[500]': 2.25, '[1000]': 4.25, '[2000]': 7.88, '[3000]': 11.63, '[4000]': 12.24, '[5000]': 15.61 },
  steamaccount: { 'Random Games': 0.25 },
  dazn: { 'Lifetime': 1.5 },
  microsoft: { 'Random Codes': 0.40 },
  rockstar: { 'Activation Code': 0.25 },
  minecraft: { 'NFA Lifetime': 1.00, 'FA Lifetime': 4.50 },
  stake: { 'Level 2 Verified': 0.60 },
  xbox: { 'Game Pass Lifetime': 0.60 }
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
