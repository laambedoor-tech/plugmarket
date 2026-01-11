// Verify the code entered by user and generate JWT token

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { email, code } = body;
    
    if (!email || !code) {
      return new Response(JSON.stringify({ error: 'Email and code are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    // Check if code exists and is valid
    const result = await env.DB.prepare(`
      SELECT * FROM verification_codes 
      WHERE email = ? AND code = ? AND expires_at > datetime('now')
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(email, code).first();
    
    if (!result) {
      return new Response(JSON.stringify({ error: 'Invalid or expired code' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    // Delete used code
    await env.DB.prepare(`
      DELETE FROM verification_codes WHERE email = ? AND code = ?
    `).bind(email, code).run();
    
    // Create or update user record
    await env.DB.prepare(`
      INSERT INTO users (email, last_login, created_at)
      VALUES (?, datetime('now'), datetime('now'))
      ON CONFLICT(email) DO UPDATE SET last_login = datetime('now')
    `).bind(email).run();
    
    // Generate JWT token (simple implementation)
    const token = await generateToken(email, env.JWT_SECRET);
    
    return new Response(JSON.stringify({ 
      success: true,
      token,
      email
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
    
  } catch (error) {
    console.error('Error verifying code:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function generateToken(email, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
  };
  
  const encoder = new TextEncoder();
  
  const headerBase64 = btoa(JSON.stringify(header)).replace(/=/g, '');
  const payloadBase64 = btoa(JSON.stringify(payload)).replace(/=/g, '');
  
  const data = `${headerBase64}.${payloadBase64}`;
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret || 'default-secret-change-in-production'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );
  
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `${data}.${signatureBase64}`;
}
