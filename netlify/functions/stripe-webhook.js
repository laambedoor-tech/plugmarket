const stripeLib = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  console.log('Supabase config:', { 
    url, 
    keyPrefix: key ? key.substring(0, 20) + '...' : 'missing',
    keyLength: key ? key.length : 0
  });
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

// Assign account from inventory
async function assignAccount(productId, plan, customerEmail) {
  const supabase = getSupabase();
  
  console.log(`Searching for account: product_id="${productId}", plan="${plan}"`);
  
  // First, try exact match
  let { data: accounts, error: fetchError } = await supabase
    .from('accounts')
    .select('*')
    .eq('product_id', productId)
    .eq('plan', plan)
    .eq('status', 'available')
    // FIFO: pick the oldest available first
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1);

  console.log(`Exact match result: ${accounts ? accounts.length : 0} accounts`, { fetchError, sample: accounts?.[0] });

  // If no exact match, try without plan filter (for debugging)
  if ((!accounts || accounts.length === 0) && !fetchError) {
    console.log('Trying without plan filter...');
    const { data: allAccounts, error: allError } = await supabase
      .from('accounts')
      .select('*')
      .eq('product_id', productId)
      .eq('status', 'available');
    
    console.log(`Without plan filter: ${allAccounts ? allAccounts.length : 0} accounts`, { 
      allError, 
      plans: allAccounts?.map(a => `"${a.plan}"`) 
    });
  }

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

        // Process each item in cart; respect quantity (qty)
        for (const item of cart) {
          const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
          console.log(`Item ${item.pid} - ${item.plan} requested qty=${qty}`);
          
          // Assign one account per unit
          for (let i = 0; i < qty; i++) {
          try {
            const credentials = await assignAccount(item.pid, item.plan, customerEmail);
            console.log(`✅ Assigned account (${i + 1}/${qty}) for ${item.pid} - ${item.plan} to ${customerEmail}`);
            
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
            console.error(`❌ Failed to assign account (${i + 1}/${qty}) for ${item.pid}:`, err.message);
            // If out of stock, stop further attempts for this item
            if (String(err.message).includes('No available accounts')) {
              console.warn(`Stock exhausted for ${item.pid} - ${item.plan}. Assigned ${i} of ${qty}.`);
              break;
            }
            // Otherwise continue trying remaining units
          }
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
