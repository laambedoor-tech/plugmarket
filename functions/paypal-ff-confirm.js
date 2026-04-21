/**
 * POST /api/paypal-ff/confirm
 * Body: { orderId: 'PPFF-xxx' }
 * Cliente confirma que ya pagó - procesa la orden automáticamente
 * Como PayPal F&F personal no siempre envía IPN, este es el método principal
 */

async function assignAccount(supabaseUrl, supabaseKey, productId, plan, customerEmail) {
  console.log(`Assigning account: product_id="${productId}", plan="${plan}"`);

  // Buscar cuenta disponible (FIFO: la más antigua primero)
  const fetchRes = await fetch(
    `${supabaseUrl}/rest/v1/accounts?product_id=eq.${productId}&plan=eq.${plan}&status=eq.available&order=created_at.asc,id.asc&limit=1`,
    {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!fetchRes.ok) {
    throw new Error(`Failed to fetch account: ${await fetchRes.text()}`);
  }

  const accounts = await fetchRes.json();
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error(`No available accounts for ${productId} - ${plan}`);
  }

  const account = accounts[0];

  // Marcar como vendida
  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/accounts?id=eq.${account.id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        status: 'sold',
        sold_at: new Date().toISOString(),
        customer_email: customerEmail
      })
    }
  );

  if (!updateRes.ok) {
    throw new Error(`Failed to update account: ${await updateRes.text()}`);
  }

  const result = {
    email: account.email,
    password: account.password
  };
  if (account.chatgpt_password) result.chatgptPassword = account.chatgpt_password;
  if (account.chatgpt_code) result.chatgptCode = account.chatgpt_code;
  return result;
}

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
      const { orderId } = body;

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

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials');
      }

      // Buscar la orden
      const searchRes = await fetch(
        `${supabaseUrl}/rest/v1/orders?payment_intent_id=eq.${orderId}`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!searchRes.ok) {
        const errorText = await searchRes.text();
        throw new Error(`Failed to find order: ${errorText}`);
      }

      const orders = await searchRes.json();
      
      if (!Array.isArray(orders) || orders.length === 0) {
        return new Response(JSON.stringify({ error: 'Order not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const order = orders[0];

      // Verificar si ya está completada
      if (order.payment_intent_id && order.payment_intent_id.includes('_completed_')) {
        // Ya completada - devolver las credenciales existentes
        let items = [];
        if (order.items) {
          items = Array.isArray(order.items) ? order.items : JSON.parse(order.items);
        }
        
        return new Response(JSON.stringify({ 
          success: true,
          status: 'completed',
          message: 'Order already completed',
          orderId,
          items: items.map(item => ({
            product: item.pid,
            plan: item.plan,
            credentials: item.credentials
          }))
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // Verificar que la orden no sea muy antigua (máximo 24 horas)
      const orderDate = new Date(order.created_at);
      const now = new Date();
      const hoursDiff = (now - orderDate) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        return new Response(JSON.stringify({ 
          error: 'Order expired. Please create a new order.',
          expired: true
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // Parsear items del carrito
      let cartItems = [];
      if (order.items) {
        cartItems = Array.isArray(order.items) ? order.items : JSON.parse(order.items);
      }

      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        throw new Error('Order has no items');
      }

      console.log(`Processing ${cartItems.length} cart items for order ${orderId} (customer confirmed payment)`);

      // Asignar cuentas del stock para cada item
      const orderItems = [];
      for (const item of cartItems) {
        const qty = item.qty || 1;
        for (let i = 0; i < qty; i++) {
          try {
            const credentials = await assignAccount(
              supabaseUrl,
              supabaseKey,
              item.pid,
              item.plan,
              order.customer_email
            );
            orderItems.push({
              pid: item.pid,
              plan: item.plan,
              price: item.price,
              credentials
            });
            console.log(`Assigned account ${i + 1}/${qty} for ${item.pid}-${item.plan}`);
          } catch (assignError) {
            console.error(`Failed to assign account for ${item.pid}-${item.plan}:`, assignError);
            throw new Error(`Sin stock disponible para ${item.pid} (${item.plan})`);
          }
        }
      }

      // Marcar como completada y guardar credenciales
      const completedId = `${orderId}_completed_confirmed_${Date.now()}`;
      
      const updateRes = await fetch(
        `${supabaseUrl}/rest/v1/orders?payment_intent_id=eq.${orderId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            payment_intent_id: completedId,
            items: orderItems
          })
        }
      );

      if (!updateRes.ok) {
        const errorText = await updateRes.text();
        console.error('Supabase PATCH error response:', errorText);
        throw new Error(`Failed to update order: ${errorText}`);
      }

      console.log(`✅ Order ${orderId} completed via customer confirmation - ${orderItems.length} accounts assigned`);

      return new Response(JSON.stringify({ 
        success: true,
        status: 'completed',
        message: 'Payment confirmed! Here are your credentials.',
        orderId,
        items: orderItems.map(item => ({
          product: item.pid,
          plan: item.plan,
          credentials: item.credentials
        }))
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });

    } catch (err) {
      console.error('❌ Error confirming order:', err);
      return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
