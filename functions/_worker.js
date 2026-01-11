import getStripeConfig from './get-stripe-config.js';
import createPaymentIntent from './create-payment-intent.js';
import stripeWebhook from './stripe-webhook.js';
import getOrders from './get-orders.js';
import getStock from './get-stock.js';
import paypalCreateOrder from './paypal-create-order.js';
import paypalCaptureOrder from './paypal-capture-order.js';
import submitReview from './submit-review.js';
import getReviews from './get-reviews.js';
import cryptoNowCreate from './crypto-now-create.js';
import cryptoNowIpn from './crypto-now-ipn.js';
import cryptoNowStatus from './crypto-now-status.js';
import coinbaseCreateCharge from './coinbase-create-charge.js';
import coinbaseGetCharge from './coinbase-get-charge.js';
import coinbaseWebhook from './coinbase-webhook.js';
import sendVerificationCode from './send-verification-code.js';
import verifyCode from './verify-code.js';
import getUserOrders from './get-user-orders.js';
import deleteAccount from './delete-account.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route requests to the correct function
    if (path === '/api/get-stripe-config') return getStripeConfig.fetch(request, env, ctx);
    if (path === '/api/create-payment-intent') return createPaymentIntent.fetch(request, env, ctx);
    if (path === '/api/stripe-webhook') return stripeWebhook.fetch(request, env, ctx);
    if (path === '/api/get-orders') return getOrders.fetch(request, env, ctx);
    if (path === '/api/get-stock') return getStock.fetch(request, env, ctx);

    // PayPal Business API
    if (path === '/api/paypal/config') {
      return new Response(JSON.stringify({ 
        clientId: env.PAYPAL_CLIENT_ID || '', 
        currency: 'USD' 
      }), { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        } 
      });
    }
    if (path === '/api/paypal/create-order') return paypalCreateOrder.fetch(request, env, ctx);
    if (path === '/api/paypal/capture-order') return paypalCaptureOrder.fetch(request, env, ctx);

    // NOWPayments crypto routes
    if (path === '/api/crypto/now/create') return cryptoNowCreate.fetch(request, env, ctx);
    if (path === '/api/crypto/now/ipn') return cryptoNowIpn.fetch(request, env, ctx);
    if (path === '/api/crypto/now/status') return cryptoNowStatus.fetch(request, env, ctx);

    // Coinbase Commerce routes
    if (path === '/api/coinbase/create-charge') return coinbaseCreateCharge(request, env);
    if (path === '/api/coinbase/get-charge') return coinbaseGetCharge(request, env);
    if (path === '/api/coinbase/webhook') return coinbaseWebhook(request, env);

    if (path === '/api/submit-review') return submitReview.fetch(request, env, ctx);
    if (path === '/api/get-reviews') return getReviews.fetch(request, env, ctx);

    // Auth routes
    if (path === '/send-verification-code') return sendVerificationCode.onRequestPost({ request, env, ctx });
    if (path === '/verify-code') return verifyCode.onRequestPost({ request, env, ctx });
    if (path === '/get-user-orders') return getUserOrders.onRequestPost({ request, env, ctx });
    if (path === '/delete-account') return deleteAccount.onRequestPost({ request, env, ctx });

    // 404 for unknown routes
    return new Response('Not Found', { status: 404 });
  }
};
