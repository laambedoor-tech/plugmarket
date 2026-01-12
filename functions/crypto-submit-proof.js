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
  netflix: { '1 mes': 5.50, '1 Month':5.50, '3 meses': 9.99, '3 Months':9.99, '6 meses': 14, '6 Months':14, '12 meses': 22, '12 Months':22 },
  spotify: { '1 mes': 5, '1 Month':5, '6 meses': 12, '6 Months':12, '12 meses': 18, '12 Months':18 },
  disney: { '1 mes': 5, '1 Month':5, '6 meses': 12, '6 Months':12, '12 meses': 18, '12 Months':18 },
  hbo: { '1 mes': 5, '1 Month':5, '6 meses': 12, '6 Months':12, '12 meses': 18, '12 Months':18 },
  crunchyroll: { '1 mes': 5, '1 Month':5, '6 meses': 12, '6 Months':12, '12 meses': 18, '12 Months':18 },
  youtube: { '1 mes': 5, '1 Month':5, '6 meses': 12, '6 Months':12, '12 meses': 18, '12 Months':18 },
  discordpromocode: { '1 Month': 0.6, '3 Months': 1.05 },
  realmembers: { '[500]': 2.25, '[1000]': 4.25, '[2000]': 7.88, '[3000]': 11.63, '[4000]': 12.24, '[5000]': 15.61 },
  steamaccount: { 'Random Games': 0.25 },
  dazn: { 'Lifetime': 1.5 }
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
