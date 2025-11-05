exports.handler = async () => {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing STRIPE_PUBLISHABLE_KEY' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ publishableKey }),
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  };
};
