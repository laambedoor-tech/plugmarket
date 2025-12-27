// Coinbase Commerce: Create charge endpoint
// Generates a unique payment address for LTC or BTC

const PRICES_USD = {
  'netflix': { '1 Month': 3.50, '3 Months': 9.50, '6 Months': 18.00, '12 Months': 35.00 },
  'spotify': { '1 Month': 2.50, '3 Months': 7.00, '6 Months': 13.00, '12 Months': 24.00 },
  'youtube-premium': { '1 Month': 3.00, '3 Months': 8.50, '6 Months': 16.00, '12 Months': 30.00 },
  'disney-plus': { '1 Month': 3.00, '3 Months': 8.50, '6 Months': 16.00, '12 Months': 30.00 },
  'hbo-max': { '1 Month': 3.00, '3 Months': 8.50, '6 Months': 16.00, '12 Months': 30.00 },
  'amazon-prime': { '1 Month': 2.50, '3 Months': 7.00, '6 Months': 13.00, '12 Months': 24.00 },
  'crunchyroll': { '1 Month': 2.50, '3 Months': 7.00, '6 Months': 13.00, '12 Months': 24.00 },
  'paramount-plus': { '1 Month': 2.00, '3 Months': 5.50, '6 Months': 10.00, '12 Months': 19.00 },
  'apple-tv': { '1 Month': 2.50, '3 Months': 7.00, '6 Months': 13.00, '12 Months': 24.00 },
  'dazn': { '1 Month': 4.00, '3 Months': 11.00, '6 Months': 21.00, '12 Months': 40.00 },
  'plex': { 'Lifetime': 25.00 },
  'duolingo': { '12 Months': 20.00 },
  'canva-pro': { '12 Months': 15.00 },
  'grammarly': { '12 Months': 18.00 },
  'geoguessr': { '12 Months': 12.00 },
  'chatgpt-plus': { '1 Month': 15.00 },
  'nord-vpn': { '12 Months': 35.00, '24 Months': 65.00 }
};

function normalizePlan(p) {
  const lower = String(p || '').toLowerCase().trim();
  if (lower === '1 mes' || lower === '1 month') return '1 Month';
  if (lower === '3 meses' || lower === '3 months') return '3 Months';
  if (lower === '6 meses' || lower === '6 months') return '6 Months';
  if (lower === '12 meses' || lower === '12 months') return '12 Months';
  if (lower === '24 meses' || lower === '24 months') return '24 Months';
  if (lower === 'lifetime') return 'Lifetime';
  return p;
}

function validateAndPriceCart(cart) {
  if (!Array.isArray(cart) || cart.length === 0) throw new Error('Cart is empty');
  let total = 0;
  for (const item of cart) {
    let { pid, plan, qty } = item;
    if (!pid || !plan || !qty) throw new Error('Invalid cart item');
    // Normalize product IDs
    if (pid === 'nordvpn') pid = 'nord-vpn';
    const norm = normalizePlan(plan);
    const price = PRICES_USD[pid]?.[norm];
    if (price == null) throw new Error(`Invalid product or plan: ${pid} - ${norm}`);
    total += price * qty;
  }
  return total;
}

export default async function handleCoinbaseCreateCharge(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  
  try {
    const body = await request.json();
    const { cart, customerEmail, payCurrency } = body;
    
    if (!customerEmail || !/@/.test(customerEmail)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    
    if (!payCurrency || !['ltc', 'btc'].includes(payCurrency.toLowerCase())) {
      return new Response(JSON.stringify({ error: 'Only LTC and BTC are supported' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    
    const totalUSD = validateAndPriceCart(cart);
    
    // Create charge with Coinbase Commerce API
    const apiKey = env.COINBASE_API_KEY;
    if (!apiKey) throw new Error('COINBASE_API_KEY not configured');
    
    // Build metadata with cart items and email
    const metadata = {
      customerEmail,
      cart: cart.map(i => ({ pid: i.pid, plan: normalizePlan(i.plan), qty: i.qty }))
    };
    
    const chargePayload = {
      name: 'Plug Market Order',
      description: `Order for ${cart.length} item(s)`,
      pricing_type: 'fixed_price',
      local_price: {
        amount: totalUSD.toFixed(2),
        currency: 'USD'
      },
      metadata,
      redirect_url: 'https://plugmarket.es/cart.html',
      cancel_url: 'https://plugmarket.es/cart.html'
    };
    
    const response = await fetch('https://api.commerce.coinbase.com/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CC-Api-Key': apiKey,
        'X-CC-Version': '2018-03-22'
      },
      body: JSON.stringify(chargePayload)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Coinbase API error:', result);
      return new Response(JSON.stringify({ error: result.error?.message || 'Failed to create charge' }), { status: response.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    
    const charge = result.data;
    const currency = payCurrency.toUpperCase();
    const addresses = charge.addresses || {};
    const pricing = charge.pricing || {};
    
    // Get address and amount for selected currency
    const payAddress = addresses[currency.toLowerCase()] || addresses[currency] || '';
    const currencyPricing = pricing[currency.toLowerCase()] || pricing[currency] || {};
    const payAmount = currencyPricing.amount || '0';
    
    return new Response(JSON.stringify({
      chargeCode: charge.code,
      chargeId: charge.id,
      payAddress,
      payAmount,
      payCurrency: currency,
      priceAmount: totalUSD,
      hostedUrl: charge.hosted_url
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    
  } catch (err) {
    console.error('Create charge error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}
