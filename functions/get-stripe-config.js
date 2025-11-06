/**
 * Cloudflare Workers: Get Stripe Publishable Key
 * Routes: GET /api/get-stripe-config
 */

export default {
  async fetch(request, env) {
    // Only handle GET requests
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Only serve /api/get-stripe-config
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/get-stripe-config')) {
      return new Response('Not Found', { status: 404 });
    }

    const publishableKey = env.STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey) {
      return new Response(
        JSON.stringify({ error: 'Missing STRIPE_PUBLISHABLE_KEY' }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        }
      );
    }

    return new Response(
      JSON.stringify({ publishableKey }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      }
    );
  }
};
