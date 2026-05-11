import {
  getSupabase,
  saveTopupTransaction
} from './square-common.js';

export default async function handler(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
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

    const { amount, sourceId } = await request.json();
    if (!sourceId) {
      return new Response(JSON.stringify({ error: 'Missing card source token' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (!amount || amount < 5) {
      return new Response(JSON.stringify({ error: 'Minimum top-up amount is $5.00' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (amount > 500) {
      return new Response(JSON.stringify({ error: 'Maximum top-up amount is $500.00' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const squareSecretKey = env.SQUARE_ACCESS_TOKEN;
    if (!squareSecretKey) {
      throw new Error('Missing SQUARE_ACCESS_TOKEN');
    }

    const amountInCents = Math.round(amount * 100);
    const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const response = await fetch('https://connect.squareup.com/v2/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${squareSecretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source_id: sourceId,
        idempotency_key: idempotencyKey,
        amount_money: {
          amount: amountInCents,
          currency: 'EUR'
        },
        autocomplete: true,
        buyer_email_address: email,
        note: `Balance top-up for ${email}`
      })
    });

    const squareData = await response.json();
    if (!response.ok || !squareData.payment) {
      const errMsg = squareData.errors?.[0]?.detail || squareData.message || 'Square top-up request failed';
      throw new Error(errMsg);
    }

    if (squareData.payment.status !== 'COMPLETED') {
      throw new Error('Top-up payment was not completed');
    }

    await saveTopupTransaction(env, email.toLowerCase().trim(), amount, squareData.payment.id);

    return new Response(JSON.stringify({
      success: true,
      paymentId: squareData.payment.id
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error creating Square top-up:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to create topup payment' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
