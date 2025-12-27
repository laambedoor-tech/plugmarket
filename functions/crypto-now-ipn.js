/**
 * POST /api/crypto/now/ipn
 * NOWPayments IPN webhook: verify signature, fulfill order, save to Supabase.
 */

import { createClient } from '@supabase/supabase-js';

function getSupabase(env){
  const url = env.SUPABASE_URL; const key = env.SUPABASE_ANON_KEY; if(!url || !key) throw new Error('Missing Supabase credentials'); return createClient(url, key);
}

async function assignAccount(env, productId, plan, customerEmail){
  const supabase = getSupabase(env);
  const { data: accounts, error: fetchError } = await supabase
    .from('accounts')
    .select('*')
    .eq('product_id', productId)
    .eq('plan', plan)
    .eq('status', 'available')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1);
  if (fetchError) throw new Error(`DB fetch error: ${fetchError.message}`);
  if (!accounts || accounts.length === 0) throw new Error(`No available accounts for ${productId} - ${plan}`);
  const account = accounts[0];
  const { error: updateError } = await supabase
    .from('accounts')
    .update({ status: 'sold', sold_at: new Date().toISOString(), customer_email: customerEmail })
    .eq('id', account.id);
  if (updateError) throw new Error(`DB update error: ${updateError.message}`);
  return { email: account.email, password: account.password };
}

async function hmacSHA512(key, message){
  const imp = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', imp, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env){
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const url = new URL(request.url); if (!url.pathname.startsWith('/api/crypto/now/ipn')) return new Response('Not Found', { status: 404 });

    const secret = env.NOWPAYMENTS_IPN_SECRET; if(!secret) return new Response('Missing IPN secret', { status: 500 });
    const raw = await request.text();
    const headerSig = request.headers.get('x-nowpayments-sig') || request.headers.get('X-NOWPayments-Sig');
    const calc = await hmacSHA512(secret, raw);
    if (!headerSig || headerSig.toLowerCase() !== calc) {
      return new Response('invalid signature', { status: 400 });
    }

    let payload; try { payload = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }

    // Only act on confirmed/finished
    const status = (payload.payment_status || '').toLowerCase();
    if (!['confirmed','finished'].includes(status)) {
      return new Response('ok');
    }

    const paymentId = payload.payment_id;
    const orderId = payload.order_id;
    let meta = null;
    try {
      meta = JSON.parse(atob(payload.order_description || ''));
    } catch {}
    const items = meta?.cart || [];
    const customerEmail = meta?.email || '';
    if (!customerEmail || !Array.isArray(items) || !items.length) {
      // Cannot fulfill without metadata
      return new Response('missing metadata', { status: 200 });
    }

    // Assign accounts per item and save order
    try {
      const fulfilled = [];
      for (const item of items){
        const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
        for (let i=0;i<qty;i++){
          try {
            const creds = await assignAccount(env, item.pid, item.plan, customerEmail);
            fulfilled.push({ pid: item.pid, plan: item.plan, credentials: { email: creds.email, password: creds.password } });
          } catch (err) {
            // Stop when stock exhausted for that item
            if (String(err.message).includes('No available accounts')) break;
          }
        }
      }

      const supabase = getSupabase(env);
      const totalCents = Math.round(Number(payload.price_amount || 0) * 100);
      const { error: orderError } = await supabase
        .from('orders')
        .insert({ customer_email: customerEmail, payment_intent_id: String(paymentId || orderId), total_cents: totalCents, items: fulfilled });
      if (orderError) {
        console.error('[NOW] Failed to save order:', orderError.message);
      }
    } catch (err){
      console.error('[NOW] Fulfillment error:', err.message);
    }

    return new Response('ok');
  }
};
