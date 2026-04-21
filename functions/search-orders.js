/**
 * Search orders by product or date - for debugging
 * GET /api/search-orders?product=netflix&days=7
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
    // Handle CORS preflight
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
    const product = url.searchParams.get('product'); // e.g., "netflix"
    const days = parseInt(url.searchParams.get('days') || '7');
    const email = url.searchParams.get('email');

    try {
      const supabase = getSupabase(env);
      
      // Get orders from last N days
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      
      let query = supabase
        .from('orders')
        .select('*')
        .gte('created_at', sinceDate.toISOString())
        .order('created_at', { ascending: false });

      const { data: orders, error } = await query;

      if (error) {
        console.error('Supabase error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch orders' }),
          { 
            status: 500, 
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Filter by product if specified
      let filteredOrders = orders || [];
      if (product) {
        filteredOrders = filteredOrders.filter(order => {
          const items = order.items || [];
          return items.some(item => 
            item.pid && item.pid.toLowerCase().includes(product.toLowerCase())
          );
        });
      }

      // Filter by email if specified
      if (email) {
        const normalizedEmail = email.toLowerCase().trim();
        filteredOrders = filteredOrders.filter(order => 
          order.customer_email && order.customer_email.toLowerCase().trim() === normalizedEmail
        );
      }

      // Format response
      const results = filteredOrders.map(order => ({
        id: order.id,
        customer_email: order.customer_email,
        total_cents: order.total_cents,
        created_at: order.created_at,
        payment_intent_id: order.payment_intent_id,
        items: order.items?.map(item => ({
          pid: item.pid,
          plan: item.plan,
          qty: item.qty || 1
        }))
      }));

      return new Response(
        JSON.stringify({ 
          orders: results,
          count: results.length,
          filters: {
            product,
            days,
            email,
            since: sinceDate.toISOString()
          }
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
      console.error('Error searching orders:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
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
