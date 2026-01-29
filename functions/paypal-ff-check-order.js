/**
 * GET /api/paypal-ff/check-order?orderId=PPFF-xxx
 * Checks the status of a PayPal F&F order
 * Returns credentials when order is completed
 */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }});
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const url = new URL(request.url);
      const orderId = url.searchParams.get('orderId');

      if (!orderId) {
        return new Response(JSON.stringify({ error: 'Order ID required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // Query order from database - search for both pending and completed versions
      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_ANON_KEY;

      // First try exact match (pending order)
      let response = await fetch(
        `${supabaseUrl}/rest/v1/orders?payment_intent_id=eq.${orderId}`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch order');
      }

      let orders = await response.json();
      
      // If not found, search for completed version
      if (orders.length === 0) {
        response = await fetch(
          `${supabaseUrl}/rest/v1/orders?payment_intent_id=like.${orderId}_completed_*`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          }
        );
        
        if (response.ok) {
          orders = await response.json();
        }
      }
      
      if (orders.length === 0) {
        return new Response(JSON.stringify({ error: 'Order not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const order = orders[0];
      
      // Check if completed (payment_intent_id contains "_completed_")
      const isCompleted = order.payment_intent_id && order.payment_intent_id.includes('_completed_');

      // Build response
      const responseData = {
        orderId: orderId,
        status: isCompleted ? 'completed' : 'pending_payment',
        total: order.total_cents / 100,
        createdAt: order.created_at
      };

      // If completed, include credentials
      if (isCompleted && order.items) {
        const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items);
        
        // Check if items have credentials (they should after auto-delivery)
        if (items.length > 0 && items[0].credentials) {
          responseData.items = items.map(item => ({
            product: item.pid,
            plan: item.plan,
            credentials: item.credentials
          }));
        }
      }

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });

    } catch (err) {
      console.error('Error checking order:', err);
      return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
