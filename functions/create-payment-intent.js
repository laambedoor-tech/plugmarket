/**
 * Cloudflare Workers: Create Stripe Payment Intent
 * Routes: POST /api/create-payment-intent
 * Body: { cart: [ { pid, plan, unitAmount, qty }, ... ] }
 */

// Prices synchronized with frontend subscriptions (values in cents)
// Maintain a single source of truth later by moving to Supabase.
const PRICES_USD = {
  netflix: { '1 Month': 150, '3 Months': 350, '6 Months': 600, '12 Months': 1100, 'Lifetime': 1800 },
  spotify: { '1 Month': 220, '3 Months': 380, '6 Months': 620, '12 Months': 1250 },
  'youtube-premium': { '1 Month': 160, '3 Months': 320, '6 Months': 550, '12 Months': 1050 },
  disney: { '1 Month': 110, '3 Months': 270, '6 Months': 480, '12 Months': 950 },
  prime: { '1 Month': 180, '3 Months': 340, '6 Months': 580, '12 Months': 1120 },
  hbomax: { '1 Month': 140, '3 Months': 310, '6 Months': 470, '12 Months': 980 },
  nordvpn: { '1 Month': 85, '3 Months': 200, '6 Months': 360, '12 Months': 690 },
  crunchy: { '1 Month': 90, '3 Months': 210, '6 Months': 380, '12 Months': 720 },
  nitro: { 'Boost 1m': 550, 'Boost 1 Year': 1597, 'Basic 1m': 135 },
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
  const key = raw.trim();
  return PLAN_ALIASES[key.toLowerCase()] || key;
}

function validateAndPriceCart(cart) {
  let totalCents = 0;
  const normalizedCart = [];

  for (const item of cart) {
    if (!item.pid || !item.plan) {
      throw new Error('Missing pid or plan in cart item');
    }

    const prices = PRICES_USD[item.pid];
    if (!prices) {
      throw new Error(`Unknown product: ${item.pid}`);
    }

    const originalPlan = item.plan;
    const plan = normalizePlan(originalPlan);
    const unitPrice = prices[plan];
    if (unitPrice === undefined) {
      throw new Error(`Unknown plan "${originalPlan}" (normalized="${plan}") for ${item.pid}`);
    }

    const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
    totalCents += unitPrice * qty;

    normalizedCart.push({
      pid: item.pid,
      plan,
      unitAmount: unitPrice,
      qty
    });
  }

  return { totalCents, normalizedCart };
}

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/create-payment-intent')) {
      return new Response('Not Found', { status: 404 });
    }

    const stripeSecret = env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return new Response(
        JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY' }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    try {
      const { cart } = await request.json();

      if (!Array.isArray(cart) || cart.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Invalid or empty cart' }),
          { 
            status: 400, 
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      const { totalCents, normalizedCart } = validateAndPriceCart(cart);

      // Create Stripe PaymentIntent
      const paymentIntentData = {
        amount: totalCents,
        currency: 'eur',
        automatic_payment_methods: { enabled: true },
        metadata: {
          cart: JSON.stringify(normalizedCart),
          site: 'plugmarket'
        }
      };

      const response = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecret}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(
          Object.entries(paymentIntentData).reduce((acc, [key, val]) => {
            if (key === 'metadata') {
              Object.entries(val).forEach(([k, v]) => {
                acc[`metadata[${k}]`] = v;
              });
            } else if (key === 'automatic_payment_methods') {
              acc['automatic_payment_methods[enabled]'] = val.enabled;
            } else {
              acc[key] = val;
            }
            return acc;
          }, {})
        )
      });

      const stripeResponse = await response.json();

      if (!response.ok) {
        console.error('Stripe error:', stripeResponse);
        return new Response(
          JSON.stringify({ error: stripeResponse.error?.message || 'Payment intent creation failed' }),
          { 
            status: response.status, 
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      return new Response(
        JSON.stringify({
          clientSecret: stripeResponse.client_secret,
          id: stripeResponse.id
        }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    } catch (error) {
      console.error('Error creating payment intent:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }
};
