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

      // Get stock from stock table (for products like realmembers)
      const { data: stockData, error: stockError } = await supabase
        .from('stock')
        .select('product_key, quantity');

      // Get count of available accounts from accounts table
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('product_id, plan')
        .eq('status', 'available');

      if (stockError && accountsError) {
        console.error('Supabase errors:', { stockError, accountsError });
        return new Response(
          JSON.stringify({ 
            error: 'Failed to fetch stock', 
            details: stockError?.message || accountsError?.message
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

      // Build combined stock map
      const stockMap = {};
      
      // Add stock from stock table
      if (stockData && stockData.length > 0) {
        stockData.forEach(item => {
          stockMap[item.product_key] = item.quantity;
        });
      }

      // Add stock from accounts table
      if (accountsData && accountsData.length > 0) {
        accountsData.forEach(item => {
          const key = `${item.product_id}:${item.plan}`;
          stockMap[key] = (stockMap[key] || 0) + 1;
        });
      }

      return new Response(
        JSON.stringify({ 
          stock: stockMap,
          debug: {
            stockTableCount: stockData ? stockData.length : 0,
            accountsTableCount: accountsData ? accountsData.length : 0,
            totalProducts: Object.keys(stockMap).length
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
