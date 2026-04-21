/**
 * Cloudflare Workers: Get Orders
 * Routes: GET /api/get-orders?email=user@example.com
 *         GET /api/get-orders (returns all orders for admin)
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

    try {
      const supabase = getSupabase(env);

      let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      // Si se proporciona email, filtrar por ese email
      // Si NO se proporciona, devolver todas las órdenes (para admin)
      if (email) {
        const normalizedEmail = email.toLowerCase().trim();
        query = query.eq('customer_email', normalizedEmail);
      }

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
