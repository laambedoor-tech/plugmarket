/**
 * Cloudflare Workers: Get Square configuration
 * Routes: GET /api/get-square-config
 */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/get-square-config')) {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const applicationId = env.SQUARE_APPLICATION_ID;
    const locationId = env.SQUARE_LOCATION_ID;

    if (!applicationId || !locationId) {
      return new Response(
        JSON.stringify({ error: 'Missing Square configuration' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    return new Response(
      JSON.stringify({ applicationId, locationId }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
};
