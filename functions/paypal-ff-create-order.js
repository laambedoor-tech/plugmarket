/**
 * POST /api/paypal-ff/create-order
 * Body: { cart: [{ pid, plan, qty } ...], email: 'customer@email.com' }
 * Creates a PayPal Friends & Family order with payment instructions
 */

const PRICES_EUR = {
  boosts: { '3 Months': 6.65 },
  netflix: { '1 Month': 1.22, '3 Months': 2.84, '6 Months': 4.86, '12 Months': 8.91, 'Bulk': 0.49, 'Lifetime': 1.10, 'FA': 8.50 },
  spotify: { '1 Month': 1.78, '3 Months': 3.08, '6 Months': 5.02, '12 Months': 9.62, 'Lifetime': 1.78 },
  'youtube-premium': { '1 Month': 2.27, '6 Months': 6.80, '12 Months': 10.13, 'Lifetime': 2.27, 'fowner': 4.74 },
  disney: { '1 Month': 0.89, '3 Months': 2.19, '6 Months': 3.89, '12 Months': 7.70, 'Lifetime': 0.89 },
  prime: { '1 Month': 0.65, '3 Months': 1.78, '12 Months': 5.99, 'Lifetime': 0.65 },
  hbomax: { 'Lifetime': 1.08 },
  nordvpn: { '1 Month': 1.46, '3 Months': 2.75, '6 Months': 4.70, '12 Months': 8.62, 'Lifetime': 1.46 },
  crunchy: { '1 Month': 1.05, '3 Months': 2.67, '6 Months': 4.70, '12 Months': 8.42, 'Lifetime': 1.05 },
  nitro: { 'Boost 1m': 4.00, 'Boost 1 Year': 12.29, 'Basic 1m': 1.10 },
  discordpromocode: { '1 Month': 0.62, '3 Months': 1.19, 'Boost 1m': 4.00, 'Boost 3m': 13.65 },
  realmembers: { '[500]': 2.03, '[1000]': 3.83, '[2000]': 7.09, '[3000]': 10.47, '[4000]': 11.02, '[5000]': 14.05 },
  'chatgpt-plus': { '1 Month': 2.95, '3 Months': 6.48, '6 Months': 11.13, '12 Months': 9.69 },
  'chatgpt-pro': { '1 Month': 2.84, '3 Months': 5.40 },
  capcut: { '1 Month': 1.08, '3 Months': 2.25, '6 Months': 3.78, '12 Months': 7.20, 'Lifetime': 2.12 },
  geoguessr: { '1 Month': 1.80, '3 Months': 4.50, '12 Months': 9.00, 'Lifetime': 0.73 },
  filmora: { '1 Month': 2.25, '3 Months': 5.40, '6 Months': 9.45, '12 Months': 14.40, 'Lifetime': 6.56 },
  duolingo: { '12 Months': 1.12, 'Lifetime': 1.46 },
  movistar: { '12 Months': 2.20, 'Lifetime': 2.63 },
  dazn: { 'Lifetime': 1.22 },
  steamaccount: { 'Random Games': 0.25 },
  microsoft: { 'Random Codes': 0.40 },
  rockstar: { 'Activation Code': 0.25 },
  minecraft: { 'NFA Lifetime': 1.00, 'FA Lifetime': 4.50 },
  stake: { 'Level 2 Verified': 0.60 },
  xbox: { 'Game Pass Lifetime': 0.60 },
  roblox: { '800 Robux': 10.00, '1700 Robux': 20.00, '4500 Robux': 50.00 }
};

// Random casual payment notes to make it look natural
const CASUAL_NOTES = [
  'Thanks!',
  'For yesterday',
  'Gas',
  'Coffee',
  'Lunch',
  'Thanks for helping',
  'Birthday gift',
  'Pizza',
  'Groceries',
  'Snacks',
  'Taxi ride',
  'Movie tickets'
];

function getRandomNote() {
  return CASUAL_NOTES[Math.floor(Math.random() * CASUAL_NOTES.length)];
}

function generateOrderId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `PPFF-${timestamp}-${random}`.toUpperCase();
}

function getVolumeDiscount(totalQty) {
  if (totalQty >= 100) return 0.12;
  if (totalQty >= 50) return 0.08;
  if (totalQty >= 25) return 0.05;
  if (totalQty >= 10) return 0.03;
  return 0;
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
      const { cart, email } = body;

      if (!Array.isArray(cart) || cart.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid cart' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      if (!email || !email.includes('@')) {
        return new Response(JSON.stringify({ error: 'Valid email required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // Calculate total and validate items
      let subtotal = 0;
      let totalQty = 0;
      const items = [];

      for (const item of cart) {
        const { pid, plan, qty } = item;
        if (!pid || !plan || !qty || qty < 1) {
          return new Response(JSON.stringify({ error: 'Invalid item in cart' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const productPrices = PRICES_EUR[pid];
        if (!productPrices || !productPrices[plan]) {
          return new Response(JSON.stringify({ error: `Invalid product or plan: ${pid} - ${plan}` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const price = productPrices[plan];
        subtotal += price * qty;
        totalQty += qty;
        items.push({ pid, plan, qty, price });
      }

      // Apply volume discount
      const discount = getVolumeDiscount(totalQty);
      const total = subtotal * (1 - discount);

      // Generate order ID
      const orderId = generateOrderId();
      const note = getRandomNote();

      // Store order in database
      const orderData = {
        customer_email: email,
        payment_intent_id: orderId,
        total_cents: Math.round(total * 100),
        items: JSON.stringify(items)
      };

      // Insert into Supabase
      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase credentials');
        throw new Error('Server configuration error');
      }

      const insertRes = await fetch(`${supabaseUrl}/rest/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(orderData)
      });

      if (!insertRes.ok) {
        const errorText = await insertRes.text();
        console.error('Failed to insert order:', errorText);
        throw new Error(`Database error: ${errorText}`);
      }

      // Return payment instructions
      return new Response(JSON.stringify({
        orderId,
        email: env.PAYPAL_MANUAL_EMAIL || 'payments@plugmarket.es',
        amount: parseFloat(total.toFixed(2)),
        note,
        instructions: {
          step1: 'Open PayPal app or website',
          step2: `Send $${total.toFixed(2)} to ${env.PAYPAL_MANUAL_EMAIL || 'payments@plugmarket.es'}`,
          step3: `Use Friends & Family option`,
          step4: `Add note: "${note}"`,
          step5: 'Payment will be verified automatically within minutes'
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });

    } catch (err) {
      console.error('Error creating PayPal F&F order:', err);
      return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
