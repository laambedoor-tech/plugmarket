/**
 * POST /api/paypal/email-hook
 * Called by Make.com when a PayPal "money received" email is detected.
 * Body: { reference, amount, currency, payerEmail, token }
 * Security: shared token via env.EMAIL_WEBHOOK_TOKEN
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
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('product_id', productId)
    .eq('plan', plan)
    .eq('status', 'available')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw new Error(`DB fetch error: ${error.message}`);
  if (!accounts || accounts.length === 0) throw new Error(`No available accounts for ${productId} - ${plan}`);
  const account = accounts[0];
  const { error: updateError } = await supabase
    .from('accounts')
    .update({ status: 'sold', sold_at: new Date().toISOString(), customer_email: customerEmail })
    .eq('id', account.id);
  if (updateError) throw new Error(`DB update error: ${updateError.message}`);
  const result = { email: account.email, password: account.password };
  if (account.chatgpt_password) result.chatgptPassword = account.chatgpt_password;
  if (account.chatgpt_code) result.chatgptCode = account.chatgpt_code;
  return result;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/paypal/email-hook')) return new Response('Not Found', { status: 404 });

    try {
      const { reference, amount, currency, payerEmail, token } = await request.json();
      if (!token || token !== env.EMAIL_WEBHOOK_TOKEN) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      if (!reference) {
        return new Response(JSON.stringify({ error: 'Missing reference' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }

      const supabase = getSupabase(env);
      const { data: orders, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_method', 'paypal_manual')
        .eq('status', 'pending_payment')
        .eq('reference', reference)
        .limit(1);
      if (fetchError) throw new Error(`Failed to fetch order: ${fetchError.message}`);
      if (!orders || orders.length === 0) {
        return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      const order = orders[0];
      
      // Optional amount/currency check with small tolerance
      const orderAmount = parseFloat(order.amount);
      const txAmount = parseFloat(amount || orderAmount);
      const amountMatch = Math.abs(orderAmount - txAmount) < 0.5;
      const currencyMatch = !currency || (String(order.currency || 'USD').toUpperCase() === String(currency).toUpperCase());
      if (!amountMatch || !currencyMatch) {
        return new Response(JSON.stringify({ error: 'Amount or currency mismatch' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }

      // Assign accounts
      const assignedAccounts = [];
      const items = order.items || [];
      for (const item of items) {
        const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
        for (let i = 0; i < qty; i++) {
          const credentials = await assignAccount(env, item.pid, item.plan, order.customer_email);
          const itemCreds = { email: credentials.email, password: credentials.password, pid: item.pid, plan: item.plan };
          if (credentials.chatgptPassword) itemCreds.chatgptPassword = credentials.chatgptPassword;
          if (credentials.chatgptCode) itemCreds.chatgptCode = credentials.chatgptCode;
          assignedAccounts.push(itemCreds);
        }
      }

      // Mark order completed
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'completed', completed_at: new Date().toISOString(), accounts: assignedAccounts })
        .eq('id', order.id);
      if (updateError) throw new Error(`Failed to update order: ${updateError.message}`);

      return new Response(JSON.stringify({ success: true, reference, accountsAssigned: assignedAccounts.length }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    } catch (error) {
      console.error('[PayPal Email Hook] Error:', error);
      return new Response(JSON.stringify({ error: error.message || 'Failed' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
  }
};
