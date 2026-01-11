// Use balance to pay for order
export default async function handler(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const token = authHeader.substring(7);
    
    // Decode JWT to get email
    const parts = token.split('.');
    if (parts.length !== 3) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const payload = JSON.parse(atob(parts[1]));
    const email = payload.email;

    if (!email) {
      return new Response(JSON.stringify({ error: 'Invalid token payload' }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const body = await request.json();
    console.log('Received body:', JSON.stringify(body));
    
    const { cart, totalAmount } = body;

    if (!cart || cart.length === 0) {
      console.error('Cart is empty or missing');
      return new Response(JSON.stringify({ error: 'Cart is empty' }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (!totalAmount || totalAmount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

    console.log('Processing balance payment for:', email);
    console.log('Cart:', JSON.stringify(cart));
    console.log('Total:', totalAmount);

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

    console.log('User fetch status:', userResponse.status);
    
    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('User fetch error:', errorText);
      throw new Error('Failed to fetch user balance');
    }

    const users = await userResponse.json();
    
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
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
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Create order in orders table
    const orderData = {
      customer_email: email,
      products: cart.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.qty || 1
      })),
      total_amount: totalAmount,
      payment_method: 'balance',
      payment_status: 'completed',
      order_status: 'completed',
      created_at: new Date().toISOString()
    };

    console.log('Creating order with data:', JSON.stringify(orderData));

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

    console.log('Order response status:', orderResponse.status);
    
    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error('Order creation error:', errorText);
      throw new Error(`Failed to create order: ${errorText}`);
    }

    const orders = await orderResponse.json();
    console.log('Order created:', JSON.stringify(orders));
    const orderId = orders[0].id;

    // Create balance transaction (this will automatically update balance via trigger)
    const transactionData = {
      user_email: email,
      type: 'purchase',
      amount: totalAmount,
      description: `Order #${orderId}`,
      payment_method: 'balance'
    };

    console.log('Creating transaction:', JSON.stringify(transactionData));

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

    console.log('Transaction response status:', transactionResponse.status);
    
    if (!transactionResponse.ok) {
      const errorText = await transactionResponse.text();
      console.error('Transaction creation error:', errorText);
      throw new Error('Failed to create transaction');
    }

    return new Response(JSON.stringify({ 
      success: true,
      orderId,
      newBalance: currentBalance - totalAmount
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error processing balance payment:', error);
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({ 
      error: 'Failed to process payment',
      details: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
