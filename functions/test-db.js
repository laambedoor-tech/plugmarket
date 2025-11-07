/**
 * Test database connection
 */

import { createClient } from '@supabase/supabase-js';

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
      const url = env.SUPABASE_URL;
      const key = env.SUPABASE_ANON_KEY;

      if (!url || !key) {
        return new Response(
          JSON.stringify({ 
            error: 'Missing credentials',
            hasUrl: !!url,
            hasKey: !!key
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

      const supabase = createClient(url, key);

      // Test 1: Simple query
      const { data: test1, error: error1 } = await supabase
        .from('accounts')
        .select('*')
        .limit(1);

      // Test 2: Count available
      const { data: test2, error: error2 } = await supabase
        .from('accounts')
        .select('product_id, plan, status')
        .eq('status', 'available');

      return new Response(
        JSON.stringify({ 
          url,
          keyLength: key.length,
          test1: {
            success: !error1,
            error: error1?.message,
            count: test1?.length || 0,
            sample: test1?.[0]
          },
          test2: {
            success: !error2,
            error: error2?.message,
            count: test2?.length || 0,
            items: test2?.slice(0, 3)
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
