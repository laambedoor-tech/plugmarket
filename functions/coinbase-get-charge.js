// Coinbase Commerce: Get charge details (polling for addresses)
// Queries Coinbase API to get the latest charge status including addresses

export default async function handleCoinbaseGetCharge(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  
  try {
    const url = new URL(request.url);
    const chargeCode = url.searchParams.get('chargeCode');
    
    if (!chargeCode) {
      return new Response(JSON.stringify({ error: 'chargeCode required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    
    const apiKey = env.COINBASE_API_KEY;
    if (!apiKey) throw new Error('COINBASE_API_KEY not configured');
    
    // Query Coinbase API for charge details
    const response = await fetch(`https://api.commerce.coinbase.com/charges/${chargeCode}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-CC-Api-Key': apiKey,
        'X-CC-Version': '2018-03-22'
      }
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Coinbase API error:', result);
      return new Response(JSON.stringify({ error: result.error?.message || 'Failed to fetch charge' }), { status: response.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    
    const charge = result.data;
    const addresses = charge.addresses || {};
    const pricing = charge.pricing || {};
    
    console.log('Get charge response:', { code: charge.code, status: charge.status, addresses, timeline: charge.timeline?.length || 0 });
    
    return new Response(JSON.stringify({
      chargeCode: charge.code,
      status: charge.status,
      addresses,
      pricing,
      amount: charge.pricing?.local?.amount || '0',
      currency: charge.pricing?.local?.currency || 'USD',
      timeline: charge.timeline || []
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    
  } catch (err) {
    console.error('Get charge error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}
