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
import getBalance from './get-balance.js';
import createTopupIntent from './create-topup-intent.js';
import getBalanceTransactions from './get-balance-transactions.js';
import payWithBalance from './pay-with-balance.js';
import paypalFFCreateOrder from './paypal-ff-create-order.js';
import paypalFFWebhook from './paypal-ff-webhook.js';
import paypalFFTestComplete from './paypal-ff-test-complete.js';
import paypalFFAutoVerify from './paypal-ff-auto-verify.js';
import searchOrders from './search-orders.js';

export default {
  // Cron trigger for automatic PayPal verification (runs every 2 minutes)
  async scheduled(event, env, ctx) {
    await paypalFFAutoVerify.scheduled(event, env, ctx);
  },
  
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    // Route requests to the correct function
    if (path === '/api/get-stripe-config') return getStripeConfig.fetch(request, env, ctx);
    if (path === '/api/create-payment-intent') return createPaymentIntent.fetch(request, env, ctx);
    if (path === '/api/stripe-webhook') return stripeWebhook.fetch(request, env, ctx);
    if (path === '/api/get-orders') return getOrders.fetch(request, env, ctx);
    if (path === '/api/search-orders') return searchOrders.fetch(request, env, ctx);
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

    // PayPal Friends & Family routes
    if (path === '/api/paypal-ff/create-order') return paypalFFCreateOrder.fetch(request, env, ctx);
    if (path === '/api/paypal-ff/webhook') return paypalFFWebhook.fetch(request, env, ctx);
    if (path === '/api/paypal-ff/test-complete') return paypalFFTestComplete.fetch(request, env, ctx);
    if (path === '/api/paypal-ff/auto-verify') return paypalFFAutoVerify.fetch(request, env, ctx);

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
    if (path === '/api/send-verification-code') return sendVerificationCode.fetch(request, env, ctx);
    if (path === '/api/verify-code') return verifyCode.fetch(request, env, ctx);
    if (path === '/api/get-user-orders') return getUserOrders.fetch(request, env, ctx);
    if (path === '/api/delete-account') return deleteAccount.fetch(request, env, ctx);
    
    // Balance routes
    if (path === '/api/get-balance') return getBalance(request, env);
    if (path === '/api/create-topup-intent') return createTopupIntent(request, env);
    if (path === '/api/get-balance-transactions') return getBalanceTransactions(request, env);
    if (path === '/api/pay-with-balance') return payWithBalance(request, env);

    // 404 for unknown routes
    return new Response('Not Found', { status: 404 });
  }
};
