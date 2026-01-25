/**
 * POST /api/paypal-ff/manual-complete
 * Body: { orderId: 'PPFF-xxx', txnId: '0LF511219A3181907' }
 * Marca una orden PayPal F&F como completada manualmente
 * El cliente detectará automáticamente el cambio mediante polling
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

      // Validar formato de orden PayPal FF
      if (!orderId.startsWith('PPFF-')) {
        return new Response(JSON.stringify({ error: 'Invalid PayPal FF order ID format' }), {
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

      // Verificar si ya está completada
      if (order.payment_intent_id.includes('_completed_')) {
        return new Response(JSON.stringify({ 
          success: true,
          message: 'Order already completed',
          orderId,
          alreadyCompleted: true
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // Marcar como completada
      const completedId = `${orderId}_completed_${txnId || Date.now()}`;
      
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
            payment_intent_id: completedId
          })
        }
      );

      if (!updateRes.ok) {
        const errorText = await updateRes.text();
        throw new Error(`Failed to update order: ${errorText}`);
      }

      console.log(`✅ Order ${orderId} manually completed by admin (txn: ${txnId || 'none'})`);

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Order marked as completed - customer will be notified automatically',
        orderId,
        completedId,
        amount: order.total_cents / 100,
        customerEmail: order.customer_email,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });

    } catch (err) {
      console.error('❌ Error completing order:', err);
      return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
