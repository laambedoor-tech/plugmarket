/**
 * POST /api/paypal-ff/create-order
 * Body: { cart: [{ pid, plan, qty } ...] }
 * Creates a PayPal Friends & Family order with instructions
 */

const PRICES_USD = {
  netflix: { '1 Month': 150, '3 Months': 350, '6 Months': 600, '12 Months': 1100, 'Lifetime': 1800 },
  spotify: { '1 Month': 220, '3 Months': 380, '6 Months': 620, '12 Months': 1250 },
  'youtube-premium': { '1 Month': 160, '3 Months': 320, '6 Months': 550, '12 Months': 1050 },
  disney: { '1 Month': 110, '3 Months': 270, '6 Months': 480, '12 Months': 950 },
  prime: { '1 Month': 180, '3 Months': 340, '6 Months': 580, '12 Months': 1120 },
  hbomax: { '1 Month': 140, '3 Months': 310, '6 Months': 470, '12 Months': 980 },
  nordvpn: { '1 Month': 85, '3 Months': 200, '6 Months': 360, '12 Months': 690 },
  crunchy: { '1 Month': 90, '3 Months': 210, '6 Months': 380, '12 Months': 720 },
  nitro: { 'Boost 1m': 479, 'Boost 1 Year': 1597, 'Basic 1m': 135 },
  discordpromocode: { '1 Month': 60, '3 Months': 105 },
  realmembers: { '[500]': 225, '[1000]': 425, '[2000]': 788, '[3000]': 1163, '[4000]': 1224, '[5000]': 1561 },
  chatgpt: { '1 Month': 320, '3 Months': 780, '6 Months': 1250, '12 Months': 2400 },
  'chatgpt-pro': { '1 Month': 350, '3 Months': 600 },
  capcut: { '1 Month': 120, '3 Months': 250, '6 Months': 420, '12 Months': 800 },
  geoguessr: { '1 Month': 200, '3 Months': 500, '12 Months': 1000 },
  filmora: { '1 Month': 250, '3 Months': 600, '6 Months': 1050, '12 Months': 1600 },
  duolingo: { '12 Months': 124 },
  movistar: { '12 Months': 244 },
  dazn: { 'Lifetime': 150 },
  steamaccount: { 'Random Games': 25 }
};

const PLAN_ALIASES = {
  '1 mes':'1 Month','1 month':'1 Month','1m':'1 Month',
  '3 meses':'3 Months','3 month':'3 Months','3m':'3 Months',
  '6 meses':'6 Months','6 month':'6 Months','6m':'6 Months',
  '12 meses':'12 Months','12 month':'12 Months','12m':'12 Months',
  'lifetime':'Lifetime','de por vida':'Lifetime'
};

function normalizePlan(raw){
  if(!raw) return raw; 
  const key = raw.trim().toLowerCase(); 
  return PLAN_ALIASES[key] || raw.trim();
}

// Random casual payment notes to make it look natural
const CASUAL_NOTES = [
  'Gas station',
  'Coffee',
  'Lunch',
  'Dinner',
  'Groceries',
  'Movie tickets',
  'Drinks',
  'Pizza',
  'Breakfast',
  'Snacks',
  'Parking',
  'Taxi',
  'Books',
  'Supplies',
  'Gift'
];

function getRandomNote() {
  return CASUAL_NOTES[Math.floor(Math.random() * CASUAL_NOTES.length)];
}

function generateOrderId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `FF-${timestamp}-${random}`.toUpperCase();
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
      const { cart } = body;

      if (!Array.isArray(cart) || cart.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid cart' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // Calculate total
      let totalCents = 0;
      const items = [];

      for (const item of cart) {
        const { pid, plan, qty } = item;
        const normalizedPlan = normalizePlan(plan);
        const priceMap = PRICES_USD[pid];

        if (!priceMap) {
          return new Response(JSON.stringify({ error: `Unknown product: ${pid}` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const priceCents = priceMap[normalizedPlan];
        if (priceCents === undefined) {
          return new Response(JSON.stringify({ error: `Unknown plan: ${normalizedPlan} for ${pid}` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const lineTotal = priceCents * qty;
        totalCents += lineTotal;

        items.push({
          pid,
          plan: normalizedPlan,
          qty,
          price_cents: priceCents,
          line_total: lineTotal
        });
      }

      const orderId = generateOrderId();
      const casualNote = getRandomNote();
      const amountUSD = (totalCents / 100).toFixed(2);
      const amountEUR = (amountUSD * 0.92).toFixed(2); // Convert to EUR
      const paypalEmail = env.PAYPAL_MANUAL_EMAIL || 'soyalexesp123@gmail.com';

      // Store order in database using Supabase REST API
      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase credentials not configured');
        return new Response(JSON.stringify({ error: 'Database not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const orderData = {
        customer_email: casualNote,
        payment_intent_id: casualNote,
        total_cents: totalCents,
        items: items
      };

      const dbResponse = await fetch(`${supabaseUrl}/rest/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(orderData)
      });

      if (!dbResponse.ok) {
        const errorText = await dbResponse.text();
        console.error('Database error:', errorText);
        return new Response(JSON.stringify({ error: 'Failed to create order' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const savedOrder = await dbResponse.json();
      if (!savedOrder || savedOrder.length === 0) {
        console.error('Order not saved properly');
        return new Response(JSON.stringify({ error: 'Failed to save order' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        orderId: savedOrder[0].id,
        casualNote: casualNote,
        amount: amountEUR,
        amountUSD: amountUSD,
        currency: 'EUR',
        paypalEmail: paypalEmail,
        instructions: {
          step1: `Send €${amountEUR} EUR via PayPal Friends & Family`,
          step2: `To: ${paypalEmail}`,
          step3: `In the note field, include: ${casualNote}`,
          step4: 'Payment will be verified automatically within 1-5 minutes'
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (err) {
      console.error('Error creating PayPal F&F order:', err);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
