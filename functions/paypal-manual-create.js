/**
 * POST /api/paypal/manual-create
 * Body: { cart, customerEmail }
 * Creates a pending PayPal manual order with unique reference code
 * Returns instructions for the customer to send payment manually
 */

import { createClient } from '@supabase/supabase-js';

function getSupabase(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

// Pricing table (keep in sync with other payment methods)
const PRICES_USD = {
  netflix: { '1 Month': 150, '3 Months': 350, '6 Months': 600, '12 Months': 1100, 'Lifetime': 1800 },
  spotify: { '1 Month': 220, '3 Months': 380, '6 Months': 620, '12 Months': 1250 },
  'youtube-premium': { '1 Month': 160, '3 Months': 320, '6 Months': 550, '12 Months': 1050 },
  disney: { '1 Month': 110, '3 Months': 270, '6 Months': 480, '12 Months': 950 },
  prime: { '1 Month': 180, '3 Months': 340, '6 Months': 580, '12 Months': 1120 },
  hbomax: { '1 Month': 140, '3 Months': 310, '6 Months': 470, '12 Months': 980 },
  nordvpn: { '1 Month': 85, '3 Months': 200, '6 Months': 360, '12 Months': 690 },
  crunchy: { '1 Month': 90, '3 Months': 210, '6 Months': 380, '12 Months': 720 },
  nitro: { 'Boost 1m': 550, 'Boost 1 Year': 1597, 'Basic 1m': 135 },
  discordpromocode: { '1 Month': 60, '3 Months': 105 },
  realmembers: { '[500]': 225, '[1000]': 425, '[2000]': 788, '[3000]': 1163, '[4000]': 1224, '[5000]': 1561 },
  chatgpt: { '1 Month': 320, '3 Months': 780, '6 Months': 1250, '12 Months': 2400 },
  'chatgpt-pro': { '1 Month': 350, '3 Months': 600 },
  capcut: { '1 Month': 120, '3 Months': 250, '6 Months': 420, '12 Months': 800 },
  geoguessr: { '1 Month': 200, '3 Months': 500, '12 Months': 1000 },
  filmora: { '1 Month': 250, '3 Months': 600, '6 Months': 1050, '12 Months': 1600 },
  duolingo: { '12 Months': 124 },
  movistar: { '12 Months': 244 },
  dazn: { 'Lifetime': 150 },
  steamaccount: { 'Random Games': 25 },
  microsoft: { 'Random Codes': 40 },
  rockstar: { 'Activation Code': 25 },
  minecraft: { 'NFA Lifetime': 100, 'FA Lifetime': 500 },
  stake: { 'Level 2 Verified': 60 },
  xbox: { 'Game Pass Lifetime': 60 }
};

const PLAN_ALIASES = {
  '1 mes':'1 Month','1 month':'1 Month','1m':'1 Month',
  '3 meses':'3 Months','3 month':'3 Months','3m':'3 Months',
  '6 meses':'6 Months','6 month':'6 Months','6m':'6 Months',
  '12 meses':'12 Months','12 month':'12 Months','12m':'12 Months',
  'lifetime':'Lifetime','de por vida':'Lifetime'
};

function normalizePlan(raw){
  if(!raw) return raw;
  const key = raw.trim().toLowerCase();
  return PLAN_ALIASES[key] || raw.trim();
}

function validateAndPriceCart(cart){
  let totalCents = 0;
  const validatedItems = [];
  
  for (const item of cart){
    if (!item.pid || !item.plan) throw new Error('Missing pid or plan');
    const priceTable = PRICES_USD[item.pid];
    if (!priceTable) throw new Error(`Unknown product: ${item.pid}`);
    const originalPlan = item.plan;
    const plan = normalizePlan(originalPlan);
    const unit = priceTable[plan];
    if (unit === undefined) throw new Error(`Unknown plan "${originalPlan}" for ${item.pid}`);
    const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
    totalCents += unit * qty;
    validatedItems.push({ pid: item.pid, plan, qty, unitPrice: unit });
  }
  
  return { totalCents, validatedItems };
}

// Generate simple human-friendly note phrase to include in PayPal payment
function generateNotePhrase(){
  const phrases = [
    'picnic and ice cream',
    'snacks and uber',
    'tattoo and dog walking',
    'coffee and cookies',
    'cinema and popcorn',
    'music and headphones',
    'books and tea',
    'beach and sunscreen',
    'pizza and soda',
    'gym and protein',
    'taxi and dinner',
    'flowers and chocolate',
    'burger and fries',
    'park and bench',
    'photos and camera'
  ];
  const pick = () => phrases[Math.floor(Math.random() * phrases.length)];
  return pick();
}

export default {
  async fetch(request, env){
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/paypal/manual-create')) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      const { cart, customerEmail } = await request.json();
      
      if (!Array.isArray(cart) || !cart.length) {
        return new Response(JSON.stringify({ error: 'Empty cart' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      
      if (!customerEmail || !customerEmail.includes('@')) {
        return new Response(JSON.stringify({ error: 'Valid email required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const { totalCents, validatedItems } = validateAndPriceCart(cart);
      const amountUSD = (totalCents / 100).toFixed(2);
      let paymentReference = generateNotePhrase();
      
      // Get PayPal email from environment
      const paypalEmail = env.PAYPAL_MANUAL_EMAIL;
      if (!paypalEmail) {
        return new Response(JSON.stringify({ error: 'PayPal manual payments not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // Save pending order to database
      const supabase = getSupabase(env);
      // Avoid duplicate phrases: try a few times if phrase already exists
      for (let attempts = 0; attempts < 5; attempts++) {
        const { data: existing, error: checkError } = await supabase
          .from('orders')
          .select('id')
          .eq('payment_method', 'paypal_manual')
          .eq('status', 'pending_payment')
          .eq('reference', paymentReference)
          .limit(1);
        if (checkError) break;
        if (existing && existing.length) {
          paymentReference = generateNotePhrase();
        } else {
          break;
        }
      }
      
      const orderData = {
        reference: paymentReference,
        customer_email: customerEmail,
        payment_method: 'paypal_manual',
        status: 'pending_payment',
        amount: parseFloat(amountUSD),
        currency: 'USD',
        items: validatedItems,
        created_at: new Date().toISOString(),
        metadata: {
          paypal_email: paypalEmail,
          instructions_sent: true
        }
      };

      const { data: insertedOrder, error: insertError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (insertError) {
        console.error('[PayPal Manual] Failed to create order:', insertError);
        throw new Error(`Database error: ${insertError.message}`);
      }

      console.log(`[PayPal Manual] Created pending order ${paymentReference} for ${customerEmail}`);

      // Return instructions to the customer
      return new Response(JSON.stringify({
        success: true,
        reference: paymentReference,
        paypalEmail: paypalEmail,
        amount: amountUSD,
        currency: 'USD',
        instructions: {
          es: {
            step1: 'Abre tu aplicación de PayPal',
            step2: `Envía $${amountUSD} USD a: ${paypalEmail}`,
            step3: 'IMPORTANTE: Selecciona "Amigos y familiares" (no mercancías)',
            step4: `En la nota/descripción, escribe EXACTAMENTE: ${paymentReference}`,
            step5: 'Una vez enviado, tu pedido se confirmará automáticamente'
          },
          en: {
            step1: 'Open your PayPal app',
            step2: `Send $${amountUSD} USD to: ${paypalEmail}`,
            step3: 'IMPORTANT: Select "Friends and Family" (not goods)',
            step4: `In the note/description, write EXACTLY: ${paymentReference}`,
            step5: 'Once sent, your order will auto-confirm'
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });

    } catch (error) {
      console.error('[PayPal Manual] Error:', error);
      return new Response(JSON.stringify({
        error: error.message || 'Failed to create payment request'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
