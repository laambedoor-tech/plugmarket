/**
 * Cloudflare Workers: Create Stripe Payment Intent
 * Routes: POST /api/create-payment-intent
 * Body: { cart: [ { pid, plan, unitAmount, qty }, ... ] }
 */

// Prices synchronized with frontend subscriptions (values in EUR cents)
// Maintain a single source of truth later by moving to Supabase.
const PRICES_EUR = {
  boosts: { '3 Months': 665 },
  netflix: { '1 Month': 122, '3 Months': 284, '6 Months': 486, '12 Months': 891, 'Bulk': 49, 'Lifetime': 110 },
  spotify: { '1 Month': 178, '3 Months': 308, '6 Months': 502, '12 Months': 962, 'Lifetime': 178 },
  'youtube-premium': { '1 Month': 227, '6 Months': 680, '12 Months': 1013, 'Lifetime': 227 },
  disney: { '1 Month': 89, '3 Months': 219, '6 Months': 389, '12 Months': 770, 'Lifetime': 89 },
  prime: { '1 Month': 65, '3 Months': 178, '12 Months': 599, 'Lifetime': 65 },
  hbomax: { 'Lifetime': 108 },
  nordvpn: { '1 Month': 146, '3 Months': 275, '6 Months': 470, '12 Months': 862, 'Lifetime': 146 },
  crunchy: { '1 Month': 105, '3 Months': 267, '6 Months': 470, '12 Months': 842, 'Lifetime': 105 },
  nitro: { 'Boost 1m': 400, 'Boost 1 Year': 1229, 'Basic 1m': 110 },
  discordpromocode: { '1 Month Nitro': 89, '3 Months Nitro': 99, 'Boost 1m': 89, 'Boost 3m': 99 },
  realmembers: { '[500]': 203, '[1000]': 383, '[2000]': 709, '[3000]': 1047, '[4000]': 1102, '[5000]': 1405 },
  'chatgpt-plus': { '1 Month': 259, '3 Months': 632, '6 Months': 962, '12 Months': 850 },
  'chatgpt-pro': { '1 Month': 315 },
  capcut: { '1 Month': 235, '3 Months': 599, '6 Months': 1069, '12 Months': 1879, 'Lifetime': 235 },
  geoguessr: { '1 Month': 81, '3 Months': 211, '6 Months': 389, '12 Months': 713, 'Lifetime': 81 },
  filmora: { '1 Month': 729, '3 Months': 2187, '6 Months': 4374, '12 Months': 8748, 'Lifetime': 729 },
  duolingo: { '1 Month': 162, '3 Months': 389, '6 Months': 648, '12 Months': 1118, 'Lifetime': 162 },
  movistar: { '1 Month': 292, '3 Months': 729, '6 Months': 1345, '12 Months': 2511, 'Lifetime': 292 },
  dazn: { '1 Month': 259, '3 Months': 664, '6 Months': 1215, '12 Months': 2268, 'Lifetime': 135 },
  steamaccount: { 'Random Games': 65 },
  microsoft: { 'Random Codes': 90 },
  rockstar: { 'Activation Code': 25 },
  minecraft: { 'NFA Lifetime': 100, 'FA Lifetime': 450 },
  stake: { 'Level 2 Verified': 60 },
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
