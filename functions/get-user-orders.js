// Get user orders from database

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const authHeader = request.headers.get('Authorization');
    const body = await request.json();
    const { email } = body;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    const token = authHeader.substring(7);
    const isValid = await verifyToken(token, env.JWT_SECRET);
    
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    // Get user info
    const user = await env.DB.prepare(`
      SELECT email, created_at, last_login FROM users WHERE email = ?
    `).bind(email).first();
    
    // Get user orders
    const orders = await env.DB.prepare(`
      SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC
    `).bind(email).all();
    
    return new Response(JSON.stringify({
      success: true,
      customer_since: user?.created_at,
      orders: orders.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
    
  } catch (error) {
    console.error('Error getting user orders:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function verifyToken(token, secret) {
  try {
    const [headerBase64, payloadBase64, signatureBase64] = token.split('.');
    
    if (!headerBase64 || !payloadBase64 || !signatureBase64) {
      return false;
    }
    
    const payload = JSON.parse(atob(payloadBase64));
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }
    
    // Verify signature
    const encoder = new TextEncoder();
    const data = `${headerBase64}.${payloadBase64}`;
    
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret || 'default-secret-change-in-production'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signature = Uint8Array.from(
      atob(signatureBase64.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );
    
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(data)
    );
    
    return isValid;
  } catch (error) {
    console.error('Error verifying token:', error);
    return false;
  }
}
