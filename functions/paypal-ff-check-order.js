/**
 * GET /api/paypal-ff/check-order?orderId=PPFF-xxx
 * Checks the status of a PayPal F&F order
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

      // Query order from database
      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/rest/v1/orders?order_id=eq.${orderId}`,
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

      const orders = await response.json();
      
      if (orders.length === 0) {
        return new Response(JSON.stringify({ error: 'Order not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const order = orders[0];

      return new Response(JSON.stringify({
        orderId: order.order_id,
        status: order.status,
        total: order.total,
        createdAt: order.created_at,
        completedAt: order.completed_at
      }), {
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
