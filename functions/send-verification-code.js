// Send verification code to user email
// Stores code in Supabase database with expiration

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  
  try {
    const body = await request.json();
    const { email } = body;
    
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code in database (expires in 15 minutes)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    
    // Delete old codes for this email
    await fetch(`${env.SUPABASE_URL}/rest/v1/verification_codes?email=eq.${email}`, {
      method: 'DELETE',
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`
      }
    });
    
    // Insert new code
    await fetch(`${env.SUPABASE_URL}/rest/v1/verification_codes`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        email,
        code,
        expires_at: expiresAt
      })
    });
    
    // Send email with code
    const emailSent = await sendVerificationEmail(env, email, code);
    
    if (!emailSent) {
      console.error(`Failed to send email to ${email}`);
      return new Response(JSON.stringify({ 
        error: 'Failed to send verification email. Please try again.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Verification code sent to your email'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
    
  } catch (error) {
    console.error('Error sending verification code:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  }
};

async function sendVerificationEmail(env, email, code) {
  try {
    const emailData = {
      from: 'PlugMarket <noreply@plugmarket.es>',
      to: [email],
      subject: 'Plug Market - Your login code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #0f1117; }
            .container { max-width: 600px; margin: 40px auto; background: #1a1d2e; border-radius: 16px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #d946ef, #9333ea); padding: 40px; text-align: center; }
            .logo { width: 60px; height: 60px; background: rgba(255, 255, 255, 0.2); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { padding: 40px; color: #e5e7eb; }
            .code-box { background: rgba(217, 70, 239, 0.1); border: 2px solid #d946ef; border-radius: 12px; padding: 24px; text-align: center; margin: 32px 0; }
            .code { font-size: 48px; font-weight: 900; letter-spacing: 8px; color: #d946ef; font-family: 'Courier New', monospace; }
            .expires { color: #9ca3af; font-size: 14px; margin-top: 16px; }
            .footer { padding: 24px; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid rgba(255, 255, 255, 0.1); }
            .warning { background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; color: #fca5a5; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🔐</div>
              <h1>Your login code</h1>
            </div>
            <div class="content">
              <p>You requested a login code for your <strong>Plug Market</strong> account.</p>
              <p>Enter the following code to access your dashboard:</p>
              <div class="code-box">
                <div class="code">${code}</div>
                <div class="expires">This code expires in <strong>15 minutes</strong>.</div>
              </div>
              <div class="warning">
                ⚠️ If you did not request this code, you can safely ignore this email.
              </div>
              <p style="margin-top: 32px;">Best regards,<br><strong>Plug Market</strong></p>
            </div>
            <div class="footer">
              <p>© 2025 Plug Market. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resend API error:', response.status, errorText);
      return false;
    }
    
    const result = await response.json();
    console.log('✅ Email sent successfully via Resend:', result.id);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}
