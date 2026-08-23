import getSquareConfig from './get-square-config.js';
import createSquarePayment from './create-square-payment.js';
import getStripeConfig from './get-stripe-config.js';
import createPaymentIntent from './create-payment-intent.js';
import updatePaymentIntent from './update-payment-intent.js';
import createTopupIntent from './create-topup-intent.js';
import stripeWebhook from './stripe-webhook.js';
import getOrders from './get-orders.js';
import getStock from './get-stock.js';
import debugNetflixAccounts from './debug-netflix-accounts.js';
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
import createSquareTopup from './create-square-topup.js';
import getBalanceTransactions from './get-balance-transactions.js';
import payWithBalance from './pay-with-balance.js';
import paypalFFCreateOrder from './paypal-ff-create-order.js';
import paypalFFWebhook from './paypal-ff-webhook.js';
import paypalFFCheckOrder from './paypal-ff-check-order.js';
import paypalFFManualComplete from './paypal-ff-manual-complete.js';
import paypalFFConfirm from './paypal-ff-confirm.js';
import searchOrders from './search-orders.js';
import findMissingOrders from './find-missing-orders.js';
import recoverStripeOrder from './recover-stripe-order.js';
import manualCreateOrder from './manual-create-order.js';

function addCorsHeaders(response) {
  const headers = new Headers(response.headers);
  if (!headers.has('Access-Control-Allow-Origin')) {
    headers.set('Access-Control-Allow-Origin', '*');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
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

    let response;

    // Route requests to the correct function
    if (path === '/api/get-stripe-config') response = await getStripeConfig.fetch(request, env, ctx);
    else if (path === '/api/create-payment-intent') response = await createPaymentIntent.fetch(request, env, ctx);
    else if (path === '/api/update-payment-intent') response = await updatePaymentIntent.fetch(request, env, ctx);
    else if (path === '/api/create-topup-intent') response = await createTopupIntent(request, env);
    else if (path === '/api/get-square-config') response = await getSquareConfig.fetch(request, env, ctx);
    else if (path === '/api/create-square-payment') response = await createSquarePayment.fetch(request, env, ctx);
    else if (path === '/api/stripe-webhook') response = await stripeWebhook.fetch(request, env, ctx);
    else if (path === '/api/recover-stripe-order') response = await recoverStripeOrder.fetch(request, env, ctx);
    else if (path === '/api/manual-create-order') response = await manualCreateOrder.fetch(request, env, ctx);
    else if (path === '/api/get-orders') response = await getOrders.fetch(request, env, ctx);
    else if (path === '/api/search-orders') response = await searchOrders.fetch(request, env, ctx);
    else if (path === '/api/find-missing-orders') response = await findMissingOrders.fetch(request, env, ctx);
    else if (path === '/api/get-stock') response = await getStock.fetch(request, env, ctx);
    else if (path === '/api/debug-netflix-accounts') response = await debugNetflixAccounts.fetch(request, env, ctx);
    else if (path === '/api/paypal-ff/create-order') response = await paypalFFCreateOrder.fetch(request, env, ctx);
    else if (path === '/api/paypal-ff/webhook') response = await paypalFFWebhook.fetch(request, env, ctx);
    else if (path === '/api/paypal-ff/check-order') response = await paypalFFCheckOrder.fetch(request, env, ctx);
    else if (path === '/api/paypal-ff/manual-complete') response = await paypalFFManualComplete.fetch(request, env, ctx);
    else if (path === '/api/paypal-ff/confirm') response = await paypalFFConfirm.fetch(request, env, ctx);
    else if (path === '/api/crypto/now/create') response = await cryptoNowCreate.fetch(request, env, ctx);
    else if (path === '/api/crypto/now/ipn') response = await cryptoNowIpn.fetch(request, env, ctx);
    else if (path === '/api/crypto/now/status') response = await cryptoNowStatus.fetch(request, env, ctx);
    else if (path === '/api/coinbase/create-charge') response = await coinbaseCreateCharge(request, env);
    else if (path === '/api/coinbase/get-charge') response = await coinbaseGetCharge(request, env);
    else if (path === '/api/coinbase/webhook') response = await coinbaseWebhook(request, env);
    else if (path === '/api/submit-review') response = await submitReview.fetch(request, env, ctx);
    else if (path === '/api/get-reviews') response = await getReviews.fetch(request, env, ctx);
    else if (path === '/api/send-verification-code') response = await sendVerificationCode.fetch(request, env, ctx);
    else if (path === '/api/verify-code') response = await verifyCode.fetch(request, env, ctx);
    else if (path === '/api/get-user-orders') response = await getUserOrders.fetch(request, env, ctx);
    else if (path === '/api/delete-account') response = await deleteAccount.fetch(request, env, ctx);
    else if (path === '/api/get-balance') response = await getBalance(request, env);
    else if (path === '/api/create-square-topup') response = await createSquareTopup(request, env);
    else if (path === '/api/get-balance-transactions') response = await getBalanceTransactions(request, env);
    else if (path === '/api/pay-with-balance') response = await payWithBalance(request, env);
    else response = new Response('Not Found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain'
      }
    });

    return addCorsHeaders(response);
  }
};
