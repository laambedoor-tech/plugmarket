// Automatic verification of PayPal F&F payments using PayPal REST API
import { createClient } from '@supabase/supabase-js';

// Get PayPal OAuth token
async function getPayPalAccessToken(env) {
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_SECRET}`);
  
  const response = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  
  const data = await response.json();
  return data.access_token;
}

// Get recent transactions from PayPal
async function getRecentTransactions(accessToken, env) {
  // Get transactions from last 10 minutes
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 10 * 60 * 1000); // 10 minutes ago
  
  const startDateStr = startDate.toISOString();
  const endDateStr = endDate.toISOString();
  
  console.log('[AUTO-VERIFY] Fetching transactions from', startDateStr, 'to', endDateStr);
  
  const response = await fetch(
    `https://api-m.paypal.com/v1/reporting/transactions?start_date=${startDateStr}&end_date=${endDateStr}&fields=all`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const data = await response.json();
  console.log('[AUTO-VERIFY] PayPal API response:', JSON.stringify(data, null, 2));
  
  return data.transaction_details || [];
}

// Process transactions and match with pending orders
async function processTransactions(transactions, env) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  let completedCount = 0;
  
  console.log('[AUTO-VERIFY] Processing', transactions.length, 'transactions');
  
  for (const transaction of transactions) {
    // Skip if not a payment received
    if (transaction.transaction_info?.transaction_status !== 'S') continue; // S = Success
    if (transaction.transaction_info?.transaction_event_code !== 'T0006') continue; // Payment received
    
    const amount = parseFloat(transaction.transaction_info?.transaction_amount?.value || '0');
    const currency = transaction.transaction_info?.transaction_amount?.currency_code || 'EUR';
    const note = transaction.transaction_info?.transaction_note || 
                 transaction.transaction_info?.transaction_subject || '';
    const txnId = transaction.transaction_info?.transaction_id || '';
    
    console.log('[AUTO-VERIFY] Transaction found:', {
      amount,
      currency,
      note,
      txnId,
      status: transaction.transaction_info?.transaction_status
    });
    
    if (!note) continue;
    
    // Try to find order by casual note
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_intent_id', note) // Casual note is stored here
      .lt('payment_intent_id', 'aaa') // Filter out already completed (txn_ids are long)
      .limit(1);
    
    if (error) {
      console.error('[AUTO-VERIFY] Database error:', error);
      continue;
    }
    
    if (!orders || orders.length === 0) {
      console.log('[AUTO-VERIFY] No pending order found for note:', note);
      continue;
    }
    
    const order = orders[0];
    const orderAmountEUR = order.total_cents / 100;
    
    console.log('[AUTO-VERIFY] Found order:', {
      orderId: order.id,
      customerEmail: order.customer_email,
      orderAmount: orderAmountEUR,
      transactionAmount: amount
    });
    
    // Verify amount matches (with 1 cent tolerance for rounding)
    const amountDiff = Math.abs(orderAmountEUR - amount);
    if (amountDiff > 0.02) {
      console.log('[AUTO-VERIFY] Amount mismatch:', {
        expected: orderAmountEUR,
        received: amount,
        difference: amountDiff
      });
      continue;
    }
    
    // Update order to mark as completed
    const { error: updateError } = await supabase
      .from('orders')
      .update({ payment_intent_id: txnId })
      .eq('id', order.id);
    
    if (updateError) {
      console.error('[AUTO-VERIFY] Failed to update order:', updateError);
      continue;
    }
    
    console.log('[AUTO-VERIFY] ✅ Order completed successfully:', {
      orderId: order.id,
      email: order.customer_email,
      casualNote: note,
      txnId: txnId
    });
    
    completedCount++;
  }
  
  return completedCount;
}

export default {
  async fetch(request, env, ctx) {
    console.log('[AUTO-VERIFY] Starting automatic verification...');
    
    try {
      // Get PayPal access token
      const accessToken = await getPayPalAccessToken(env);
      console.log('[AUTO-VERIFY] Got PayPal access token');
      
      // Get recent transactions
      const transactions = await getRecentTransactions(accessToken, env);
      
      // Process and match with orders
      const completedCount = await processTransactions(transactions, env);
      
      console.log('[AUTO-VERIFY] Verification complete. Completed orders:', completedCount);
      
      return new Response(JSON.stringify({
        success: true,
        transactionsChecked: transactions.length,
        ordersCompleted: completedCount,
        timestamp: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('[AUTO-VERIFY] Error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  },
  
  // Scheduled event handler for Cloudflare Cron
  async scheduled(event, env, ctx) {
    console.log('[AUTO-VERIFY] Cron trigger fired at', new Date().toISOString());
    
    try {
      const accessToken = await getPayPalAccessToken(env);
      const transactions = await getRecentTransactions(accessToken, env);
      const completedCount = await processTransactions(transactions, env);
      
      console.log('[AUTO-VERIFY] Cron completed.', completedCount, 'orders processed');
    } catch (error) {
      console.error('[AUTO-VERIFY] Cron error:', error);
    }
  }
};
