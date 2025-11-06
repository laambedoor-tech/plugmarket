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
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      const supabase = getSupabase(env);

      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_email', email.toLowerCase().trim())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch orders' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ orders: orders || [] }),
        { 
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        }
      );
    } catch (error) {
      console.error('Error fetching orders:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
};
