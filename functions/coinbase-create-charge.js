// Coinbase Commerce: Create charge endpoint
// Generates a unique payment address for LTC or BTC

const PRICES_USD = {
  'boosts': { '3 Months': 5.25 },
  'netflix': { '1 Month': 1.5, '3 Months': 3.5, '6 Months': 6.0, '12 Months': 11.0, 'Lifetime': 1.10 },
  'spotify': { '1 Month': 2.2, '3 Months': 3.8, '6 Months': 6.2, '12 Months': 11.88, 'Lifetime': 1.78 },
  'youtube-premium': { '1 Month': 1.6, '3 Months': 3.2, '6 Months': 5.5, '12 Months': 10.5, 'Lifetime': 2.27 },
  'disney-plus': { '1 Month': 1.1, '3 Months': 2.7, '6 Months': 4.8, '12 Months': 9.5, 'Lifetime': 0.89 },
  'disney': { '1 Month': 1.1, '3 Months': 2.7, '6 Months': 4.8, '12 Months': 9.5, 'Lifetime': 0.89 },
  'amazon-prime': { '1 Month': 1.8, '3 Months': 3.4, '6 Months': 5.8, '12 Months': 10.64, 'Lifetime': 14.0 },
  'prime': { '1 Month': 1.8, '3 Months': 3.4, '6 Months': 5.8, '12 Months': 10.64, 'Lifetime': 14.0 },
  'hbo-max': { '1 Month': 1.4, '3 Months': 3.1, '6 Months': 4.7, '12 Months': 9.8, 'Lifetime': 13.0 },
  'hbomax': { '1 Month': 1.4, '3 Months': 3.1, '6 Months': 4.7, '12 Months': 9.8, 'Lifetime': 13.0 },
  'nord-vpn': { '1 Month': 0.85, '3 Months': 2.0, '6 Months': 3.6, '12 Months': 6.9, 'Lifetime': 1.46 },
  'nordvpn': { '1 Month': 0.85, '3 Months': 2.0, '6 Months': 3.6, '12 Months': 6.9, 'Lifetime': 1.46 },
  'crunchyroll': { '1 Month': 0.9, '3 Months': 2.1, '6 Months': 3.8, '12 Months': 7.2, 'Lifetime': 1.05 },
  'crunchy': { '1 Month': 0.9, '3 Months': 2.1, '6 Months': 3.8, '12 Months': 7.2, 'Lifetime': 1.05 },
  'discord-nitro': { 'Boost 1m': 4.95, 'Boost 1 Year': 15.17, 'Basic 1m': 1.35 },
  'nitro': { 'Boost 1m': 4.95, 'Boost 1 Year': 15.17, 'Basic 1m': 1.35 },
  'discordpromocode': { '1 Month': 0.6, '3 Months': 1.05, 'Boost 1m': 4.95, 'Boost 3m': 15.0 },
  'realmembers': { '[500]': 2.25, '[1000]': 4.25, '[2000]': 7.88, '[3000]': 11.63, '[4000]': 12.24, '[5000]': 15.61 },
  'chatgpt-plus': { '1 Month': 3.2, '3 Months': 7.8, '6 Months': 11.88, '12 Months': 16.85 },
  'chatgpt': { '1 Month': 3.2, '3 Months': 7.8, '6 Months': 11.88, '12 Months': 16.85 },
  'chatgpt-pro': { '1 Month': 3.15, '3 Months': 6.0 },
  'capcut-pro': { '1 Month': 1.2, '3 Months': 2.5, '6 Months': 4.2, '12 Months': 8.0, 'Lifetime': 2.35 },
  'capcut': { '1 Month': 1.2, '3 Months': 2.5, '6 Months': 4.2, '12 Months': 8.0, 'Lifetime': 2.35 },
  'geoguessr': { '1 Month': 2.0, '3 Months': 5.0, '12 Months': 10.0, 'Lifetime': 0.81 },
  'filmora': { '1 Month': 2.5, '3 Months': 6.0, '6 Months': 10.5, '12 Months': 16.0, 'Lifetime': 7.29 },
  'duolingo': { '12 Months': 1.24, 'Lifetime': 1.62 },
  'movistar': { '12 Months': 2.44, 'Lifetime': 2.92 },
  'dazn': { 'Lifetime': 1.35 },
  'steamaccount': { 'Random Games': 0.25 },
  'microsoft': { 'Random Codes': 0.40 },
  'rockstar': { 'Activation Code': 0.25 },
  'minecraft': { 'NFA Lifetime': 1.00, 'FA Lifetime': 4.50 },
  'stake': { 'Level 2 Verified': 0.60 },
  'xbox': { 'Game Pass Lifetime': 0.60 }
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
    
    console.log('Coinbase charge response:', { code: charge.code, addresses, pricing, currency });
    
    // Get address and amount for selected currency (try multiple key formats)
    const payAddress = addresses[currency.toLowerCase()] || addresses[currency] || addresses[payCurrency] || '';
    const currencyPricing = pricing[currency.toLowerCase()] || pricing[currency] || pricing[payCurrency] || {};
    const payAmount = currencyPricing.amount || '0';
    
    console.log('Extracted values:', { payAddress, payAmount, currency });
    
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
