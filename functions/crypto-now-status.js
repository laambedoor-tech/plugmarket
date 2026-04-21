/**
 * GET /api/crypto/now/status?paymentId=XXX
 * Get real-time payment status from NOWPayments
 */

export default {
  async fetch(request, env){
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    
    let paymentId;
    
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (!url.pathname.startsWith('/api/crypto/now/status')) return new Response('Not Found', { status: 404 });
      paymentId = url.searchParams.get('paymentId');
    } else if (request.method === 'POST') {
      const body = await request.json();
      paymentId = body.paymentId;
    } else {
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (!paymentId) return new Response(JSON.stringify({ error: 'Missing paymentId' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

    const apiKey = env.NOWPAYMENTS_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

    try {
      const res = await fetch(`https://api.nowpayments.io/v1/payment/${paymentId}`, {
        headers: { 'x-api-key': apiKey }
      });
      const data = await res.json();
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.message || 'Failed to fetch status', status: 'error' }), { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      return new Response(JSON.stringify({
        status: data.payment_status || 'unknown',
        paymentId: data.payment_id,
        amountReceived: data.amount_received,
        payAmount: data.pay_amount,
        payCurrency: data.pay_currency,
        priceAmount: data.price_amount
      }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    } catch (err){
      return new Response(JSON.stringify({ error: err.message, status: 'error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
  }
};
