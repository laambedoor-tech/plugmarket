/**
 * Cloudflare Workers: Create Square payment and assign inventory
 * Routes: POST /api/create-square-payment
 */

import {
  validateAndPriceCart,
  getSupabase,
  assignAccount,
  saveOrder
} from './square-common.js';

export default {
  async fetch(request, env) {
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
      return new Response('Method Not Allowed', {
        status: 405,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/create-square-payment')) {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const squareSecret = env.SQUARE_ACCESS_TOKEN;
    if (!squareSecret) {
      return new Response(
        JSON.stringify({ error: 'Missing SQUARE_ACCESS_TOKEN' }),
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
      const { cart, sourceId, customerEmail } = await request.json();
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
      if (!sourceId) {
        return new Response(
          JSON.stringify({ error: 'Missing card source token' }),
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
      const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const body = {
        source_id: sourceId,
        idempotency_key: idempotencyKey,
        amount_money: {
          amount: totalCents,
          currency: 'EUR'
        },
        autocomplete: true,
        buyer_email_address: customerEmail || undefined,
        note: 'Plug Market card payment',
        metadata: {
          cart: JSON.stringify(normalizedCart),
          customer_email: customerEmail || '',
          site: 'plugmarket'
        }
      };

      const paymentResponse = await fetch('https://connect.squareup.com/v2/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${squareSecret}`
        },
        body: JSON.stringify(body)
      });

      const squareData = await paymentResponse.json();
      if (!paymentResponse.ok || !squareData.payment) {
        console.error('Square payment error:', squareData);
        return new Response(
          JSON.stringify({ error: squareData.errors?.[0]?.detail || squareData.message || 'Payment creation failed' }),
          {
            status: paymentResponse.status || 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      if (squareData.payment.status !== 'COMPLETED') {
        return new Response(
          JSON.stringify({ error: 'Payment was not completed' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      const orderItems = [];
      for (const item of normalizedCart) {
        const qty = Number(item.qty) || 1;
        for (let i = 0; i < qty; i++) {
          try {
            const credentials = await assignAccount(env, item.pid, item.plan, (customerEmail || '').toLowerCase().trim());
            const itemData = {
              pid: item.pid,
              name: item.pid,
              plan: item.plan,
              unitAmount: item.unitAmount,
              credentials
            };
            orderItems.push(itemData);
          } catch (err) {
            console.error(`Failed to assign account for ${item.pid}:`, err.message);
            if (String(err.message).includes('No available accounts')) {
              break;
            }
          }
        }
      }

      if (orderItems.length > 0) {
        await saveOrder(env, (customerEmail || '').toLowerCase().trim(), squareData.payment.id, totalCents, orderItems);
      } else {
        console.warn('Square payment completed but no accounts were assigned:', squareData.payment.id);
      }

      return new Response(
        JSON.stringify({ success: true, paymentId: squareData.payment.id }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    } catch (error) {
      console.error('Error creating Square payment:', error);
      return new Response(
        JSON.stringify({ error: error.message || 'Payment failed' }),
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
