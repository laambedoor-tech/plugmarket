const stripeLib = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

// Assign account from inventory
async function assignAccount(productId, plan, customerEmail) {
  const supabase = getSupabase();
  
  console.log(`Searching for account: product_id="${productId}", plan="${plan}"`);
  
  // Find available account for this product and plan
  const { data: accounts, error: fetchError } = await supabase
    .from('accounts')
    .select('*')
    .eq('product_id', productId)
    .eq('plan', plan)
    .eq('status', 'available')
    .limit(1);

  console.log(`Query result: ${accounts ? accounts.length : 0} accounts found`, { fetchError, accounts });

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

  return {
    email: account.email,
    password: account.password
  };
}

// Stripe webhook endpoint for Netlify Functions
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecret || !webhookSecret) {
    return { statusCode: 500, body: 'Missing Stripe env vars' };
  }

  const stripe = stripeLib(stripeSecret);

  const sig = event.headers['stripe-signature'];
  if (!sig) return { statusCode: 400, body: 'Missing Stripe signature' };

  let evt;
  try {
    evt = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    switch (evt.type) {
      case 'payment_intent.succeeded': {
        const pi = evt.data.object;
        console.log('Payment succeeded', { id: pi.id, amount: pi.amount, receipt_email: pi.receipt_email });

        // Get customer email from receipt_email (set by confirmPayment)
        const customerEmail = pi.receipt_email;

        if (!customerEmail) {
          console.error('No customer email found in payment intent', { id: pi.id });
          break;
        }

        // Parse cart from metadata
        const cart = JSON.parse(pi.metadata.cart || '[]');
        console.log('Processing cart:', cart);

        // Process each item in cart
        for (const item of cart) {
          try {
            const credentials = await assignAccount(item.pid, item.plan, customerEmail);
            console.log(`✅ Assigned account for ${item.pid} - ${item.plan} to ${customerEmail}`);
            
            // TODO: Send email with credentials
            // For now, log the credentials (you'll see them in Netlify Functions logs)
            console.log('Account credentials:', {
              product: item.pid,
              plan: item.plan,
              email: credentials.email,
              password: credentials.password,
              customer: customerEmail
            });
          } catch (err) {
            console.error(`❌ Failed to assign account for ${item.pid}:`, err.message);
            // Continue with other items even if one fails
          }
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = evt.data.object;
        console.warn('Payment failed', { id: pi.id, last_payment_error: pi.last_payment_error?.message });
        break;
      }
      default:
        console.log(`Unhandled event type ${evt.type}`);
    }
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (e) {
    console.error('Webhook handler error', e);
    return { statusCode: 500, body: 'Webhook handler error' };
  }
};
