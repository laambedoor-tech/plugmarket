import getStripeConfig from './get-stripe-config.js';
import createPaymentIntent from './create-payment-intent.js';
import stripeWebhook from './stripe-webhook.js';
import getOrders from './get-orders.js';
import getStock from './get-stock.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route requests to the correct function
    if (path === '/api/get-stripe-config') {
      return getStripeConfig.fetch(request, env, ctx);
    }
    
    if (path === '/api/create-payment-intent') {
      return createPaymentIntent.fetch(request, env, ctx);
    }
    
    if (path === '/api/stripe-webhook') {
      return stripeWebhook.fetch(request, env, ctx);
    }

    if (path === '/api/get-orders') {
      return getOrders.fetch(request, env, ctx);
    }

    if (path === '/api/get-stock') {
      return getStock.fetch(request, env, ctx);
    }

    // 404 for unknown routes
    return new Response('Not Found', { status: 404 });
  }
};
