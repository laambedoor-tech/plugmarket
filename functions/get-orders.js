/**
 * Cloudflare Workers: Get Orders
 * Routes: GET /api/get-orders?email=user@example.com
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
    if (!url.pathname.startsWith('/api/get-orders')) {
      return new Response('Not Found', { status: 404 });
    }

    const email = url.searchParams.get('email');
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Missing email parameter' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`🔍 [get-orders] Raw email: "${email}"`);
    console.log(`🔍 [get-orders] Normalized email: "${normalizedEmail}"`);

    try {
      const supabase = getSupabase(env);

      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_email', normalizedEmail)
        .order('created_at', { ascending: false });

      console.log(`📦 [get-orders] Found ${orders?.length || 0} orders for "${normalizedEmail}"`);
      console.log(`📝 [get-orders] Orders:`, JSON.stringify(orders?.map(o => ({
        id: o.id?.slice(0, 8),
        email: o.customer_email,
        total: o.total_cents,
        items: o.items?.map(i => i.pid).join(', ')
      })), null, 2));
      
      // Also fetch recent orders to compare
      const { data: recentOrders } = await supabase
        .from('orders')
        .select('id, customer_email, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      
      console.log(`📋 [get-orders] Recent 10 orders in DB:`, JSON.stringify(recentOrders?.map(o => ({
        id: o.id?.slice(0, 8),
        email: o.customer_email,
        created: o.created_at
      })), null, 2));

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

      return new Response(
        JSON.stringify({ orders: orders || [] }),
        { 
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        }
      );
    } catch (error) {
      console.error('Error fetching orders:', error);
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
