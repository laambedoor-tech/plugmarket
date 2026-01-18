/**
 * Cloudflare Workers: Create Stripe Payment Intent
 * Routes: POST /api/create-payment-intent
 * Body: { cart: [ { pid, plan, unitAmount, qty }, ... ] }
 */

// Prices synchronized with frontend subscriptions (values in EUR cents)
// Maintain a single source of truth later by moving to Supabase.
const PRICES_EUR = {
  netflix: { '1 Month': 69, '3 Months': 161, '6 Months': 276, '12 Months': 506, 'Lifetime': 828 },
  spotify: { '1 Month': 101, '3 Months': 175, '6 Months': 285, '12 Months': 575 },
  'youtube-premium': { '1 Month': 74, '3 Months': 147, '6 Months': 253, '12 Months': 483 },
  disney: { '1 Month': 51, '3 Months': 124, '6 Months': 221, '12 Months': 437 },
  prime: { '1 Month': 83, '3 Months': 157, '6 Months': 267, '12 Months': 515 },
  hbomax: { '1 Month': 64, '3 Months': 143, '6 Months': 216, '12 Months': 451 },
  nordvpn: { '1 Month': 39, '3 Months': 92, '6 Months': 166, '12 Months': 318 },
  crunchy: { '1 Month': 41, '3 Months': 97, '6 Months': 175, '12 Months': 331 },
  nitro: { 'Boost 1m': 253, 'Boost 1 Year': 735, 'Basic 1m': 62 },
  discordpromocode: { '1 Month': 28, '3 Months': 48 },
  realmembers: { '[500]': 104, '[1000]': 196, '[2000]': 363, '[3000]': 535, '[4000]': 563, '[5000]': 719 },
  chatgpt: { '1 Month': 147, '3 Months': 359, '6 Months': 575, '12 Months': 1104 },
  'chatgpt-pro': { '1 Month': 161, '3 Months': 276 },
  capcut: { '1 Month': 55, '3 Months': 115, '6 Months': 193, '12 Months': 368 },
  geoguessr: { '1 Month': 81, '3 Months': 211, '6 Months': 389, '12 Months': 713 },
  filmora: { '1 Month': 115, '3 Months': 276, '6 Months': 483, '12 Months': 736 },
  duolingo: { '12 Months': 57 },
  movistar: { '12 Months': 112 },
  dazn: { 'Lifetime': 69 },
  steamaccount: { 'Random Games': 12 },
  microsoft: { 'Random Codes': 18 },
  rockstar: { 'Activation Code': 12 },
  minecraft: { 'NFA Lifetime': 46, 'FA Lifetime': 230 },
  stake: { 'Level 2 Verified': 28 },
  xbox: { 'Game Pass Lifetime': 60 }
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

    const prices = PRICES_EUR[item.pid];
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
      const { cart, customerEmail } = await request.json();

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
          site: 'plugmarket',
          customer_email: customerEmail || ''
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
