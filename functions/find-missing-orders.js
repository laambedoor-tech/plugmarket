/**
 * Find payments that didn't create orders
 * Searches balance transactions and payment intents
 */

import { createClient } from '@supabase/supabase-js';

function getSupabase(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(url, key);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const days = parseInt(url.searchParams.get('days') || '7');

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email parameter required' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    try {
      const supabase = getSupabase(env);
      const normalizedEmail = email.toLowerCase().trim();
      
      // Get date range
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      
      console.log(`🔍 Searching for missing orders for: ${normalizedEmail}`);

      // 1. Get all orders for this email
      const { data: orders } = await supabase
        .from('orders')
        .select('id, customer_email, total_cents, payment_intent_id, created_at, items')
        .eq('customer_email', normalizedEmail)
        .gte('created_at', sinceDate.toISOString())
        .order('created_at', { ascending: false });

      console.log(`📦 Found ${orders?.length || 0} orders`);

      // 2. Get all balance transactions for this email
      const { data: transactions } = await supabase
        .from('balance_transactions')
        .select('*')
        .eq('user_email', normalizedEmail)
        .gte('created_at', sinceDate.toISOString())
        .order('created_at', { ascending: false });

      console.log(`💰 Found ${transactions?.length || 0} balance transactions`);

      // 3. Find transactions without matching orders
      const transactionsWithoutOrders = transactions?.filter(txn => {
        if (txn.type !== 'purchase') return false;
        
        // Extract order ID from description
        const orderIdMatch = txn.description?.match(/Order #(\S+)/);
        if (!orderIdMatch) return true; // Transaction without order reference
        
        const orderId = orderIdMatch[1];
        const hasOrder = orders?.some(o => o.id === orderId);
        return !hasOrder;
      }) || [];

      console.log(`⚠️ Found ${transactionsWithoutOrders.length} transactions without orders`);

      // 4. Check for any payment_intent_ids that might be orphaned
      const allPaymentIntents = orders?.map(o => o.payment_intent_id).filter(Boolean) || [];
      
      return new Response(
        JSON.stringify({
          email: normalizedEmail,
          period: {
            from: sinceDate.toISOString(),
            to: new Date().toISOString(),
            days
          },
          summary: {
            total_orders: orders?.length || 0,
            total_transactions: transactions?.length || 0,
            transactions_without_orders: transactionsWithoutOrders.length
          },
          orders: orders?.map(o => ({
            id: o.id,
            created_at: o.created_at,
            total_cents: o.total_cents,
            payment_intent_id: o.payment_intent_id,
            items: o.items?.map(i => ({
              pid: i.pid,
              plan: i.plan
            }))
          })),
          balance_transactions: transactions?.map(t => ({
            id: t.id,
            created_at: t.created_at,
            type: t.type,
            amount: t.amount,
            description: t.description,
            payment_method: t.payment_method
          })),
          orphaned_transactions: transactionsWithoutOrders.map(t => ({
            id: t.id,
            created_at: t.created_at,
            amount: t.amount,
            description: t.description,
            payment_method: t.payment_method
          }))
        }, null, 2),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );

    } catch (error) {
      console.error('Error finding missing orders:', error);
      return new Response(
        JSON.stringify({ 
          error: error.message,
          stack: error.stack 
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }
};
