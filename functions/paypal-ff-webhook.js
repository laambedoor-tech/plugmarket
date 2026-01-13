/**
 * POST /api/paypal-ff/webhook
 * Receives PayPal IPN notifications for Friends & Family payments
 * Verifies the payment and updates order status
 */

import { createClient } from '@supabase/supabase-js';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }});
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      // Parse IPN data (comes as form-urlencoded)
      const contentType = request.headers.get('content-type') || '';
      let ipnData;

      if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.text();
        ipnData = Object.fromEntries(new URLSearchParams(formData));
      } else {
        ipnData = await request.json();
      }

      console.log('Received IPN:', ipnData);

      // Verify with PayPal (IMPORTANT: This validates the IPN is genuine)
      const verificationResponse = await verifyIPN(ipnData, env);
      
      if (!verificationResponse.verified) {
        console.error('IPN verification failed');
        return new Response('INVALID', { status: 400 });
      }

      // Extract payment info
      const {
        payment_status,
        receiver_email,
        mc_gross,
        mc_currency,
        txn_id,
        payer_email,
        custom,
        item_name,
        memo
      } = ipnData;

      // Try to find order ID from custom field, memo, or item_name
      let orderId = custom || memo || item_name || '';
      
      // Extract order ID if it matches our format (FF-xxxxx-xxxxx)
      const orderIdMatch = orderId.match(/FF-[A-Z0-9]+-[A-Z0-9]+/i);
      if (orderIdMatch) {
        orderId = orderIdMatch[0].toUpperCase();
      }

      if (!orderId) {
        console.error('No order ID found in IPN');
        return new Response('OK', { status: 200 }); // Still return OK to prevent retries
      }

      // Check if payment is completed
      if (payment_status !== 'Completed') {
        console.log(`Payment status is ${payment_status}, not Completed`);
        return new Response('OK', { status: 200 });
      }

      // Create Supabase client
      const supabase = createClient(
        env.SUPABASE_URL,
        env.SUPABASE_ANON_KEY
      );

      // Find the order
      const { data: order, error: findError } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_intent_id', orderId)
        .single();

      if (findError || !order) {
        console.error('Order not found:', orderId);
        return new Response('OK', { status: 200 });
      }

      // Check if already processed (check customer_email is a real email, not order ID)
      if (order.customer_email && order.customer_email.includes('@')) {
        console.log('Order already completed:', orderId);
        return new Response('OK', { status: 200 });
      }

      // Verify amount matches
      const expectedAmount = (order.total_cents / 100).toFixed(2);
      if (parseFloat(mc_gross) < parseFloat(expectedAmount)) {
        console.error(`Amount mismatch: received ${mc_gross}, expected ${expectedAmount}`);
        
        // Update order with error (store in customer_email for now)
        await supabase
          .from('orders')
          .update({
            customer_email: `ERROR: Amount mismatch - received $${mc_gross}, expected $${expectedAmount}`
          })
          .eq('payment_intent_id', orderId);

        return new Response('OK', { status: 200 });
      }

      // Update order as completed - set customer_email to payer's email
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          customer_email: payer_email
        })
        .eq('payment_intent_id', orderId);

      if (updateError) {
        console.error('Failed to update order:', updateError);
        return new Response('ERROR', { status: 500 });
      }

      console.log(`✅ Order ${orderId} completed successfully`);

      // TODO: Send confirmation email to customer
      // TODO: Fulfill order (send digital products)

      return new Response('OK', { status: 200 });

    } catch (err) {
      console.error('Error processing IPN:', err);
      return new Response('ERROR', { status: 500 });
    }
  }
};

/**
 * Verify IPN with PayPal
 * Sends the IPN data back to PayPal to confirm it's genuine
 */
async function verifyIPN(ipnData, env) {
  try {
    // Determine PayPal verification URL
    const isProduction = env.PAYPAL_ENV === 'live' || env.PAYPAL_ENV === 'production';
    const verifyUrl = isProduction
      ? 'https://ipnpb.paypal.com/cgi-bin/webscr'
      : 'https://ipnpb.sandbox.paypal.com/cgi-bin/webscr';

    // Build verification request
    const verifyParams = new URLSearchParams(ipnData);
    verifyParams.set('cmd', '_notify-validate');

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: verifyParams.toString()
    });

    const verificationResult = await response.text();
    
    return {
      verified: verificationResult === 'VERIFIED',
      result: verificationResult
    };
  } catch (err) {
    console.error('IPN verification error:', err);
    return { verified: false, error: err.message };
  }
}
