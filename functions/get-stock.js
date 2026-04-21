/**
 * Cloudflare Workers: Get Stock Status
 * Routes: GET /api/get-stock
 * Returns stock availability for all products/plans
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
    if (!url.pathname.startsWith('/api/get-stock')) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      const supabase = getSupabase(env);

      // Get count of available accounts grouped by product_id and plan
      const { data: stock, error } = await supabase
        .from('accounts')
        .select('product_id, plan')
        .eq('status', 'available');

      if (error) {
        console.error('Supabase error:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to fetch stock', 
            details: error.message,
            hint: error.hint 
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

      // Count stock for each product/plan combination
      const stockMap = {};
      
      if (stock && stock.length > 0) {
        stock.forEach(item => {
          const key = `${item.product_id}:${item.plan}`;
          stockMap[key] = (stockMap[key] || 0) + 1;
        });
      }

      return new Response(
        JSON.stringify({ 
          stock: stockMap,
          debug: {
            count: stock ? stock.length : 0,
            hasData: !!stock
          }
        }),
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
      console.error('Error fetching stock:', error);
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
