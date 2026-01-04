// Coinbase Commerce Webhook Handler
// Verifies signature and assigns accounts on charge:confirmed

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function normalizePlan(p) {
  const lower = String(p || '').toLowerCase().trim();
  if (lower === '1 mes' || lower === '1 month') return '1 Month';
  if (lower === '3 meses' || lower === '3 months') return '3 Months';
  if (lower === '6 meses' || lower === '6 months') return '6 Months';
  if (lower === '12 meses' || lower === '12 months') return '12 Months';
  if (lower === '24 meses' || lower === '24 months') return '24 Months';
  if (lower === 'lifetime') return 'Lifetime';
  return p;
}

export default async function handleCoinbaseWebhook(request, env) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('X-CC-Webhook-Signature');
    
    // Verify webhook signature
    const webhookSecret = env.COINBASE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('COINBASE_WEBHOOK_SECRET not configured');
      return new Response('Webhook secret not configured', { status: 500 });
    }
    
    const computedSignature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    
    if (signature !== computedSignature) {
      console.error('Invalid webhook signature');
      return new Response('Invalid signature', { status: 401 });
    }
    
    const event = JSON.parse(rawBody);
    console.log('Coinbase webhook event:', event.type);
    
    // Only process charge:confirmed and charge:failed events
    if (event.type === 'charge:confirmed') {
      const charge = event.data;
      const metadata = charge.metadata || {};
      const customerEmail = metadata.customerEmail;
      const cart = metadata.cart;
      
      if (!customerEmail || !Array.isArray(cart) || cart.length === 0) {
        console.error('Missing metadata in charge:', charge.id);
        return new Response('OK', { status: 200 });
      }
      
      // Assign accounts from Supabase
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
      const assignedItems = [];
      
      for (const item of cart) {
        const { pid, plan, qty } = item;
        const norm = normalizePlan(plan);
        
        for (let i = 0; i < qty; i++) {
          // Find available account
          const { data: accounts, error: fetchError } = await supabase
            .from('accounts')
            .select('id, email, password, chatgpt_password, chatgpt_code')
            .eq('product_id', pid)
            .eq('plan', norm)
            .eq('status', 'available')
            .limit(1);
          
          if (fetchError || !accounts || accounts.length === 0) {
            console.error(`No stock for ${pid} - ${norm}`);
            break;
          }
          
          const account = accounts[0];
          
          // Mark as sold
          const { error: updateError } = await supabase
            .from('accounts')
            .update({ status: 'sold' })
            .eq('id', account.id);
          
          if (updateError) {
            console.error('Failed to mark account as sold:', updateError);
            continue;
          }
          
          const itemData = {
            product_id: pid,
            plan: norm,
            email: account.email,
            password: account.password
          };
          if (account.chatgpt_password) itemData.chatgptPassword = account.chatgpt_password;
          if (account.chatgpt_code) itemData.chatgptCode = account.chatgpt_code;
          
          assignedItems.push(itemData);
        }
      }
      
      if (assignedItems.length === 0) {
        console.error('No accounts assigned for charge:', charge.id);
        return new Response('OK', { status: 200 });
      }
      
      // Save to orders table
      const { error: insertError } = await supabase
        .from('orders')
        .insert({
          customer_email: customerEmail,
          payment_intent_id: charge.code,
          amount: parseFloat(charge.pricing?.local?.amount || 0),
          currency: charge.pricing?.local?.currency || 'USD',
          status: 'completed',
          items: assignedItems,
          created_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('Failed to save order:', insertError);
      } else {
        console.log(`Order saved for ${customerEmail}, charge: ${charge.code}`);
      }
      
      return new Response('OK', { status: 200 });
    }
    
    if (event.type === 'charge:failed') {
      console.log('Charge failed:', event.data.code);
    }
    
    return new Response('OK', { status: 200 });
    
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('Internal server error', { status: 500 });
  }
}
