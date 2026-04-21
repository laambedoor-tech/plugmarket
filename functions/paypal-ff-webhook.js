/**
 * POST /api/paypal-ff/webhook
 * Receives IPN notifications from PayPal (via Cloudflare Worker forwarder)
 * Verifies and processes Friends & Family payments
 * AUTOMATICALLY assigns accounts from stock when payment is confirmed
 */

// Helper function to assign account from stock
async function assignAccount(supabaseUrl, supabaseKey, productId, plan, customerEmail) {
  console.log(`Assigning account: product_id="${productId}", plan="${plan}"`);

  // Buscar cuenta disponible (FIFO: la más antigua primero)
  const fetchRes = await fetch(
    `${supabaseUrl}/rest/v1/accounts?product_id=eq.${productId}&plan=eq.${plan}&status=eq.available&order=created_at.asc,id.asc&limit=1`,
    {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!fetchRes.ok) {
    throw new Error(`Failed to fetch account: ${await fetchRes.text()}`);
  }

  const accounts = await fetchRes.json();
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error(`No available accounts for ${productId} - ${plan}`);
  }

  const account = accounts[0];

  // Marcar como vendida
  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/accounts?id=eq.${account.id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        status: 'sold',
        sold_at: new Date().toISOString(),
        customer_email: customerEmail
      })
    }
  );

  if (!updateRes.ok) {
    throw new Error(`Failed to update account: ${await updateRes.text()}`);
  }

  const result = {
    email: account.email,
    password: account.password
  };
  if (account.chatgpt_password) result.chatgptPassword = account.chatgpt_password;
  if (account.chatgpt_code) result.chatgptCode = account.chatgpt_code;
  return result;
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      // Read IPN data
      const body = await request.text();
      const params = new URLSearchParams(body);
      
      // Log IPN for debugging
      console.log('Received IPN:', Object.fromEntries(params));

      // Verify IPN with PayPal
      const verified = await verifyIPN(body, env);
      if (!verified) {
        console.error('IPN verification failed');
        return new Response('Verification failed', { status: 400 });
      }

      // Extract payment data
      const paymentStatus = params.get('payment_status');
      const receiverEmail = params.get('receiver_email');
      const amount = parseFloat(params.get('mc_gross') || '0');
      const currency = params.get('mc_currency');
      const txnId = params.get('txn_id');
      const payerEmail = params.get('payer_email');
      
      // PayPal F&F no envía el note en el IPN, solo en la transacción
      // Por eso buscamos solo por monto
      
      console.log(`Processing payment: €${amount} from ${payerEmail} to ${receiverEmail}`);

      // Only process completed payments
      if (paymentStatus !== 'Completed') {
        console.log(`Payment status is ${paymentStatus}, ignoring`);
        return new Response('OK', { status: 200 });
      }

      // Verify receiver email matches
      const expectedEmail = env.PAYPAL_MANUAL_EMAIL;
      if (receiverEmail !== expectedEmail) {
        console.error(`Wrong receiver: ${receiverEmail} vs ${expectedEmail}`);
        return new Response('OK', { status: 200 });
      }

      // Find matching order by amount
      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_ANON_KEY;

      // Search for pending orders with matching amount (using ilike for PPFF pattern)
      const searchRes = await fetch(
        `${supabaseUrl}/rest/v1/orders?payment_intent_id=ilike.PPFF-%&total_cents=eq.${Math.round(amount * 100)}&order=created_at.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }
      );

      if (!searchRes.ok) {
        console.error('Failed to search orders:', await searchRes.text());
        return new Response('OK', { status: 200 });
      }

      const orders = await searchRes.json();
      
      if (orders.length === 0) {
        console.log(`No matching order found for amount €${amount}`);
        return new Response('OK', { status: 200 });
      }

      // Tomar la orden más reciente que no esté completada
      let matchedOrder = orders.find(o => !o.payment_intent_id.includes('_completed_'));
      
      if (!matchedOrder) {
        console.log(`All orders for amount €${amount} are already completed`);
        return new Response('OK', { status: 200 });
      }
      
      console.log(`Matched order: ${matchedOrder.payment_intent_id}`);

      // Parse cart items
      let cartItems = [];
      if (matchedOrder.items) {
        cartItems = Array.isArray(matchedOrder.items) ? matchedOrder.items : JSON.parse(matchedOrder.items);
      }

      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        console.error('Order has no items');
        return new Response('OK', { status: 200 });
      }

      console.log(`Processing ${cartItems.length} cart items for order ${matchedOrder.payment_intent_id}`);

      // Assign accounts from stock for each item
      const orderItems = [];
      try {
        for (const item of cartItems) {
          const qty = item.qty || 1;
          for (let i = 0; i < qty; i++) {
            const credentials = await assignAccount(
              supabaseUrl,
              supabaseKey,
              item.pid,
              item.plan,
              matchedOrder.customer_email
            );
            orderItems.push({
              pid: item.pid,
              plan: item.plan,
              price: item.price,
              credentials
            });
            console.log(`Assigned account ${i + 1}/${qty} for ${item.pid}-${item.plan}`);
          }
        }
      } catch (assignError) {
        console.error(`Failed to assign accounts:`, assignError);
        // Even if account assignment fails, we should still mark order as needing attention
        // but continue processing
      }

      // Mark as completed and save credentials
      const completedId = `${matchedOrder.payment_intent_id}_completed_${txnId}`;
      
      const updateRes = await fetch(
        `${supabaseUrl}/rest/v1/orders?payment_intent_id=eq.${matchedOrder.payment_intent_id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            payment_intent_id: completedId,
            items: orderItems.length > 0 ? orderItems : matchedOrder.items
          })
        }
      );

      if (!updateRes.ok) {
        console.error('Failed to update order:', await updateRes.text());
        return new Response('OK', { status: 200 });
      }

      console.log(`✅ Order ${matchedOrder.payment_intent_id} completed automatically via IPN (txn: ${txnId}) - ${orderItems.length} accounts assigned`);

      return new Response('OK', { status: 200 });

    } catch (err) {
      console.error('Error processing IPN:', err);
      return new Response('Error', { status: 500 });
    }
  }
};

async function verifyIPN(body, env) {
  try {
    // Try production first, then sandbox
    const urls = [
      'https://ipnpb.paypal.com/cgi-bin/webscr',      // Production
      'https://ipnpb.sandbox.paypal.com/cgi-bin/webscr' // Sandbox
    ];
    
    // If env specifies, try that first
    if (env.PAYPAL_ENV === 'production') {
      urls.reverse(); // Try sandbox second
    }
    
    const verifyBody = 'cmd=_notify-validate&' + body;

    for (const verifyUrl of urls) {
      try {
        console.log(`Verifying IPN with: ${verifyUrl}`);
        const response = await fetch(verifyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: verifyBody
        });

        const text = await response.text();
        console.log(`IPN verification response from ${verifyUrl}: ${text}`);
        
        if (text === 'VERIFIED') {
          return true;
        }
      } catch (urlErr) {
        console.warn(`Failed to verify with ${verifyUrl}:`, urlErr.message);
      }
    }
    
    // If both fail, log but still return false
    console.error('IPN verification failed with both endpoints');
    return false;
  } catch (err) {
    console.error('IPN verification error:', err);
    return false;
  }
}
