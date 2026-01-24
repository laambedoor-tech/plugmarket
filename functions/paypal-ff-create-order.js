/**
 * POST /api/paypal-ff/create-order
 * Body: { cart: [{ pid, plan, qty } ...], email: 'customer@email.com' }
 * Creates a PayPal Friends & Family order with payment instructions
 */

const PRICES_USD = {
  netflix: { '1 Month': 1.50, '3 Months': 3.50, '6 Months': 6.00, '12 Months': 11.00, 'Lifetime': 18.00 },
  spotify: { '1 Month': 2.20, '3 Months': 3.80, '6 Months': 6.20, '12 Months': 12.50, 'Lifetime': 1.78 },
  'youtube-premium': { '1 Month': 1.60, '3 Months': 3.20, '6 Months': 5.50, '12 Months': 10.50, 'Lifetime': 2.27 },
  disney: { '1 Month': 1.10, '3 Months': 2.70, '6 Months': 4.80, '12 Months': 9.50, 'Lifetime': 0.89 },
  prime: { '1 Month': 1.80, '3 Months': 3.40, '6 Months': 5.80, '12 Months': 11.20, 'Lifetime': 14.00 },
  hbomax: { '1 Month': 1.40, '3 Months': 3.10, '6 Months': 4.70, '12 Months': 9.80, 'Lifetime': 13.00 },
  nordvpn: { '1 Month': 0.85, '3 Months': 2.00, '6 Months': 3.60, '12 Months': 6.90, 'Lifetime': 1.46 },
  crunchy: { '1 Month': 0.90, '3 Months': 2.10, '6 Months': 3.80, '12 Months': 7.20, 'Lifetime': 1.05 },
  nitro: { 'Boost 1m': 5.50, 'Boost 1 Year': 15.97, 'Basic 1m': 1.35 },
  discordpromocode: { '1 Month': 0.60, '3 Months': 1.05, 'Boost 1m': 5.50, 'Boost 3m': 15.00 },
  chatgpt: { '1 Month': 3.20, '3 Months': 7.80, '6 Months': 12.50, '12 Months': 24.00 },
  'chatgpt-pro': { '1 Month': 3.15, '3 Months': 6.00 },
  capcut: { '1 Month': 1.20, '3 Months': 2.50, '6 Months': 4.20, '12 Months': 8.00, 'Lifetime': 2.35 },
  geoguessr: { '1 Month': 2.00, '3 Months': 5.00, '12 Months': 10.00, 'Lifetime': 0.81 },
  filmora: { '1 Month': 2.50, '3 Months': 6.00, '6 Months': 10.50, '12 Months': 16.00, 'Lifetime': 7.29 },
  duolingo: { '12 Months': 1.24, 'Lifetime': 1.62 },
  movistar: { '12 Months': 2.44, 'Lifetime': 2.92 },
  dazn: { 'Lifetime': 1.35 },
  roblox: { '800 Robux': 10, '1700 Robux': 20, '4500 Robux': 50 }
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

        const productPrices = PRICES_USD[pid];
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
        order_id: orderId,
        customer_email: email,
        items: JSON.stringify(items),
        subtotal: subtotal,
        discount_percentage: discount * 100,
        total: total,
        payment_method: 'paypal_ff',
        status: 'pending_payment',
        created_at: new Date().toISOString(),
        payment_note: note
      };

      // Insert into Supabase
      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_ANON_KEY;

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
        console.error('Failed to insert order:', await insertRes.text());
        throw new Error('Failed to create order');
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
