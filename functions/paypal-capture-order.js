/**
 * POST /api/paypal/capture-order
 * Body: { orderId }
 */

async function getAccessToken(env){
  const base = (env.PAYPAL_ENV || 'sandbox') === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const clientId = env.PAYPAL_CLIENT_ID;
  const secret = env.PAYPAL_SECRET;
  if (!clientId || !secret) throw new Error('Missing PayPal credentials');
  const creds = btoa(`${clientId}:${secret}`);
  const res = await fetch(base + '/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || 'Failed to get token');
  return { token: json.access_token, base };
}

export default {
  async fetch(request, env){
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/paypal/capture-order')) return new Response('Not Found', { status: 404 });
    try {
      const { orderId } = await request.json();
      if (!orderId) return new Response(JSON.stringify({ error: 'Missing orderId' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      const { token, base } = await getAccessToken(env);
      const res = await fetch(base + `/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) return new Response(JSON.stringify({ error: data.message || 'Capture failed' }), { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      return new Response(JSON.stringify({ status: 'captured', order: data }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    } catch (err){
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
  }
};
