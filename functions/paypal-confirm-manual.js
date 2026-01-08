/**
 * POST /api/paypal/confirm-manual
 * Admin endpoint to manually confirm a pending PayPal payment
 * Used when automatic detection doesn't work or for manual verification
 * 
 * Body: { reference: "PP-XXX-XXX", confirmCode: "admin_secret_code" }
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
  console.log(`[PayPal Manual Confirm] Searching for account: product_id="${productId}", plan="${plan}"`);
  
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
  if (!accounts || accounts.length === 0) {
    throw new Error(`No available accounts for ${productId} - ${plan}`);
  }
  
  const account = accounts[0];
  const { error: updateError } = await supabase
    .from('accounts')
    .update({ 
      status: 'sold', 
      sold_at: new Date().toISOString(), 
      customer_email: customerEmail 
    })
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
    
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/paypal/confirm-manual')) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      const { reference, confirmCode } = await request.json();
      
      if (!reference) {
        return new Response(JSON.stringify({ error: 'Missing reference' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      
      // Verify admin confirmation code
      const adminCode = env.ADMIN_CONFIRM_CODE;
      if (!adminCode || confirmCode !== adminCode) {
        return new Response(JSON.stringify({ error: 'Invalid confirmation code' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      
      const supabase = getSupabase(env);
      
      // Get the pending order
      const { data: orders, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('reference', reference)
        .eq('payment_method', 'paypal_manual')
        .eq('status', 'pending_payment')
        .limit(1);
        
      if (fetchError) {
        throw new Error(`Failed to fetch order: ${fetchError.message}`);
      }
      
      if (!orders || orders.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'Order not found or already processed' 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      
      const order = orders[0];
      
      // Assign accounts for each item
      const assignedAccounts = [];
      const items = order.items || [];
      
      for (const item of items) {
        const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
        console.log(`[PayPal Manual Confirm] Item ${item.pid} - ${item.plan} qty=${qty}`);
        
        for (let i = 0; i < qty; i++) {
          try {
            const credentials = await assignAccount(env, item.pid, item.plan, order.customer_email);
            console.log(`✅ [PayPal Manual Confirm] Assigned account (${i + 1}/${qty})`);
            
            const itemCreds = { 
              email: credentials.email, 
              password: credentials.password,
              pid: item.pid,
              plan: item.plan
            };
            if (credentials.chatgptPassword) itemCreds.chatgptPassword = credentials.chatgptPassword;
            if (credentials.chatgptCode) itemCreds.chatgptCode = credentials.chatgptCode;
            
            assignedAccounts.push(itemCreds);
          } catch (err) {
            console.error(`❌ [PayPal Manual Confirm] Failed (${i + 1}/${qty}):`, err.message);
            throw err;
          }
        }
      }
      
      // Update order status to completed
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          accounts: assignedAccounts,
          confirmed_manually: true
        })
        .eq('id', order.id);
        
      if (updateError) {
        throw new Error(`Failed to update order: ${updateError.message}`);
      }
      
      console.log(`✅ [PayPal Manual Confirm] Order ${reference} completed`);
      
      return new Response(JSON.stringify({
        success: true,
        reference: reference,
        accountsAssigned: assignedAccounts.length,
        customerEmail: order.customer_email
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
      
    } catch (error) {
      console.error('[PayPal Manual Confirm] Error:', error);
      return new Response(JSON.stringify({
        error: error.message || 'Failed to confirm payment'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
