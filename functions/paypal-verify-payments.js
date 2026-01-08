/**
 * GET/POST /api/paypal/verify-payments
 * Checks PayPal account for new transactions and automatically processes pending orders
 * Can be called manually or via scheduled cron job
 * Uses PayPal Transaction Search API to find payments with matching reference notes
 */

import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'node:buffer';

function getSupabase(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

function encodeBasicAuth(id, secret){
  const pair = `${id}:${secret}`;
  try {
    return btoa(pair);
  } catch {
    return Buffer.from(pair).toString('base64');
  }
}

async function getAccessToken(env){
  const base = (env.PAYPAL_ENV || 'sandbox') === 'live' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';
  const clientId = env.PAYPAL_CLIENT_ID;
  const secret = env.PAYPAL_SECRET;
  if (!clientId || !secret) throw new Error('Missing PayPal credentials');
  const creds = encodeBasicAuth(clientId, secret);
  const res = await fetch(base + '/v1/oauth2/token', {
    method: 'POST',
    headers: { 
      'Authorization': `Basic ${creds}`, 
      'Content-Type': 'application/x-www-form-urlencoded' 
    },
    body: 'grant_type=client_credentials'
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error || 'Failed to get PayPal token');
  return { token: json.access_token, base };
}

async function assignAccount(env, productId, plan, customerEmail) {
  const supabase = getSupabase(env);
  console.log(`[PayPal Auto] Searching for account: product_id="${productId}", plan="${plan}"`);
  
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

async function completeOrder(env, order) {
  const supabase = getSupabase(env);
  
  console.log(`[PayPal Auto] Processing order ${order.reference} for ${order.customer_email}`);
  
  // Assign accounts for each item
  const assignedAccounts = [];
  const items = order.items || [];
  
  for (const item of items) {
    const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
    console.log(`[PayPal Auto] Item ${item.pid} - ${item.plan} qty=${qty}`);
    
    for (let i = 0; i < qty; i++) {
      try {
        const credentials = await assignAccount(env, item.pid, item.plan, order.customer_email);
        console.log(`✅ [PayPal Auto] Assigned account (${i + 1}/${qty}) for ${item.pid} - ${item.plan}`);
        
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
        console.error(`❌ [PayPal Auto] Failed to assign account (${i + 1}/${qty}):`, err.message);
        if (String(err.message).includes('No available accounts')) {
          console.warn(`[PayPal Auto] Stock exhausted for ${item.pid} - ${item.plan}. Assigned ${i} of ${qty}.`);
          break;
        }
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
      accounts: assignedAccounts
    })
    .eq('id', order.id);
    
  if (updateError) {
    console.error('[PayPal Auto] Failed to update order status:', updateError);
    throw new Error(`Failed to update order: ${updateError.message}`);
  }
  
  console.log(`✅ [PayPal Auto] Order ${order.reference} completed successfully`);
  return assignedAccounts;
}

async function searchTransactions(env, startDate) {
  const { token, base } = await getAccessToken(env);
  
  // Search transactions from the last hours
  const endDate = new Date().toISOString();
  
  // Build query parameters
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    fields: 'all',
    page_size: '100' // Max allowed
  });
  
  const url = `${base}/v1/reporting/transactions?${params}`;
  
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!res.ok) {
    const error = await res.text();
    console.error('[PayPal Auto] Transaction search failed:', error);
    throw new Error(`PayPal API error: ${res.status}`);
  }
  
  const data = await res.json();
  return data.transaction_details || [];
}

// Extract reference code from transaction (note, memo, or custom field)
function extractReference(transaction) {
  const info = transaction.transaction_info || {};
  
  // Check various fields where the reference might be
  const possibleFields = [
    info.custom_field,
    info.invoice_id,
    info.paypal_reference_id,
    transaction.cart_info?.item_details?.[0]?.item_description
  ];
  
  for (const field of possibleFields) {
    if (field && typeof field === 'string') {
      // Look for our reference pattern PP-XXXXX-XXXXX
      const match = field.match(/PP-[A-Z0-9]+-[A-Z0-9]+/);
      if (match) return match[0];
    }
  }
  
  return null;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/paypal/verify-payments')) {
      return new Response('Not Found', { status: 404 });
    }
    
    try {
      const supabase = getSupabase(env);
      
      // Get pending orders
      const { data: pendingOrders, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_method', 'paypal_manual')
        .eq('status', 'pending_payment')
        .order('created_at', { ascending: true });
        
      if (fetchError) {
        throw new Error(`Failed to fetch pending orders: ${fetchError.message}`);
      }
      
      if (!pendingOrders || pendingOrders.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'No pending orders to verify',
          processed: 0
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      
      console.log(`[PayPal Auto] Found ${pendingOrders.length} pending orders`);
      
      // Search PayPal transactions from the last 24 hours
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const transactions = await searchTransactions(env, startDate);
      
      console.log(`[PayPal Auto] Found ${transactions.length} PayPal transactions in last 24h`);
      
      const processed = [];
      const errors = [];
      
      // Match transactions with pending orders
      for (const order of pendingOrders) {
        try {
          const orderRef = order.reference;
          
          // Find matching transaction
          const matchingTx = transactions.find(tx => {
            const txRef = extractReference(tx);
            if (txRef === orderRef) {
              // Verify amount matches (with small tolerance for currency conversion)
              const txAmount = parseFloat(tx.transaction_info?.transaction_amount?.value || '0');
              const orderAmount = parseFloat(order.amount);
              const amountMatch = Math.abs(txAmount - orderAmount) < 0.5;
              
              // Verify it's completed
              const status = tx.transaction_info?.transaction_status;
              const isCompleted = status === 'S' || status === 'SUCCESS' || status === 'COMPLETED';
              
              return amountMatch && isCompleted;
            }
            return false;
          });
          
          if (matchingTx) {
            console.log(`[PayPal Auto] Found matching payment for order ${orderRef}`);
            
            // Complete the order
            const accounts = await completeOrder(env, order);
            
            processed.push({
              reference: orderRef,
              email: order.customer_email,
              accountsAssigned: accounts.length,
              transactionId: matchingTx.transaction_info?.transaction_id
            });
          }
        } catch (error) {
          console.error(`[PayPal Auto] Error processing order ${order.reference}:`, error);
          errors.push({
            reference: order.reference,
            error: error.message
          });
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        processed: processed.length,
        orders: processed,
        errors: errors.length > 0 ? errors : undefined,
        totalPending: pendingOrders.length,
        transactionsChecked: transactions.length
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
      
    } catch (error) {
      console.error('[PayPal Auto] Verification error:', error);
      return new Response(JSON.stringify({
        error: error.message || 'Failed to verify payments'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
