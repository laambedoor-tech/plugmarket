/**
 * Manually create order with provided data
 * POST /api/manual-create-order
 * Body: {
 *   email: "user@example.com",
 *   total_cents: 1350,
 *   payment_reference: "pi_xxx or manual_ref",
 *   items: [{ pid: "netflix", plan: "Bulk", qty: 25 }]
 * }
 */

import { createClient } from '@supabase/supabase-js';

function getSupabase(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

async function assignAccounts(env, productId, plan, quantity, customerEmail) {
  const supabase = getSupabase(env);
  
  // Get multiple accounts in one query
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('product_id', productId)
    .eq('plan', plan)
    .eq('status', 'available')
    .order('created_at', { ascending: true })
    .limit(quantity);
  
  if (error) throw new Error(`DB fetch error: ${error.message}`);
  if (!accounts || accounts.length === 0) throw new Error(`No available accounts for ${productId} - ${plan}`);
  
  // Update all accounts at once
  const accountIds = accounts.map(a => a.id);
  const { error: updateError } = await supabase
    .from('accounts')
    .update({ 
      status: 'sold', 
      sold_at: new Date().toISOString(), 
      customer_email: customerEmail 
    })
    .in('id', accountIds);
  
  if (updateError) throw new Error(`DB update error: ${updateError.message}`);
  
  // Return credentials
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
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    try {
      const body = await request.json();
      const { email, total_cents, payment_reference, items } = body;
      
      if (!email || !total_cents || !payment_reference || !items || items.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'Missing required fields: email, total_cents, payment_reference, items' 
        }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const customerEmail = email.toLowerCase().trim();

      const supabase = getSupabase(env);
      const { data: existingOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('payment_intent_id', payment_reference);

      if (existingOrders && existingOrders.length > 0) {
        return new Response(JSON.stringify({ 
          error: 'Order with this payment reference already exists',
          order_id: existingOrders[0].id
        }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const orderItems = [];
      
      for (const item of items) {
        const qty = Number(item.qty) || 1;
        const credentials = await assignAccounts(env, item.pid, item.plan, qty, customerEmail);
        
        credentials.forEach(cred => {
          orderItems.push({
            pid: item.pid,
            name: item.pid,
            plan: item.plan,
            unitAmount: Math.floor(total_cents / qty),
            credentials: cred
          });
        });
      }

      if (orderItems.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'No items could be assigned - check stock availability' 
        }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // Create order
      const { data: orders, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_email: customerEmail,
          payment_intent_id: payment_reference,
          total_cents: total_cents,
          items: orderItems
        })
        .select();

      if (orderError) {
        throw new Error(`Failed to create order: ${orderError.message}`);
      }

      console.log(`✅ Order created: ${orders[0].id}`);
      console.log(`📊 Assigned ${orderItems.length} items`);

      return new Response(JSON.stringify({
        success: true,
        order_id: orders[0].id,
        items_assigned: orderItems.length,
        items_requested: items.reduce((sum, item) => sum + (item.qty || 1), 0),
        customer_email: customerEmail,
        total_cents: total_cents,
        message: orderItems.length < items.reduce((sum, item) => sum + (item.qty || 1), 0)
          ? 'Some items could not be assigned due to insufficient stock'
          : 'All items assigned successfully'
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
      return new Response(JSON.stringify({
        success: true,
        order_id: orders[0].id,
        items_assigned: orderItems.length,
        customer_email: customerEmail,
        total_cents: total_cents
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error.message