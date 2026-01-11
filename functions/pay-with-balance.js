// Use balance to pay for order
import { createClient } from '@supabase/supabase-js';

function getSupabase(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

async function assignAccount(env, productId, plan, customerEmail) {
  const supabase = getSupabase(env);
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('product_id', productId)
    .eq('plan', plan)
    .eq('status', 'available')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw new Error(`DB fetch error: ${error.message}`);
  if (!accounts || accounts.length === 0) throw new Error(`No available accounts for ${productId} - ${plan}`);
  const account = accounts[0];
  const { error: updateError } = await supabase
    .from('accounts')
    .update({ status: 'sold', sold_at: new Date().toISOString(), customer_email: customerEmail })
    .eq('id', account.id);
  if (updateError) throw new Error(`DB update error: ${updateError.message}`);
  const result = { email: account.email, password: account.password };
  if (account.chatgpt_password) result.chatgptPassword = account.chatgpt_password;
  if (account.chatgpt_code) result.chatgptCode = account.chatgpt_code;
  return result;
}

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

    // Assign accounts for each item in cart
    const orderItems = [];
    let allAssigned = true;

    for (const item of cart) {
      const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
      console.log(`Item ${item.pid} - ${item.plan} requested qty=${qty}`);

      for (let i = 0; i < qty; i++) {
        try {
          const credentials = await assignAccount(env, item.pid, item.plan, email);
          console.log(`✅ Assigned account (${i + 1}/${qty}) for ${item.pid} - ${item.plan} to ${email}`);

          // Store credentials for order record
          const itemCreds = {
            pid: item.pid,
            name: item.name,
            plan: item.plan,
            unitAmount: item.price,
            credentials: {
              email: credentials.email,
              password: credentials.password
            }
          };
          
          if (credentials.chatgptPassword) itemCreds.credentials.chatgptPassword = credentials.chatgptPassword;
          if (credentials.chatgptCode) itemCreds.credentials.chatgptCode = credentials.chatgptCode;
          
          orderItems.push(itemCreds);
        } catch (err) {
          console.error(`❌ Failed to assign account (${i + 1}/${qty}) for ${item.pid}:`, err.message);
          allAssigned = false;

          if (String(err.message).includes('No available accounts')) {
            console.warn(`Stock exhausted for ${item.pid} - ${item.plan}. Assigned ${i} of ${qty}.`);
            break;
          }
        }
      }
    }

    // Create order in orders table
    const orderData = {
      customer_email: email,
      payment_intent_id: 'balance_' + Date.now(),
      total_cents: Math.round(totalAmount * 100),
      items: orderItems
    };

    console.log('Creating order with data:', JSON.stringify(orderData));

    const supabase = getSupabase(env);
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select();

    if (orderError) {
      console.error('Order creation error:', orderError.message);
      throw new Error(`Failed to create order: ${orderError.message}`);
    }

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

    const { error: transactionError } = await supabase
      .from('balance_transactions')
      .insert(transactionData);

    if (transactionError) {
      console.error('Transaction creation error:', transactionError.message);
      throw new Error('Failed to create transaction');
    }

    console.log(`✅ Balance payment completed for ${email}. Order ${orderId} with ${orderItems.length} item(s)`);

    return new Response(JSON.stringify({ 
      success: true,
      orderId,
      newBalance: currentBalance - totalAmount,
      itemsAssigned: orderItems.length
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
