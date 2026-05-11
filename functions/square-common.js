import { createClient } from '@supabase/supabase-js';

export const PRICES_EUR = {
  boosts: { '3 Months': 665 },
  netflix: { '1 Month': 122, '3 Months': 284, '6 Months': 486, '12 Months': 891, 'Bulk': 49, 'Lifetime': 110, 'FA': 780 },
  spotify: { '1 Month': 178, '3 Months': 308, '6 Months': 502, '12 Months': 962, 'Lifetime': 270 },
  'youtube-premium': { '1 Month': 227, '6 Months': 680, '12 Months': 1013, 'Lifetime': 227, 'fowner': 474 },
  disney: { '1 Month': 89, '3 Months': 219, '6 Months': 389, '12 Months': 770, 'Lifetime': 89 },
  prime: { '1 Month': 65, '3 Months': 178, '12 Months': 599, 'Lifetime': 65 },
  hbomax: { 'Lifetime': 86 },
  nordvpn: { '1 Month': 146, '3 Months': 275, '6 Months': 470, '12 Months': 862, 'Lifetime': 146 },
  crunchy: { '1 Month': 105, '3 Months': 267, '6 Months': 470, '12 Months': 842, 'Lifetime': 105 },
  nitro: { 'Boost 1m': 400, 'Boost 1 Year': 1229, 'Basic 1m': 110 },
  discordpromocode: { '1 Month Nitro': 89, '3 Months Nitro': 99, 'Boost 1m': 89, 'Boost 3m': 99 },
  realmembers: { '[500]': 203, '[1000]': 383, '[2000]': 709, '[3000]': 1047, '[4000]': 1102, '[5000]': 1405 },
  'chatgpt-plus': { '1 Month': 259, '3 Months': 632, '6 Months': 962, '12 Months': 850 },
  'chatgpt-pro': { '1 Month': 315 },
  capcut: { '1 Month': 235, '3 Months': 599, '6 Months': 1069, '12 Months': 1879, 'Lifetime': 235 },
  geoguessr: { '1 Month': 81, '3 Months': 211, '6 Months': 389, '12 Months': 713, 'Lifetime': 81 },
  filmora: { '1 Month': 729, '3 Months': 2187, '6 Months': 4374, '12 Months': 8748, 'Lifetime': 729 },
  duolingo: { '1 Month': 162, '3 Months': 389, '6 Months': 648, '12 Months': 1118, 'Lifetime': 162 },
  movistar: { '1 Month': 292, '3 Months': 729, '6 Months': 1345, '12 Months': 2511, 'Lifetime': 292 },
  dazn: { '1 Month': 259, '3 Months': 664, '6 Months': 1215, '12 Months': 2268, 'Lifetime': 135 },
  steamaccount: { 'Random Games': 65 },
  microsoft: { 'Random Codes': 90 },
  rockstar: { 'Activation Code': 25 },
  minecraft: { 'NFA Lifetime': 100, 'FA Lifetime': 450 },
  stake: { 'Level 2 Verified': 60 },
  xbox: { 'Game Pass Lifetime': 60 }
};

export const PLAN_ALIASES = {
  '1 mes': '1 Month', '1 month': '1 Month', '1m': '1 Month',
  '3 meses': '3 Months', '3 month': '3 Months', '3m': '3 Months',
  '6 meses': '6 Months', '6 month': '6 Months', '6m': '6 Months',
  '12 meses': '12 Months', '12 month': '12 Months', '12m': '12 Months',
  'lifetime': 'Lifetime', 'de por vida': 'Lifetime'
};

export function normalizePlan(raw) {
  if (!raw) return raw;
  const key = raw.trim();
  return PLAN_ALIASES[key.toLowerCase()] || key;
}

export function validateAndPriceCart(cart) {
  let totalCents = 0;
  const normalizedCart = [];

  for (const item of cart) {
    if (!item.pid || !item.plan) {
      throw new Error('Missing pid or plan in cart item');
    }

    const prices = PRICES_EUR[item.pid];
    if (!prices) {
      throw new Error(`Unknown product: ${item.pid}`);
    }

    const originalPlan = item.plan;
    const plan = normalizePlan(originalPlan);
    const unitPrice = prices[plan];
    if (unitPrice === undefined) {
      throw new Error(`Unknown plan "${originalPlan}" (normalized="${plan}") for ${item.pid}`);
    }

    const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
    totalCents += unitPrice * qty;

    normalizedCart.push({
      pid: item.pid,
      plan,
      unitAmount: unitPrice,
      qty
    });
  }

  return { totalCents, normalizedCart };
}

export function getSupabase(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

export async function assignAccount(env, productId, plan, customerEmail) {
  const supabase = getSupabase(env);
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('product_id', productId)
    .eq('plan', plan)
    .eq('status', 'available')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) throw new Error(`DB fetch error: ${error.message}`);
  if (!accounts || accounts.length === 0) {
    throw new Error(`No available accounts for ${productId} - ${plan}`);
  }

  const account = accounts[0];
  const { error: updateError } = await supabase
    .from('accounts')
    .update({ status: 'sold', sold_at: new Date().toISOString(), customer_email: customerEmail })
    .eq('id', account.id);

  if (updateError) throw new Error(`DB update error: ${updateError.message}`);

  const result = { email: account.email, password: account.password };
  if (account.chatgpt_password) result.chatgptPassword = account.chatgpt_password;
  if (account.chatgpt_code) result.chatgptCode = account.chatgpt_code;
  return result;
}

export async function saveOrder(env, customerEmail, paymentReference, totalCents, items) {
  const supabase = getSupabase(env);
  const { error } = await supabase.from('orders').insert({
    customer_email: customerEmail,
    payment_intent_id: paymentReference,
    total_cents: totalCents,
    items
  });
  if (error) {
    throw new Error(`Failed to save order: ${error.message}`);
  }
}

export async function saveTopupTransaction(env, userEmail, amount, paymentReference) {
  const supabase = getSupabase(env);
  const { error } = await supabase.from('balance_transactions').insert({
    user_email: userEmail,
    type: 'topup',
    amount,
    description: 'Balance top-up via Square',
    payment_method: 'square',
    payment_intent_id: paymentReference
  });
  if (error) {
    throw new Error(`Failed to save top-up transaction: ${error.message}`);
  }
}
