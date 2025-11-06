/**
 * Cloudflare Workers: Create Stripe Payment Intent
 * Routes: POST /api/create-payment-intent
 * Body: { cart: [ { pid, plan, unitAmount, qty }, ... ] }
 */

const PRICES_USD = {
  netflix: { '1 Month': 150, '3 Months': 400, 'Yearly': 1200 },
  spotify: { '1 Month': 120, '3 Months': 300, 'Yearly': 1000 },
  'youtube-premium': { '1 Month': 150, '3 Months': 400, 'Yearly': 1300 },
  'hulu': { 'Standard': 1500, 'Ad-Free': 1700 }
};

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

    const unitPrice = prices[item.plan];
    if (unitPrice === undefined) {
      throw new Error(`Unknown plan "${item.plan}" for ${item.pid}`);
    }

    const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
    totalCents += unitPrice * qty;

    normalizedCart.push({
      pid: item.pid,
      plan: item.plan,
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
        currency: 'usd',
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
