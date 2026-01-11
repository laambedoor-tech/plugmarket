/**
 * Cloudflare Workers: Stripe Webhook Handler
 * Routes: POST /api/stripe-webhook
 * Receives payment_intent.succeeded events and assigns inventory in Supabase
 */

import { createClient } from '@supabase/supabase-js';

// Crypto helper for webhook signature verification (using Cloudflare's crypto)
async function verifySignature(body, signatureHeader, secret) {
  const encoder = new TextEncoder();
  
  // Parse signature header: t=timestamp,v1=signature
  const parts = signatureHeader.split(',');
  let timestamp, signature;
  
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') timestamp = value;
    if (key === 'v1') signature = value;
  }
  
  if (!timestamp || !signature) {
    throw new Error('Invalid signature header format');
  }
  
  // Create signed payload: timestamp.body
  const signedPayload = `${timestamp}.${body}`;
  const keyBuffer = encoder.encode(secret);
  const payloadBuffer = encoder.encode(signedPayload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, payloadBuffer);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const computedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return computedSignature === signature;
}

function getSupabase(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(url, key);
}

async function assignAccount(env, productId, plan, customerEmail) {
  const supabase = getSupabase(env);

  console.log(`Searching for account: product_id="${productId}", plan="${plan}"`);

  // FIFO: fetch oldest available first
  const { data: accounts, error: fetchError } = await supabase
    .from('accounts')
    .select('*')
    .eq('product_id', productId)
    .eq('plan', plan)
    .eq('status', 'available')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1);

  if (fetchError) throw new Error(`DB fetch error: ${fetchError.message}`);
  if (!accounts || accounts.length === 0) {
    throw new Error(`No available accounts for ${productId} - ${plan}`);
  }

  const account = accounts[0];

  // Mark as sold
  const { error: updateError } = await supabase
    .from('accounts')
    .update({
      status: 'sold',
      sold_at: new Date().toISOString(),
      customer_email: customerEmail
    })
    .eq('id', account.id);

  if (updateError) throw new Error(`DB update error: ${updateError.message}`);

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
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/stripe-webhook')) {
      return new Response('Not Found', { status: 404 });
    }

    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: 'Missing STRIPE_WEBHOOK_SECRET' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      const signature = request.headers.get('stripe-signature');
      if (!signature) {
        return new Response('Missing Stripe signature', { status: 400 });
      }

      const body = await request.text();
      const isValid = await verifySignature(body, signature, webhookSecret);

      if (!isValid) {
        console.error('Webhook signature verification failed');
        return new Response('Invalid signature', { status: 400 });
      }

      const evt = JSON.parse(body);

      switch (evt.type) {
        case 'payment_intent.succeeded': {
          const pi = evt.data.object;
          console.log('Payment succeeded', {
            id: pi.id,
            amount: pi.amount,
            receipt_email: pi.receipt_email,
            metadata: pi.metadata
          });

          const customerEmail = pi.receipt_email;
          if (!customerEmail) {
            console.error('No customer email found in payment intent', { id: pi.id });
            break;
          }

          // Check if this is a balance top-up
          if (pi.metadata?.type === 'balance_topup') {
            console.log('Processing balance top-up:', {
              email: customerEmail,
              amount: pi.metadata.amount
            });
            
            try {
              const supabase = getSupabase(env);
              const topupAmount = parseFloat(pi.metadata.amount);
              
              // Create balance transaction (trigger will update user balance)
              const { error: txError } = await supabase
                .from('balance_transactions')
                .insert({
                  user_email: customerEmail,
                  type: 'topup',
                  amount: topupAmount,
                  description: `Balance top-up via Stripe`,
                  payment_method: 'stripe',
                  payment_intent_id: pi.id
                });
                
              if (txError) {
                console.error('Failed to create balance transaction:', txError);
              } else {
                console.log('✅ Balance top-up completed:', {
                  email: customerEmail,
                  amount: topupAmount
                });
              }
            } catch (error) {
              console.error('Error processing balance top-up:', error);
            }
            break;
          }

          // Parse cart from metadata (normal purchase)
          const cart = JSON.parse(pi.metadata?.cart || '[]');
          console.log('Processing cart:', cart);

          // Collect all assigned credentials for the order
          const orderItems = [];
          let allAssigned = true;

          // Process each item respecting quantity
          for (const item of cart) {
            const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
            console.log(`Item ${item.pid} - ${item.plan} requested qty=${qty}`);

            for (let i = 0; i < qty; i++) {
              try {
                const credentials = await assignAccount(env, item.pid, item.plan, customerEmail);
                console.log(`✅ Assigned account (${i + 1}/${qty}) for ${item.pid} - ${item.plan} to ${customerEmail}`);

                // Store credentials for order record
                const itemCreds = {
                  email: credentials.email,
                  password: credentials.password
                };
                if (credentials.chatgptPassword) itemCreds.chatgptPassword = credentials.chatgptPassword;
                if (credentials.chatgptCode) itemCreds.chatgptCode = credentials.chatgptCode;
                
                orderItems.push({
                  pid: item.pid,
                  plan: item.plan,
                  unitAmount: item.unitAmount,
                  credentials: itemCreds
                });
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

          // Save order to Supabase
          if (orderItems.length > 0) {
            const supabase = getSupabase(env);
            const { error: orderError } = await supabase
              .from('orders')
              .insert({
                customer_email: customerEmail,
                payment_intent_id: pi.id,
                total_cents: pi.amount,
                items: orderItems
              });

            if (orderError) {
              console.error('Failed to save order:', orderError.message);
            } else {
              console.log(`✅ Order saved for ${customerEmail} with ${orderItems.length} item(s)`);
            }
          }

          break;
        }

        case 'payment_intent.payment_failed': {
          const pi = evt.data.object;
          console.warn('Payment failed', {
            id: pi.id,
            last_payment_error: pi.last_payment_error?.message
          });
          break;
        }

        default:
          console.log(`Unhandled event type ${evt.type}`);
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Webhook handler error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
};
