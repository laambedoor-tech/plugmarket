export default {
  async fetch(request, env) {
    // Multi-token/network config
    const networks = [
      { id: 'ethereum', label: 'Ethereum' },
      { id: 'polygon', label: 'Polygon' },
      { id: 'bsc', label: 'BNB Chain' },
      { id: 'optimism', label: 'Optimism' },
      { id: 'arbitrum', label: 'Arbitrum One' }
    ];

    const tokens = [
      { symbol: 'USDC', type: 'stable', decimals: 6 },
      { symbol: 'USDT', type: 'stable', decimals: 6 },
      { symbol: 'ETH', type: 'volatile', coingecko: 'ethereum', decimals: 18 },
      { symbol: 'BTC', type: 'volatile', coingecko: 'bitcoin', decimals: 8 },
      { symbol: 'MATIC', type: 'volatile', coingecko: 'matic-network', decimals: 18 }
    ];

    const body = {
      enabled: true,
      defaultNetwork: (env.CRYPTO_NETWORK || 'polygon').toLowerCase(),
      defaultToken: env.CRYPTO_TOKEN || 'USDC',
      address: env.CRYPTO_ADDRESS || '0x0000000000000000000000000000000000000000',
      networks,
      tokens
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
};
