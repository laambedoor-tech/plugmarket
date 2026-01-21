/**
 * Manually process a Stripe payment that didn't create an order
 * POST /api/recover-stripe-order
 * Body: { payment_intent_id: "pi_xxx" }
 */

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

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    try {
      const { payment_intent_id } = await request.json();
      
      if (!payment_intent_id) {
        return new Response(JSON.stringify({ error: 'payment_intent_id required' }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      console.log(`🔧 Recovering order for payment intent: ${payment_intent_id}`);

      // Check if order already exists
      const supabase = getSupabase(env);
      const { data: existingOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('payment_intent_id', payment_intent_id);

      if (existingOrders && existingOrders.length > 0) {
        return new Response(JSON.stringify({ 
          error: 'Order already exists',
          order_id: existingOrders[0].id
        }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // Fetch payment intent from Stripe
      const stripeKey = env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        throw new Error('Stripe secret key not configured in environment');
      }

      console.log(`🔑 Fetching payment intent from Stripe...`);
      
      const piResponse = await fetch(
        `https://api.stripe.com/v1/payment_intents/${payment_intent_id}`,
        {
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      console.log(`📡 Stripe response status: ${piResponse.status}`);

      if (!piResponse.ok) {
        const errorText = await piResponse.text();
        console.error(`❌ Stripe error:`, errorText);
        throw new Error(`Failed to fetch payment intent from Stripe: ${errorText}`);
      }

      const pi = await piResponse.json();
      console.log(`✅ Payment intent fetched successfully`);

      if (pi.status !== 'succeeded') {
        return new Response(JSON.stringify({ 
          error: 'Payment not succeeded',
          status: pi.status
        }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // Extract customer email
      const customerEmail = (pi.receipt_email || pi.metadata?.customer_email || '').toLowerCase().trim();
      if (!customerEmail) {
        throw new Error('No customer email found in payment intent');
      }

      // Parse cart from metadata
      const cartData = pi.metadata?.cart;
      if (!cartData) {
        throw new Error('No cart data in payment intent metadata');
      }

      let cart;
      try {
        cart = JSON.parse(cartData);
      } catch {
        throw new Error('Invalid cart data in metadata');
      }

      console.log(`📧 Customer: ${customerEmail}`);
      console.log(`🛒 Cart:`, cart);

      // Assign accounts for each item
      const orderItems = [];
      for (const item of cart) {
        const qty = Number(item.qty) || 1;
        console.log(`Assigning ${qty}x ${item.pid} - ${item.plan}`);

        for (let i = 0; i < qty; i++) {
          try {
            const credentials = await assignAccount(env, item.pid, item.plan, customerEmail);
            orderItems.push({
              pid: item.pid,
              name: item.pid,
              plan: item.plan,
              unitAmount: item.unitAmount || 0,
              credentials
            });
            console.log(`✅ Assigned ${i + 1}/${qty}`);
          } catch (err) {
            console.error(`❌ Failed to assign ${i + 1}/${qty}:`, err.message);
            if (String(err.message).includes('No available accounts')) {
              console.warn(`Stock exhausted. Assigned ${i} of ${qty}`);
              break;
            }
          }
        }
      }

      if (orderItems.length === 0) {
        throw new Error('No items could be assigned');
      }

      // Create order
      const { data: orders, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_email: customerEmail,
          payment_intent_id: pi.id,
          total_cents: pi.amount,
          items: orderItems
        })
        .select();

      if (orderError) {
        throw new Error(`Failed to create order: ${orderError.message}`);
      }

      console.log(`✅ Order created: ${orders[0].id}`);

      return new Response(JSON.stringify({
        success: true,
        order_id: orders[0].id,
        items_assigned: orderItems.length,
        customer_email: customerEmail,
        total_cents: pi.amount
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (error) {
      console.error('Error recovering order:', error);
      return new Response(JSON.stringify({ 
        error: error.message,
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
};
