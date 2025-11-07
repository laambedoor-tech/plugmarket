// Create a crypto payment intent: compute amount owed; if stablecoin keep 1:1 USD, if volatile fetch price

// Central prices (TODO unify with Stripe/PayPal): accept both '1 mes' and '1 Month'
const PRICES_USD = {
  netflix: { '1 mes': 5.50, '1 Month':5.50, '3 meses': 9.99, '3 Months':9.99, '6 meses': 14, '6 Months':14, '12 meses': 22, '12 Months':22 },
  spotify: { '1 mes': 5, '1 Month':5, '6 meses': 12, '6 Months':12, '12 meses': 18, '12 Months':18 },
  disney: { '1 mes': 5, '1 Month':5, '6 meses': 12, '6 Months':12, '12 meses': 18, '12 Months':18 },
  hbo: { '1 mes': 5, '1 Month':5, '6 meses': 12, '6 Months':12, '12 meses': 18, '12 Months':18 },
  crunchyroll: { '1 mes': 5, '1 Month':5, '6 meses': 12, '6 Months':12, '12 meses': 18, '12 Months':18 },
  youtube: { '1 mes': 5, '1 Month':5, '6 meses': 12, '6 Months':12, '12 meses': 18, '12 Months':18 },
};

function validateAndPriceCart(cart){
  if (!Array.isArray(cart) || !cart.length) throw new Error('Cart is empty');
  let total = 0;
  for (const item of cart){
    const { pid, plan, qty } = item || {};
    if (!pid || !plan || !qty) throw new Error('Invalid cart item');
    const product = PRICES_USD[pid];
    if (!product) throw new Error(`Unknown product: ${pid}`);
    const unit = product[plan];
    if (!unit) throw new Error(`Unknown plan ${plan} for ${pid}`);
    total += unit * qty;
  }
  return { totalUSD: Number(total.toFixed(2)) };
}

async function fetchPriceUSD(coingeckoId){
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`;
  const res = await fetch(url, { cf: { cacheTtl: 60, cacheEverything: true } });
  if(!res.ok) throw new Error('Price feed error');
  const j = await res.json();
  const val = j?.[coingeckoId]?.usd;
  if(!val) throw new Error('Price missing');
  return Number(val);
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    try{
      const { cart, token: requestedToken, network: requestedNetwork } = await request.json();
      const { totalUSD } = validateAndPriceCart(cart);
      const token = (requestedToken || env.CRYPTO_TOKEN || 'USDC').toUpperCase();
      const network = (requestedNetwork || env.CRYPTO_NETWORK || 'Polygon');
      const address = env.CRYPTO_ADDRESS || '0x0000000000000000000000000000000000000000';

      let amount;
      if(['USDC','USDT'].includes(token)){
        amount = totalUSD; // 1:1 stable
      } else {
        // Map token to coingecko id
        const map = { ETH:'ethereum', BTC:'bitcoin', MATIC:'matic-network' };
        const id = map[token];
        if(!id) throw new Error('Unsupported token');
        const price = await fetchPriceUSD(id); // USD per token
        amount = totalUSD / price;
      }
      // Formatting: show up to 6 decimals for volatile
      const decimals = ['USDC','USDT'].includes(token) ? 2 : 6;
      amount = Number(amount.toFixed(decimals));
      return new Response(JSON.stringify({ address, network, token, amount, totalUSD }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }catch(err){
      return new Response(JSON.stringify({ error: err.message || 'Failed to create crypto intent' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  }
};
