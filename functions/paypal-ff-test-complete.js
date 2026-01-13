/**
 * POST /api/paypal-ff/test-complete
 * Test endpoint to manually mark an order as completed
 * Body: { casualNote: "Pizza" }
 */

import { createClient } from '@supabase/supabase-js';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const { casualNote } = await request.json();

      if (!casualNote) {
        return new Response(JSON.stringify({ error: 'casualNote required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

      // Find order
      const { data: order, error: findError } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_intent_id', casualNote)
        .single();

      if (findError || !order) {
        return new Response(JSON.stringify({ 
          error: 'Order not found',
          casualNote,
          findError 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // Mark as completed
      const testTxnId = `TEST-${Date.now()}`;
      const { error: updateError } = await supabase
        .from('orders')
        .update({ payment_intent_id: testTxnId })
        .eq('id', order.id);

      if (updateError) {
        return new Response(JSON.stringify({ error: 'Update failed', updateError }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        orderId: order.id,
        email: order.customer_email,
        casualNote,
        testTxnId,
        message: 'Order marked as completed'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
