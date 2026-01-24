/**
 * POST /api/paypal-ff/webhook
 * Receives IPN notifications from PayPal (via Cloudflare Worker forwarder)
 * Verifies and processes Friends & Family payments
 */

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
      const note = params.get('custom') || params.get('memo') || '';

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

      // Find matching order by amount and note
      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_ANON_KEY;

      // Search for pending orders with matching amount
      const searchRes = await fetch(
        `${supabaseUrl}/rest/v1/orders?payment_method=eq.paypal_ff&status=eq.pending_payment&total=eq.${amount}`,
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
        console.log(`No matching order found for amount $${amount}`);
        return new Response('OK', { status: 200 });
      }

      // Match by note if available
      let matchedOrder = orders[0];
      if (note) {
        const noteMatch = orders.find(o => o.payment_note === note);
        if (noteMatch) matchedOrder = noteMatch;
      }

      // Update order status
      const updateRes = await fetch(
        `${supabaseUrl}/rest/v1/orders?order_id=eq.${matchedOrder.order_id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            status: 'completed',
            payment_txn_id: txnId,
            payer_email: payerEmail,
            completed_at: new Date().toISOString()
          })
        }
      );

      if (!updateRes.ok) {
        console.error('Failed to update order:', await updateRes.text());
        return new Response('OK', { status: 200 });
      }

      // TODO: Deliver products to customer
      // Call your fulfillment function here
      console.log(`Order ${matchedOrder.order_id} completed, delivering products...`);

      return new Response('OK', { status: 200 });

    } catch (err) {
      console.error('Error processing IPN:', err);
      return new Response('Error', { status: 500 });
    }
  }
};

async function verifyIPN(body, env) {
  try {
    // Verify with PayPal
    const verifyUrl = env.PAYPAL_ENV === 'production'
      ? 'https://ipnpb.paypal.com/cgi-bin/webscr'
      : 'https://ipnpb.sandbox.paypal.com/cgi-bin/webscr';

    const verifyBody = 'cmd=_notify-validate&' + body;

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: verifyBody
    });

    const text = await response.text();
    return text === 'VERIFIED';
  } catch (err) {
    console.error('IPN verification error:', err);
    return false;
  }
}
