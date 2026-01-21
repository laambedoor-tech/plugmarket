import { createClient } from '@supabase/supabase-js';

function getSupabase(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

async function assignAccounts(env, productId, plan, quantity, customerEmail) {
  const supabase = getSupabase(env);
  const { data: accounts, error } = await supabase
    .from('accounts').select('*').eq('product_id', productId).eq('plan', plan).eq('status', 'available').order('created_at', { ascending: true }).limit(quantity);
  if (error) throw new Error(`DB fetch error: ${error.message}`);
  if (!accounts || accounts.length === 0) throw new Error(`No available accounts for ${productId} - ${plan}`);
  const accountIds = accounts.map(a => a.id);
  const { error: updateError } = await supabase.from('accounts').update({ status: 'sold', sold_at: new Date().toISOString(), customer_email: customerEmail }).in('id', accountIds);
  if (updateError) throw new Error(`DB update error: ${updateError.message}`);
  return accounts.map(account => {
    const result = { email: account.email, password: account.password };
    if (account.chatgpt_password) result.chatgptPassword = account.chatgpt_password;
    if (account.chatgpt_code) result.chatgptCode = account.chatgpt_code;
    return result;
  });
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    try {
      const body = await request.json();
      const { email, total_cents, payment_reference, items } = body;
      if (!email || !total_cents || !payment_reference || !items || items.length === 0) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      const customerEmail = email.toLowerCase().trim();
      const supabase = getSupabase(env);
      const { data: existingOrders } = await supabase.from('orders').select('id').eq('payment_intent_id', payment_reference);
      if (existingOrders && existingOrders.length > 0) {
        return new Response(JSON.stringify({ error: 'Order already exists', order_id: existingOrders[0].id }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      const orderItems = [];
      for (const item of items) {
        const qty = Number(item.qty) || 1;
        const credentials = await assignAccounts(env, item.pid, item.plan, qty, customerEmail);
        credentials.forEach(cred => {
          orderItems.push({ pid: item.pid, name: item.pid, plan: item.plan, unitAmount: Math.floor(total_cents / qty), credentials: cred });
        });
      }
      if (orderItems.length === 0) {
        return new Response(JSON.stringify({ error: 'No items could be assigned' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      const { data: orders, error: orderError } = await supabase.from('orders').insert({ customer_email: customerEmail, payment_intent_id: payment_reference, total_cents: total_cents, items: orderItems }).select();
      if (orderError) throw new Error(`Failed to create order: ${orderError.message}`);
      return new Response(JSON.stringify({ success: true, order_id: orders[0].id, items_assigned: orderItems.length, customer_email: customerEmail, total_cents: total_cents }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
  }
};
