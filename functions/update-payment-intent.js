/**
 * Update Stripe Payment Intent with customer email
 * This updates the metadata after the payment intent is created
 */

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
      const { clientSecret, customerEmail } = await request.json();

      if (!clientSecret || !customerEmail) {
        return new Response(
          JSON.stringify({ error: 'Missing clientSecret or customerEmail' }),
          { 
            status: 400, 
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Extract payment intent ID from client secret
      const paymentIntentId = clientSecret.split('_secret_')[0];

      // Update payment intent metadata
      const response = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecret}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          'metadata[customer_email]': customerEmail
        })
      });

      const stripeResponse = await response.json();

      if (!response.ok) {
        console.error('Stripe error:', stripeResponse);
        return new Response(
          JSON.stringify({ error: stripeResponse.error?.message || 'Update failed' }),
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
        JSON.stringify({ success: true }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    } catch (error) {
      console.error('Error updating payment intent:', error);
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
