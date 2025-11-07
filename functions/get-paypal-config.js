/**
 * GET /api/paypal/config
 * Returns public PayPal config for the client (clientId, env, currency)
 */
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }});
    }
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/paypal/config')) return new Response('Not Found', { status: 404 });

    const clientId = env.PAYPAL_CLIENT_ID || '';
    const envName = env.PAYPAL_ENV || 'sandbox';
    const currency = env.PAYPAL_CURRENCY || 'USD';

    return new Response(JSON.stringify({ clientId, env: envName, currency }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
