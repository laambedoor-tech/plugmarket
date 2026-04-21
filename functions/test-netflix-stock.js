/**
 * Test Script: Check Netflix Stock in Database
 * Route: GET /api/test-netflix-stock
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
    // Handle CORS
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

    try {
      const supabase = getSupabase(env);

      // Get all Netflix accounts
      const { data: netflixAccounts, error: netflixError } = await supabase
        .from('accounts')
        .select('*')
        .eq('product_id', 'netflix')
        .order('plan', { ascending: true })
        .order('status', { ascending: true });

      // Get all available accounts grouped by product and plan
      const { data: allAvailable, error: availableError } = await supabase
        .from('accounts')
        .select('product_id, plan, status')
        .eq('status', 'available')
        .order('product_id', { ascending: true })
        .order('plan', { ascending: true });

      // Count by plan
      const netflixByPlan = {};
      if (netflixAccounts) {
        netflixAccounts.forEach(acc => {
          const key = `${acc.plan} (${acc.status})`;
          netflixByPlan[key] = (netflixByPlan[key] || 0) + 1;
        });
      }

      // Count all available by product:plan
      const availableByProduct = {};
      if (allAvailable) {
        allAvailable.forEach(acc => {
          const key = `${acc.product_id}:${acc.plan}`;
          availableByProduct[key] = (availableByProduct[key] || 0) + 1;
        });
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          netflix: {
            total: netflixAccounts ? netflixAccounts.length : 0,
            byPlan: netflixByPlan,
            sample: netflixAccounts ? netflixAccounts.slice(0, 3) : []
          },
          allAvailable: {
            total: allAvailable ? allAvailable.length : 0,
            byProductPlan: availableByProduct,
            sample: allAvailable ? allAvailable.slice(0, 10) : []
          },
          errors: {
            netflix: netflixError ? netflixError.message : null,
            available: availableError ? availableError.message : null
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
      console.error('Error:', error);
      return new Response(
        JSON.stringify({ 
          error: error.message,
          stack: error.stack 
        }, null, 2),
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
