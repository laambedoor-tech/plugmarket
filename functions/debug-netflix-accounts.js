/**
 * Debug endpoint to check Netflix accounts in database
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

    try {
      const supabase = getSupabase(env);

      // Get all Netflix accounts
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('id, product_id, plan, status, created_at')
        .or('product_id.ilike.%netflix%,plan.ilike.%netflix%')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
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

      // Count by product_id and plan
      const counts = {};
      accounts.forEach(acc => {
        const key = `${acc.product_id}:${acc.plan}:${acc.status}`;
        counts[key] = (counts[key] || 0) + 1;
      });

      return new Response(
        JSON.stringify({ 
          accounts,
          counts,
          total: accounts.length
        }),
        { 
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    } catch (error) {
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
