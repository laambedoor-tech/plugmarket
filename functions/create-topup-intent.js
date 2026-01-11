// Create Stripe payment intent for balance top-up
export default async function handler(request, env) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const token = authHeader.substring(7);
    
    // Decode JWT to get email
    const parts = token.split('.');
    if (parts.length !== 3) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = JSON.parse(atob(parts[1]));
    const email = payload.email;

    if (!email) {
      return new Response(JSON.stringify({ error: 'Invalid token payload' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { amount } = await request.json();

    if (!amount || amount < 5) {
      return new Response(JSON.stringify({ 
        error: 'Minimum top-up amount is $5.00' 
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (amount > 500) {
      return new Response(JSON.stringify({ 
        error: 'Maximum top-up amount is $500.00' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create Stripe payment intent
    const stripeSecretKey = env.STRIPE_SECRET_KEY;
    const amountInCents = Math.round(amount * 100);

    const paymentIntentResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        amount: amountInCents.toString(),
        currency: 'usd',
        'metadata[type]': 'balance_topup',
        'metadata[user_email]': email,
        'metadata[amount]': amount.toString(),
        description: `Balance top-up for ${email}`
      })
    });

    if (!paymentIntentResponse.ok) {
      const error = await paymentIntentResponse.text();
      throw new Error(`Stripe error: ${error}`);
    }

    const paymentIntent = await paymentIntentResponse.json();

    return new Response(JSON.stringify({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error creating topup intent:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to create payment intent',
      details: error.message 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
