// Use balance to pay for order
export default async function handler(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
      });
  }

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7);
    
    // Decode JWT to get email
    const parts = token.split('.');
    if (parts.length !== 3) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = JSON.parse(atob(parts[1]));
    const email = payload.email;

    if (!email) {
      return new Response(JSON.stringify({ error: 'Invalid token payload' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { cart, totalAmount } = await request.json();

    if (!cart || cart.length === 0) {
      return new Response(JSON.stringify({ error: 'Cart is empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!totalAmount || totalAmount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

    // Get current balance
    const userResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=balance`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user balance');
    }

    const users = await userResponse.json();
    
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const currentBalance = parseFloat(users[0].balance || 0);

    // Check if balance is sufficient
    if (currentBalance < totalAmount) {
      return new Response(JSON.stringify({ 
        error: 'Insufficient balance',
        currentBalance,
        required: totalAmount
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create order in orders table
    const orderData = {
      customer_email: email,
      products: cart.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      total_amount: totalAmount,
      payment_method: 'balance',
      payment_status: 'completed',
      order_status: 'completed',
      created_at: new Date().toISOString()
    };

    const orderResponse = await fetch(
      `${supabaseUrl}/rest/v1/orders`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(orderData)
      }
    );

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      throw new Error(`Failed to create order: ${errorText}`);
    }

    const orders = await orderResponse.json();
    const orderId = orders[0].id;

    // Create balance transaction (this will automatically update balance via trigger)
    const transactionData = {
      user_email: email,
      type: 'purchase',
      amount: totalAmount,
      description: `Order #${orderId}`,
      payment_method: 'balance'
    };

    const transactionResponse = await fetch(
      `${supabaseUrl}/rest/v1/balance_transactions`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(transactionData)
      }
    );

    if (!transactionResponse.ok) {
      throw new Error('Failed to create transaction');
    }

    return new Response(JSON.stringify({ 
      success: true,
      orderId,
      newBalance: currentBalance - totalAmount
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error processing balance payment:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process payment',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
