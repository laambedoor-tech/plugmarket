/**
 * POST /api/paypal/capture-order
 * Body: { orderId, cart, customerEmail }
 * After capturing the PayPal order, assigns accounts and saves the order to Supabase
 */

import { createClient } from '@supabase/supabase-js';

function getSupabase(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

async function assignAccount(env, productId, plan, customerEmail) {
  const supabase = getSupabase(env);
  console.log(`[PayPal] Searching for account: product_id="${productId}", plan="${plan}"`);
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
    if (!url.pathname.startsWith('/api/paypal/capture-order')) return new Response('Not Found', { status: 404 });
    try {
      const { orderId, cart, customerEmail } = await request.json();
      if (!orderId) return new Response(JSON.stringify({ error: 'Missing orderId' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      if (!cart || !Array.isArray(cart) || !cart.length) return new Response(JSON.stringify({ error: 'Missing cart' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      if (!customerEmail) return new Response(JSON.stringify({ error: 'Missing customerEmail' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

      const { token, base } = await getAccessToken(env);
      const res = await fetch(base + `/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) return new Response(JSON.stringify({ error: data.message || 'Capture failed' }), { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

      console.log('[PayPal] Capture succeeded:', orderId);

      // Assign accounts and build order
      const orderItems = [];
      for (const item of cart) {
        const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
        console.log(`[PayPal] Item ${item.pid} - ${item.plan} requested qty=${qty}`);
        for (let i = 0; i < qty; i++) {
          try {
            const credentials = await assignAccount(env, item.pid, item.plan, customerEmail);
            console.log(`✅ [PayPal] Assigned account (${i + 1}/${qty}) for ${item.pid} - ${item.plan} to ${customerEmail}`);
            orderItems.push({ pid: item.pid, plan: item.plan, credentials: { email: credentials.email, password: credentials.password } });
          } catch (err) {
            console.error(`❌ [PayPal] Failed to assign account (${i + 1}/${qty}) for ${item.pid}:`, err.message);
            if (String(err.message).includes('No available accounts')) {
              console.warn(`[PayPal] Stock exhausted for ${item.pid} - ${item.plan}. Assigned ${i} of ${qty}.`);
              break;
            }
          }
        }
      }

      // Save order to Supabase
      if (orderItems.length > 0) {
        const supabase = getSupabase(env);
        const totalCents = data.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value ? Math.round(parseFloat(data.purchase_units[0].payments.captures[0].amount.value) * 100) : 0;
        const { error: orderError } = await supabase
          .from('orders')
          .insert({
            customer_email: customerEmail,
            payment_intent_id: orderId,
            total_cents: totalCents,
            items: orderItems
          });
        if (orderError) {
          console.error('[PayPal] Failed to save order:', orderError.message);
        } else {
          console.log(`✅ [PayPal] Order saved for ${customerEmail} with ${orderItems.length} item(s)`);
        }
      }

      return new Response(JSON.stringify({ status: 'captured', order: data }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    } catch (err){
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
  }
};
