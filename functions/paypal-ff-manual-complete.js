/**
 * POST /api/paypal-ff/manual-complete
 * Body: { orderId: 'PPFF-xxx', txnId: '0LF511219A3181907' }
 * Marca una orden PayPal F&F como completada manualmente
 */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }});
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const body = await request.json();
      const { orderId, txnId } = body;

      if (!orderId) {
        return new Response(JSON.stringify({ error: 'Order ID required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_ANON_KEY;

      // Buscar la orden
      const searchRes = await fetch(
        `${supabaseUrl}/rest/v1/orders?payment_intent_id=eq.${orderId}`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }
      );

      if (!searchRes.ok) {
        throw new Error('Failed to find order');
      }

      const orders = await searchRes.json();
      
      if (orders.length === 0) {
        return new Response(JSON.stringify({ error: 'Order not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const order = orders[0];

      // Marcar como completada
      const updateRes = await fetch(
        `${supabaseUrl}/rest/v1/orders?payment_intent_id=eq.${orderId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            payment_intent_id: `${orderId}_completed_${txnId || Date.now()}`
          })
        }
      );

      if (!updateRes.ok) {
        throw new Error('Failed to update order');
      }

      console.log(`Order ${orderId} manually completed`);

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Order marked as completed',
        orderId 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });

    } catch (err) {
      console.error('Error completing order:', err);
      return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
