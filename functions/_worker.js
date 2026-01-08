import getStripeConfig from './get-stripe-config.js';
import createPaymentIntent from './create-payment-intent.js';
import stripeWebhook from './stripe-webhook.js';
import getOrders from './get-orders.js';
import getStock from './get-stock.js';
import paypalManualCreate from './paypal-manual-create.js';
import paypalEmailHook from './paypal-email-hook.js';
import submitReview from './submit-review.js';
import getReviews from './get-reviews.js';
import cryptoNowCreate from './crypto-now-create.js';
import cryptoNowIpn from './crypto-now-ipn.js';
import cryptoNowStatus from './crypto-now-status.js';
import coinbaseCreateCharge from './coinbase-create-charge.js';
import coinbaseGetCharge from './coinbase-get-charge.js';
import coinbaseWebhook from './coinbase-webhook.js';

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

    // PayPal manual flow
    if (path === '/api/paypal/manual-create') return paypalManualCreate.fetch(request, env, ctx);
    if (path === '/api/paypal/email-hook') return paypalEmailHook.fetch(request, env, ctx);

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

    // 404 for unknown routes
    return new Response('Not Found', { status: 404 });
  }
};
