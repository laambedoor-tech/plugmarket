// Cart page rendering and interactions
const CART_KEY = 'plugmarket_cart';
const API_BASE = 'https://plugmarket.es';
const USD_TO_EUR_RATE_CART = 0.92; // Exchange rate USD to EUR

// Square payment state
let squarePayments = null;
let squareCard = null;
const SQUARE_SDK_URL = 'https://web.squarecdn.com/v1/square.js';

async function ensureSquareSdkLoaded(timeout = 8000) {
  if (window.Square) return;
  const script = document.querySelector(`script[src="${SQUARE_SDK_URL}"]`);
  if (!script) {
    throw new Error('Square payments SDK is not included on this page.');
  }

  await new Promise((resolve, reject) => {
    if (window.Square) return resolve();
    const onLoad = () => resolve();
    const onError = () => reject(new Error('Square payments SDK failed to load.'));
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    setTimeout(() => reject(new Error('Square payments SDK load timed out.')), timeout);
  });

  if (!window.Square) {
    throw new Error('Square payments SDK did not initialize after loading.');
  }
}

async function fetchJSON(url, opts = {}){
  const headers = Object.assign({}, opts.headers || {});
  const method = opts.method ? opts.method.toUpperCase() : 'GET';
  if (method !== 'GET' && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, Object.assign({}, opts, { headers }));
  if (!res.ok) {
    let msg = 'Request failed';
    try { const j = await res.json(); msg = j.error || JSON.stringify(j); } catch {}
    throw new Error(msg);
  }
  return res.json();
}

function showCheckout(show){
  const panel = document.getElementById('checkout-panel');
  panel.style.display = show ? 'block' : 'none';
}

async function initSquare(){
  if (squarePayments) return squarePayments;
  await ensureSquareSdkLoaded();
  const cfg = await fetchJSON(`${API_BASE}/api/get-square-config`);
  squarePayments = window.Square.payments(cfg.applicationId, cfg.locationId);
  return squarePayments;
}

async function mountSquareCard(){
  await initSquare();
  if (squareCard) return squareCard;
  squareCard = await squarePayments.card();
  await squareCard.attach('#payment-element');
  return squareCard;
}

async function tokenizeSquareCard(){
  if (!squareCard) {
    await mountSquareCard();
  }
  const result = await squareCard.tokenize();
  if (result.status !== 'OK') {
    const message = result.errors?.[0]?.detail || result.errors?.[0]?.message || 'Card tokenization failed';
    throw new Error(message);
  }
  return result.token;
}

async function processSquarePayment(sourceId, customerEmail){
  const items = getCart();
  return await fetchJSON(`${API_BASE}/api/create-square-payment`, {
    method: 'POST',
    body: JSON.stringify({
      cart: items.map(i => ({ pid: i.pid, plan: i.plan, qty: i.qty })),
      sourceId,
      customerEmail: customerEmail || ''
    })
  });
}

function setMessage(msg){
  const el = document.getElementById('payment-message');
  if (!el) return;
  if (!msg){ el.style.display = 'none'; el.textContent = ''; return; }
  el.textContent = msg;
  el.style.display = 'block';
}

// local toneToGradient copy to avoid module scope issues
function toneToGradient(tone){
  switch (tone) {
    case 'red': return 'linear-gradient(135deg, rgba(255,39,67,.55), rgba(255,95,109,.18))';
    case 'green': return 'linear-gradient(135deg, rgba(46,213,115,.45), rgba(46,213,115,.12))';
    case 'orange': return 'linear-gradient(135deg, rgba(255,171,64,.48), rgba(255,171,64,.12))';
    case 'blue': return 'linear-gradient(135deg, rgba(98,160,255,.48), rgba(98,160,255,.12))';
    case 'purple': return 'linear-gradient(135deg, rgba(171,71,188,.48), rgba(171,71,188,.12))';
    case 'cyan': return 'linear-gradient(135deg, rgba(38,198,218,.48), rgba(38,198,218,.12))';
    case 'teal': return 'linear-gradient(135deg, rgba(0,150,136,.48), rgba(0,150,136,.12))';
    case 'pink': return 'linear-gradient(135deg, rgba(236,64,122,.5), rgba(236,64,122,.14))';
    default: return 'linear-gradient(135deg, rgba(255,39,67,.45), rgba(255,95,109,.12))';
  }
}
function getCart(){ try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } }
function setCart(items){ localStorage.setItem(CART_KEY, JSON.stringify(items)); render(); updateCount(); }
function updateCount(){ const el = document.getElementById('cart-count'); if (el) el.textContent = String(getCart().reduce((a,b)=>a+b.qty,0)); }

function money(n){ return '€' + n.toFixed(2); }

// Calcular descuento por volumen
function getVolumeDiscount(totalQty) {
  if (totalQty >= 100) return 0.12; // 12% de descuento con 100+ items
  if (totalQty >= 50) return 0.08;  // 8% de descuento con 50+ items
  if (totalQty >= 25) return 0.05;  // 5% de descuento con 25+ items
  if (totalQty >= 10) return 0.03;  // 3% de descuento con 10+ items
  return 0;
}

function getDiscountBanner(totalQty) {
  if (totalQty >= 100) {
    return '<div style="background: linear-gradient(135deg, rgba(46,213,115,.15), rgba(46,213,115,.05)); border: 1px solid rgba(46,213,115,.3); border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;"><span style="font-size: 20px;">🎉</span><div><div style="font-weight: 600; color: #2ed573; margin-bottom: 2px;">12% Discount Applied!</div><div class="muted" style="font-size: 13px;">You have ' + totalQty + ' items in your cart</div></div></div>';
  }
  if (totalQty >= 50) {
    const itemsNeeded = 100 - totalQty;
    return '<div style="background: linear-gradient(135deg, rgba(46,213,115,.15), rgba(46,213,115,.05)); border: 1px solid rgba(46,213,115,.3); border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;"><span style="font-size: 20px;">✨</span><div><div style="font-weight: 600; color: #2ed573; margin-bottom: 2px;">8% Discount Applied!</div><div class="muted" style="font-size: 13px;">Add ' + itemsNeeded + ' more items to unlock 12% off (at 100 pcs.)</div></div></div>';
  }
  if (totalQty >= 25) {
    const itemsNeeded = 50 - totalQty;
    return '<div style="background: linear-gradient(135deg, rgba(46,213,115,.15), rgba(46,213,115,.05)); border: 1px solid rgba(46,213,115,.3); border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;"><span style="font-size: 20px;">✨</span><div><div style="font-weight: 600; color: #2ed573; margin-bottom: 2px;">5% Discount Applied!</div><div class="muted" style="font-size: 13px;">Add ' + itemsNeeded + ' more items to unlock 8% off (at 50 pcs.)</div></div></div>';
  }
  if (totalQty >= 10) {
    const itemsNeeded = 25 - totalQty;
    return '<div style="background: linear-gradient(135deg, rgba(46,213,115,.15), rgba(46,213,115,.05)); border: 1px solid rgba(46,213,115,.3); border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;"><span style="font-size: 20px;">✨</span><div><div style="font-weight: 600; color: #2ed573; margin-bottom: 2px;">3% Discount Applied!</div><div class="muted" style="font-size: 13px;">Add ' + itemsNeeded + ' more items to unlock 5% off (at 25 pcs.)</div></div></div>';
  }
  const itemsNeeded = 10 - totalQty;
  return '<div style="background: linear-gradient(135deg, rgba(98,160,255,.12), rgba(98,160,255,.04)); border: 1px solid rgba(98,160,255,.25); border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;"><span style="font-size: 20px;">💎</span><div><div style="font-weight: 600; color: #62a0ff; margin-bottom: 2px;">Volume Discount Available</div><div class="muted" style="font-size: 13px;">Add ' + itemsNeeded + ' more items to unlock 3% off (at 10 pcs.)</div></div></div>';
}

function render(){
  const items = getCart();
  const list = document.getElementById('cart-items');
  const empty = document.getElementById('cart-empty');
  const subtotalEl = document.getElementById('cart-subtotal');
  if (!list || !empty) return;

  if (!items.length){
    empty.style.display = 'block';
    list.innerHTML = '';
    subtotalEl.textContent = money(0);
    return;
  }
  empty.style.display = 'none';

  const totalQty = items.reduce((sum, it) => sum + it.qty, 0);
  const discount = getVolumeDiscount(totalQty);
  const banner = getDiscountBanner(totalQty);

  const itemsHTML = items.map((it, idx) => {
    // Mapeo de IDs a nombres de archivos de imágenes redimensionadas
    const imageMap = {
      'netflix': 'resized/nflx84px.png',
      'spotify': 'resized/spotify84.png',
      'youtube-premium': 'resized/youtube84.png',
      'disney': 'resized/disneyplus84.png',
      'prime': 'resized/prime84.png',
      'hbomax': 'resized/hbomax84.png',
      'nordvpn': 'resized/nordvpn84.png',
      'crunchy': 'resized/crunchyroll84.png',
      'nitro': 'resized/nitroboost84.png',
      'discordpromocode': 'resized/discordpromo84.png',
      'chatgpt-plus': 'resized/chatgptplus84.png',
      'chatgpt-pro': 'resized/chatgptpro84.png',
      'capcut': 'resized/capcutpro84.png',
      'geoguessr': 'resized/geoguessr84.png',
      'filmora': 'resized/filmora84.png',
      'duolingo': 'resized/duolingo84.png',
      'movistar': 'resized/movistar+84.png',
      'dazn': 'resized/dazn84.png',
      'roblox': 'roblox.png'
    };
    const logoFile = imageMap[it.pid] || `${it.pid}.png`;
    return `
    <div class="variant" style="border-radius:0; border-left:0; border-right:0;">
      <div class="variant__thumb" style="background:${toneToGradient(it.tone)}">
        <img src="./assets/products/${logoFile}" alt="${it.title} logo" loading="lazy" decoding="async" onerror="this.style.display='none'" />
      </div>
      <div>
        <h4 class="variant__title">${it.title} — ${it.plan}</h4>
        <div class="variant__meta">Unit price: ${money(it.price)}</div>
      </div>
      <div class="variant__actions">
        <div class="variant__price" style="min-width:70px; text-align:right;">${money(it.price * it.qty)}</div>
        <div style="display:flex; gap:6px; align-items:center;">
          <button class="btn btn--ghost btn--sm js-dec" data-i="${idx}">-</button>
          <span style="min-width:24px; text-align:center;">${it.qty}</span>
          <button class="btn btn--ghost btn--sm js-inc" data-i="${idx}">+</button>
        </div>
        <button class="btn btn--ghost btn--sm js-remove" data-i="${idx}">Remove</button>
      </div>
    </div>
  `;
  }).join('');

  list.innerHTML = banner + itemsHTML;

  const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  const finalTotal = subtotal * (1 - discount);
  
  if (discount > 0) {
    subtotalEl.innerHTML = `<div style="text-decoration: line-through; color: var(--text-500); font-size: 14px; font-weight: 500;">${money(subtotal)}</div><div>${money(finalTotal)} <span style="color: #2ed573; font-size: 13px; font-weight: 600; margin-left: 4px;">(-${(discount * 100).toFixed(0)}%)</span></div>`;
  } else {
    subtotalEl.textContent = money(subtotal);
  }
}

// Event handlers
addEventListener('click', (e) => {
  const inc = e.target.closest('.js-inc');
  const dec = e.target.closest('.js-dec');
  const rem = e.target.closest('.js-remove');
  const copy = e.target.closest('#btn-copy-address');
  if (inc){ 
    const i = +inc.dataset.i; 
    const items = getCart(); 
    items[i].qty++; 
    setCart(items); 
  }
  if (dec){ 
    const i = +dec.dataset.i; 
    const items = getCart(); 
    // Netflix Bulk has a minimum quantity of 50
    const minQty = (items[i].pid === 'netflix' && items[i].plan === 'Bulk') ? 50 : 1;
    console.log(`Decreasing item: ${items[i].pid}:${items[i].plan}, current qty: ${items[i].qty}, minQty: ${minQty}`);
    if (items[i].qty > minQty) {
      items[i].qty--;
      setCart(items); 
    } else {
      console.log(`Cannot decrease below ${minQty}`);
    }
  }
  if (rem){ const i = +rem.dataset.i; const items = getCart(); items.splice(i,1); setCart(items); }
  if (copy){
    try {
      const addrEl = document.getElementById('crypto-address');
      const addr = addrEl ? addrEl.value : '';
      if (!addr) { setCryptoMessage('No address yet'); return; }
      navigator.clipboard.writeText(addr).then(() => {
        setCryptoMessage('Address copied to clipboard');
        setTimeout(() => setCryptoMessage(''), 1500);
      }).catch(() => setCryptoMessage('Failed to copy'));
    } catch {}
  }
});

// Clear and checkout
function initCheckout() {
  document.getElementById('btn-clear')?.addEventListener('click', () => { setCart([]); });
  
  // Auto-mount Square card field when valid email is entered
  document.getElementById('checkout-email')?.addEventListener('blur', async (e) => {
    const email = e.target.value.trim();
    if (email && email.includes('@') && !squareCard) {
      try {
        await mountSquareCard();
      } catch (err) {
        console.warn('Failed to pre-mount Square card element:', err);
      }
    }
  });
  
  document.getElementById('btn-checkout')?.addEventListener('click', async () => {
    const items = getCart();
    if (!items.length) return;
    try {
      showCheckout(true);
      const tabCard = document.getElementById('tab-card');
      if (tabCard) {
        tabCard.click();
      } else {
        document.getElementById('tab-paypal')?.click();
      }
      document.getElementById('checkout-email')?.focus();
    } catch (e) {
      setMessage(e.message || 'Checkout unavailable');
    }
  });
  // Method tab switching
  document.getElementById('tab-card')?.addEventListener('click', () => {
    document.getElementById('payment-form').style.display = 'block';
    const crypto = document.getElementById('crypto-container'); if (crypto) crypto.style.display = 'none';
    const paypal = document.getElementById('paypal-container'); if (paypal) paypal.style.display = 'none';
    const balance = document.getElementById('balance-container'); if (balance) balance.style.display = 'none';
    document.getElementById('tab-card').classList.add('btn--primary');
    document.getElementById('tab-paypal')?.classList.remove('btn--primary');
    document.getElementById('tab-crypto')?.classList.remove('btn--primary');
    document.getElementById('tab-balance')?.classList.remove('btn--primary');
  });

  document.getElementById('tab-paypal')?.addEventListener('click', () => {
    document.getElementById('payment-form').style.display = 'none';
    const crypto = document.getElementById('crypto-container'); if (crypto) crypto.style.display = 'none';
    const paypal = document.getElementById('paypal-container'); if (paypal) paypal.style.display = 'block';
    const balance = document.getElementById('balance-container'); if (balance) balance.style.display = 'none';
    document.getElementById('tab-paypal')?.classList.add('btn--primary');
    document.getElementById('tab-card')?.classList.remove('btn--primary');
    document.getElementById('tab-crypto')?.classList.remove('btn--primary');
    document.getElementById('tab-balance')?.classList.remove('btn--primary');
  });


  document.getElementById('tab-crypto')?.addEventListener('click', async () => {
    document.getElementById('payment-form').style.display = 'none';
    const crypto = document.getElementById('crypto-container'); if (crypto) crypto.style.display = 'block';
    const paypal = document.getElementById('paypal-container'); if (paypal) paypal.style.display = 'none';
    const balance = document.getElementById('balance-container'); if (balance) balance.style.display = 'none';
    document.getElementById('tab-crypto')?.classList.add('btn--primary');
    document.getElementById('tab-card')?.classList.remove('btn--primary');
    document.getElementById('tab-paypal')?.classList.remove('btn--primary');
    document.getElementById('tab-balance')?.classList.remove('btn--primary');
    try {
      const sel = document.getElementById('crypto-currency');
      const val = sel ? sel.value : 'usdcpoly';
      updateCryptoLogos(val);
    } catch {}
  });
  document.getElementById('tab-balance')?.addEventListener('click', async () => {
    document.getElementById('payment-form').style.display = 'none';
    const crypto = document.getElementById('crypto-container'); if (crypto) crypto.style.display = 'none';
    const paypal = document.getElementById('paypal-container'); if (paypal) paypal.style.display = 'none';
    const balance = document.getElementById('balance-container'); if (balance) balance.style.display = 'block';
    document.getElementById('tab-balance')?.classList.add('btn--primary');
    document.getElementById('tab-card')?.classList.remove('btn--primary');
    document.getElementById('tab-paypal')?.classList.remove('btn--primary');
    document.getElementById('tab-crypto')?.classList.remove('btn--primary');
    try { await loadBalanceInfo(); } catch (e){ console.error('Failed to load balance:', e); }
  });
  

  
  document.getElementById('btn-create-crypto')?.addEventListener('click', async () => {
    try { await startCryptoCheckout(); } catch (e){ setCryptoMessage(e.message || 'Unable to start crypto checkout'); }
  });
  document.getElementById('btn-cancel-crypto')?.addEventListener('click', () => {
    showCheckout(false);
    setCryptoMessage('');
    setCryptoStatus('waiting');
    const panel = document.getElementById('crypto-panel'); if (panel) panel.style.display = 'none';
    document.getElementById('btn-create-crypto').style.display = 'inline-block';
    document.getElementById('btn-cancel-crypto').style.display = 'none';
    try { if (cryptoPoll) clearInterval(cryptoPoll); } catch {}
  });

  // PayPal F&F buttons
  document.getElementById('btn-create-paypal')?.addEventListener('click', async () => {
    try { await startPayPalCheckout(); } catch (e){ setPayPalMessage(e.message || 'Unable to start PayPal checkout'); }
  });
  document.getElementById('btn-cancel-paypal')?.addEventListener('click', () => {
    showCheckout(false);
    setPayPalMessage('');
    resetPayPalStatus();
    const panel = document.getElementById('paypal-panel'); if (panel) panel.style.display = 'none';
    document.getElementById('btn-create-paypal').style.display = 'inline-block';
    document.getElementById('btn-cancel-paypal').style.display = 'none';
    try { if (paypalPoll) clearInterval(paypalPoll); } catch {}
  });
  document.getElementById('btn-cancel-checkout')?.addEventListener('click', async () => {
    showCheckout(false);
    setMessage('');
    try {
      if (squareCard) {
        if (typeof squareCard.destroy === 'function') {
          await squareCard.destroy();
        } else if (typeof squareCard.detach === 'function') {
          await squareCard.detach();
        }
      }
    } catch (err) {
      console.warn('Unable to remove Square card element:', err);
    }
    squareCard = null;
    squarePayments = null;
  });
  
  // Balance payment buttons
  document.getElementById('btn-pay-balance')?.addEventListener('click', async () => {
    await processBalancePayment();
  });
  document.getElementById('btn-cancel-balance')?.addEventListener('click', () => {
    showCheckout(false);
  });
  
  // Check if user is logged in and show balance tab
  checkBalanceAvailability();

  // Update crypto logos on currency change
  const currencySel = document.getElementById('crypto-currency');
  currencySel?.addEventListener('change', () => {
    updateCryptoLogos(currencySel.value);
  });

  document.getElementById('payment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailEl = document.getElementById('checkout-email');
    const customerEmail = emailEl ? emailEl.value.trim() : '';
    if (!customerEmail) {
      setMessage('Please enter your email');
      return;
    }

    setMessage('');
    const btn = document.getElementById('btn-pay');
    btn && (btn.disabled = true);

    try {
      await mountSquareCard();
      const sourceId = await tokenizeSquareCard();
      await processSquarePayment(sourceId, customerEmail);
      setCart([]);
      showCheckout(false);
      const modal = document.getElementById('success-modal');
      if (modal) modal.style.display = 'flex';
    } catch (err) {
      setMessage(err.message || 'Payment failed. Please try again.');
    } finally {
      btn && (btn.disabled = false);
    }
  });

  // Close modal button
  document.getElementById('btn-close-modal')?.addEventListener('click', () => {
    const modal = document.getElementById('success-modal');
    if (modal) modal.style.display = 'none';
  });

  render(); updateCount();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCheckout);
} else {
  initCheckout();
}
function updateCryptoLogos(cur){
  const map = { ltc: 'ltc', btc: 'btc', usdcpoly: 'usdc' };
  const labelMap = { ltc: 'LTC', btc: 'BTC', usdcpoly: 'USDC' };
  const key = map[cur] || 'ltc';
  const label = labelMap[cur] || 'LTC';
  const selLogo = document.getElementById('crypto-logo');
  const panelLogo = document.getElementById('crypto-logo-panel');
  const currencyLabel = document.getElementById('crypto-currency-label');
  if (selLogo) selLogo.setAttribute('src', `./assets/crypto/${key}.svg`);
  if (panelLogo) panelLogo.setAttribute('src', `./assets/crypto/${key}.svg`);
  if (currencyLabel) currencyLabel.textContent = label;
}
function setCryptoMessage(msg){
  const el = document.getElementById('crypto-message');
  if (!el) return;
  if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
  el.textContent = msg;
  el.style.display = 'block';
}

function setCryptoStatus(status){
  const el = document.getElementById('crypto-status');
  if (!el) return;
  const msgs = {
    'generating': '?? Generating address...',
    'waiting': '? Waiting for payment...',
    'pending': '? Pending confirmation...',
    'confirming': '?? Confirming transaction...',
    'confirmed': '? Payment confirmed!',
    'finished': '?? Payment finished!',
    'failed': '? Payment failed',
    'unknown': '? Unknown status'
  };
  const text = msgs[status] || msgs['unknown'];
  const colors = {
    'generating': 'rgba(98,160,255,.2); color:#62a0ff',
    'waiting': 'rgba(255,171,64,.2); color:#ffab40',
    'pending': 'rgba(255,171,64,.2); color:#ffab40',
    'confirming': 'rgba(98,160,255,.2); color:#62a0ff',
    'confirmed': 'rgba(46,213,115,.2); color:#2ed573',
    'finished': 'rgba(46,213,115,.2); color:#2ed573',
    'failed': 'rgba(255,39,67,.2); color:#ff2743',
    'unknown': 'rgba(255,255,255,.1); color:#ccc'
  };
  const color = colors[status] || colors['unknown'];
  el.style.background = color.split(';')[0];
  el.style.color = color.split(';')[1].replace('color:', '');
  el.textContent = text;
}

let cryptoPoll = null;
async function startCryptoCheckout(){
  const emailEl = document.getElementById('crypto-email');
  const currencyEl = document.getElementById('crypto-currency');
  const customerEmail = emailEl ? emailEl.value.trim() : '';
  const uiCurrency = currencyEl ? currencyEl.value : 'usdcpoly';
  // Map UI codes to NOWPayments API codes (NOWPayments identifiers)
  const npCurrencyMap = { usdcpoly: 'usdcmatic', ltc: 'ltc', btc: 'btc' };
  const payCurrency = npCurrencyMap[uiCurrency] || 'ltc';
  if (!customerEmail) { setCryptoMessage('Please enter your email'); return; }
  const items = getCart();
  if (!items.length) { setCryptoMessage('Your cart is empty'); return; }
  
  setCryptoMessage('');
  setCryptoStatus('generating');
  const panel = document.getElementById('crypto-panel'); if (panel) panel.style.display = 'block';
  const createBtn = document.getElementById('btn-create-crypto'); if (createBtn) createBtn.style.display = 'none';
  const cancelBtn = document.getElementById('btn-cancel-crypto'); if (cancelBtn) cancelBtn.style.display = 'inline-block';
  updateCryptoLogos(uiCurrency);

  const res = await fetch(`${API_BASE}/api/crypto/now/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      cart: items.map(i => ({ pid: i.pid, plan: i.plan, qty: i.qty })),
      customerEmail,
      payCurrency
    })
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || 'Failed to start crypto payment');

  const { payAddress, payAmount, payCurrency: cur, paymentId } = j;
  if (!payAddress || !payAmount) throw new Error('Missing address or amount');

  const addrEl = document.getElementById('crypto-address'); if (addrEl) addrEl.value = payAddress;
  const displayMap = { usdcpoly: 'USDC', usdttrc20: 'USDT', ltc: 'LTC', btc: 'BTC' };
  const displayCurrency = displayMap[uiCurrency] || (cur || payCurrency || '').toUpperCase();
  const amtEl = document.getElementById('crypto-amount'); if (amtEl) amtEl.textContent = `${payAmount} ${displayCurrency}`;
  const qrEl = document.getElementById('crypto-qr'); if (qrEl) qrEl.src = `https://quickchart.io/qr?size=260&text=${encodeURIComponent(payAddress)}`;
  setCryptoStatus('waiting');

  try { if (cryptoPoll) clearInterval(cryptoPoll); } catch {}
  cryptoPoll = setInterval(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/crypto/now/status?paymentId=${encodeURIComponent(paymentId)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to fetch status');
      const st = String(d.status || '').toLowerCase();
      if (st === 'sending' || st === 'waiting') {
        setCryptoStatus('pending');
      } else if (st === 'confirming') {
        setCryptoStatus('confirming');
      } else if (st === 'confirmed' || st === 'finished') {
        setCryptoStatus('confirmed');
        clearInterval(cryptoPoll);
        try { setCart([]); } catch {}
        const modal = document.getElementById('success-modal'); if (modal) modal.style.display = 'flex';
        const createBtn2 = document.getElementById('btn-create-crypto'); if (createBtn2) createBtn2.style.display = 'inline-block';
        const cancelBtn2 = document.getElementById('btn-cancel-crypto'); if (cancelBtn2) cancelBtn2.style.display = 'none';
      } else if (st === 'failed' || st === 'expired') {
        setCryptoStatus('failed');
        clearInterval(cryptoPoll);
      }
    } catch (err){
      console.warn('Crypto poll error:', err?.message || err);
    }
  }, 2000);
}

// Balance payment functions
async function checkBalanceAvailability() {
  const token = localStorage.getItem('auth_token');
  const email = localStorage.getItem('auth_email');
  
  if (token && email) {
    const balanceTab = document.getElementById('tab-balance');
    if (balanceTab) {
      balanceTab.style.display = 'inline-block';
    }
  }
}

async function loadBalanceInfo() {
  const token = localStorage.getItem('auth_token');
  if (!token) return;
  
  try {
    // Get current balance
    const response = await fetch(`${API_BASE}/api/get-balance`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      const balance = parseFloat(data.balance || 0);
      const total = getTotalAmount();
      
      const balanceAmountEl = document.getElementById('balance-amount');
      const balanceTotalEl = document.getElementById('balance-total');
      const insufficientEl = document.getElementById('balance-insufficient');
      const payBtn = document.getElementById('btn-pay-balance');
      
      // Format with USD and EUR
      const balanceUSD = balance.toFixed(2);
      const balanceEUR = (balance * USD_TO_EUR_RATE_CART).toFixed(2);
      const totalUSD = total.toFixed(2);
      const totalEUR = (total * USD_TO_EUR_RATE_CART).toFixed(2);
      
      if (balanceAmountEl) balanceAmountEl.textContent = `$${balanceUSD} / €${balanceEUR}`;
      if (balanceTotalEl) balanceTotalEl.textContent = `$${totalUSD} / €${totalEUR}`;
      
      if (balance < total) {
        if (insufficientEl) insufficientEl.style.display = 'block';
        if (payBtn) payBtn.disabled = true;
      } else {
        if (insufficientEl) insufficientEl.style.display = 'none';
        if (payBtn) payBtn.disabled = false;
      }
    }
  } catch (error) {
    console.error('Error loading balance:', error);
  }
}

async function processBalancePayment() {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    alert('Please log in to use balance payment');
    return;
  }
  
  const cart = getCart();
  if (cart.length === 0) {
    alert('Your cart is empty');
    return;
  }
  
  const total = getTotalAmount();
  console.log('Cart:', cart);
  console.log('Total:', total);
  
  const btn = document.getElementById('btn-pay-balance');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Processing...';
  }
  
  const payload = {
    cart: cart.map(item => ({
      pid: item.pid,
      name: item.title || item.pid,
      plan: item.plan,
      price: item.price,
      qty: item.qty || 1
    })),
    totalAmount: total
  };
  
  console.log('Sending payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch(`${API_BASE}/api/pay-with-balance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    
    console.log('Response status:', response.status);
    const responseData = await response.json();
    console.log('Response data:', responseData);
    
    if (!response.ok) {
      throw new Error(responseData.error || responseData.details || 'Payment failed');
    }
    
    // Clear cart and show success
    setCart([]);
    showCheckout(false);
    const modal = document.getElementById('success-modal');
    if (modal) modal.style.display = 'flex';
    
  } catch (error) {
    console.error('Balance payment error:', error);
    console.error('Full error:', error.message, error.stack);
    alert(error.message || 'Failed to process payment');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Pay with Balance';
    }
  }
}

function getTotalAmount() {
  const cart = getCart();
  return cart.reduce((sum, item) => {
    const qty = item.qty || 1;
    return sum + (item.price * qty);
  }, 0);
}

// PayPal F&F functions
function setPayPalMessage(msg){
  const el = document.getElementById('paypal-message');
  if (!el) return;
  if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
  el.textContent = msg;
  el.style.display = 'block';
}

function resetPayPalStatus(){
  const spinner = document.getElementById('paypal-spinner');
  const statusText = document.getElementById('paypal-status-text');
  if (spinner) spinner.style.display = 'inline-block';
  if (statusText) {
    statusText.textContent = 'Waiting for payment...';
    statusText.style.color = '#fff';
  }
  // Hide credentials if shown
  const credsContainer = document.getElementById('paypal-credentials-inline');
  if (credsContainer) credsContainer.style.display = 'none';
}

let paypalPoll = null;
let currentPayPalOrderId = null;

async function startPayPalCheckout(){
  const emailEl = document.getElementById('paypal-email');
  const customerEmail = emailEl ? emailEl.value.trim() : '';
  
  if (!customerEmail || !customerEmail.includes('@')) { 
    setPayPalMessage('Please enter a valid email address'); 
    return; 
  }
  
  const items = getCart();
  if (!items.length) { 
    setPayPalMessage('Your cart is empty'); 
    return; 
  }
  
  setPayPalMessage('');
  resetPayPalStatus();
  
  const panel = document.getElementById('paypal-panel'); 
  if (panel) panel.style.display = 'block';
  
  const createBtn = document.getElementById('btn-create-paypal'); 
  if (createBtn) createBtn.style.display = 'none';
  
  const cancelBtn = document.getElementById('btn-cancel-paypal'); 
  if (cancelBtn) cancelBtn.style.display = 'inline-block';

  try {
    const res = await fetch(`${API_BASE}/api/paypal-ff/create-order`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        cart: items.map(i => ({ pid: i.pid, plan: i.plan, qty: i.qty })),
        email: customerEmail
      })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create PayPal order');
    }

    const { orderId, email, amount, note } = data;
    
    // Save orderId for confirmation button
    currentPayPalOrderId = orderId;
    
    // Display payment information
    const orderIdEl = document.getElementById('paypal-order-id');
    if (orderIdEl) orderIdEl.textContent = orderId;
    
    const amountEl = document.getElementById('paypal-amount');
    if (amountEl) amountEl.textContent = `€${amount.toFixed(2)}`;
    
    const receiverEl = document.getElementById('paypal-receiver-email');
    if (receiverEl) receiverEl.textContent = email;
    
    const noteEl = document.getElementById('paypal-note');
    if (noteEl) noteEl.textContent = note;

    // Start polling for automatic payment detection
    try { if (paypalPoll) clearInterval(paypalPoll); } catch {}
    
    paypalPoll = setInterval(async () => {
      try {
        const statusRes = await fetch(`${API_BASE}/api/paypal-ff/check-order?orderId=${encodeURIComponent(orderId)}`);
        const statusData = await statusRes.json();
        
        if (!statusRes.ok) {
          console.warn('Failed to check order status');
          return;
        }
        
        const orderStatus = statusData.status;
        
        if (orderStatus === 'completed') {
          // Payment detected! Show success
          clearInterval(paypalPoll);
          
          // Update status UI
          const spinner = document.getElementById('paypal-spinner');
          if (spinner) spinner.style.display = 'none';
          
          const statusText = document.getElementById('paypal-status-text');
          if (statusText) {
            statusText.textContent = '✓ Payment received!';
            statusText.style.color = '#2ed573';
          }
          
          // Clear cart
          try { setCart([]); } catch {}
          
          // Check if we have credentials to display
          if (statusData.items && statusData.items.length > 0) {
            // Show credentials in the PayPal panel
            showPayPalCredentials(statusData.items);
          }
          
          const createBtn2 = document.getElementById('btn-create-paypal'); 
          if (createBtn2) createBtn2.style.display = 'inline-block';
          
          const cancelBtn2 = document.getElementById('btn-cancel-paypal'); 
          if (cancelBtn2) cancelBtn2.style.display = 'none';
        }
      } catch (err) {
        console.warn('PayPal poll error:', err?.message || err);
      }
    }, 3000); // Check every 3 seconds for fast detection

  } catch (err) {
    setPayPalMessage(err.message || 'Failed to create PayPal order');
    
    const createBtn = document.getElementById('btn-create-paypal'); 
    if (createBtn) createBtn.style.display = 'inline-block';
    
    const cancelBtn = document.getElementById('btn-cancel-paypal'); 
    if (cancelBtn) cancelBtn.style.display = 'none';
  }
}

// Show credentials in a modal
function showCredentialsModal(items) {
  // Create or get credentials modal
  let modal = document.getElementById('credentials-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'credentials-modal';
    modal.style.cssText = `
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      z-index: 9999;
      align-items: center;
      justify-content: center;
      overflow-y: auto;
      padding: 20px;
    `;
    document.body.appendChild(modal);
  }
  
  // Build credentials HTML
  let credentialsHTML = '';
  items.forEach((item, index) => {
    const creds = item.credentials || {};
    credentialsHTML += `
      <div style="background: rgba(46,213,115,.1); border: 1px solid rgba(46,213,115,.3); border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <div style="font-weight: 600; color: #2ed573; margin-bottom: 8px; font-size: 14px;">
          ${item.product.toUpperCase()} - ${item.plan}
        </div>
        <div style="font-family: monospace; font-size: 13px; line-height: 1.8;">
          ${creds.email ? `<div><span style="color: var(--text-muted);">Email:</span> <strong>${creds.email}</strong></div>` : ''}
          ${creds.password ? `<div><span style="color: var(--text-muted);">Password:</span> <strong>${creds.password}</strong></div>` : ''}
          ${creds.chatgptPassword ? `<div><span style="color: var(--text-muted);">ChatGPT Password:</span> <strong>${creds.chatgptPassword}</strong></div>` : ''}
          ${creds.chatgptCode ? `<div><span style="color: var(--text-muted);">Code:</span> <strong>${creds.chatgptCode}</strong></div>` : ''}
        </div>
      </div>
    `;
  });
  
  modal.innerHTML = `
    <div class="card" style="
      max-width: 600px;
      width: 100%;
      margin: auto;
      text-align: center;
      padding: 2rem;
      animation: slideUp 0.3s ease-out;
    ">
      <div style="
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, rgba(46,213,115,.3), rgba(46,213,115,.1));
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1.5rem;
      ">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2ed573" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      
      <h2 style="margin: 0 0 0.5rem 0; font-size: 1.75rem;">Payment Successful!</h2>
      <p style="color: var(--text-muted); margin: 0 0 1.5rem 0; font-size: 1rem;">
        Your credentials are ready. Please save them now!
      </p>
      
      <div style="text-align: left; margin-bottom: 1.5rem; max-height: 400px; overflow-y: auto;">
        ${credentialsHTML}
      </div>
      
      <div style="background: rgba(255,171,64,.1); border: 1px solid rgba(255,171,64,.3); border-radius: 8px; padding: 12px; margin-bottom: 1.5rem; text-align: left;">
        <strong style="color: #ffab40;">⚠️ Important:</strong>
        <span style="color: var(--text-muted); font-size: 14px;"> Copy and save these credentials now. You can also view them anytime in your Dashboard.</span>
      </div>
      
      <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
        <button onclick="copyAllCredentials()" class="btn btn--primary" style="min-width: 150px;">
          📋 Copy All
        </button>
        <a href="./dashboard.html" class="btn btn--ghost" style="min-width: 150px;">
          Go to Dashboard
        </a>
        <button onclick="closeCredentialsModal()" class="btn btn--ghost" style="min-width: 100px;">
          Close
        </button>
      </div>
    </div>
  `;
  
  // Store credentials for copy function
  window._lastCredentials = items;
  
  modal.style.display = 'flex';
}

function closeCredentialsModal() {
  const modal = document.getElementById('credentials-modal');
  if (modal) modal.style.display = 'none';
}

function copyAllCredentials() {
  const items = window._lastCredentials || [];
  let text = '🔐 Your PlugMarket Credentials\n';
  text += '================================\n\n';
  
  items.forEach((item, index) => {
    const creds = item.credentials || {};
    text += `📦 ${item.product.toUpperCase()} - ${item.plan}\n`;
    if (creds.email) text += `   Email: ${creds.email}\n`;
    if (creds.password) text += `   Password: ${creds.password}\n`;
    if (creds.chatgptPassword) text += `   ChatGPT Password: ${creds.chatgptPassword}\n`;
    if (creds.chatgptCode) text += `   Code: ${creds.chatgptCode}\n`;
    text += '\n';
  });
  
  text += '================================\n';
  text += 'Thank you for shopping at PlugMarket!\n';
  
  navigator.clipboard.writeText(text).then(() => {
    alert('✅ Credentials copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy:', err);
    // Fallback: show in prompt
    prompt('Copy these credentials:', text);
  });
}

// Copy functions for PayPal
function copyPayPalEmail() {
  const el = document.getElementById('paypal-receiver-email');
  if (el && el.textContent && el.textContent !== '—') {
    navigator.clipboard.writeText(el.textContent).then(() => {
      showCopyFeedback(el, 'Email copied!');
    }).catch(() => {
      prompt('Copy email:', el.textContent);
    });
  }
}

function copyPayPalNote() {
  const el = document.getElementById('paypal-note');
  if (el && el.textContent && el.textContent !== '—') {
    navigator.clipboard.writeText(el.textContent).then(() => {
      showCopyFeedback(el, 'Note copied!');
    }).catch(() => {
      prompt('Copy note:', el.textContent);
    });
  }
}

function showCopyFeedback(el, message) {
  const original = el.textContent;
  el.textContent = '✓ ' + message;
  el.style.background = 'rgba(46,213,115,0.3)';
  setTimeout(() => {
    el.textContent = original;
    el.style.background = '';
  }, 1500);
}

// Show credentials in PayPal panel
function showPayPalCredentials(items) {
  const container = document.getElementById('paypal-credentials');
  if (!container) return;
  
  let html = `
    <div style="background: linear-gradient(135deg, rgba(46,213,115,0.15) 0%, rgba(46,213,115,0.05) 100%); border: 2px solid rgba(46,213,115,0.3); border-radius:16px; padding:24px; animation: slideUp 0.3s ease-out;">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
        <div style="width:48px; height:48px; background:linear-gradient(135deg, #2ed573, #26b862); border-radius:50%; display:flex; align-items:center; justify-content:center;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div>
          <div style="font-size:20px; font-weight:700; color:#2ed573;">Payment Successful!</div>
          <div style="font-size:13px; color:var(--text-muted);">Here are your credentials</div>
        </div>
      </div>
  `;
  
  items.forEach((item, index) => {
    const creds = item.credentials || {};
    html += `
      <div style="background:rgba(0,0,0,0.3); border-radius:12px; padding:16px; margin-bottom:${index < items.length - 1 ? '12px' : '0'};">
        <div style="font-size:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">${item.product.toUpperCase()} - ${item.plan}</div>
        <div style="display:grid; gap:8px;">
    `;
    
    if (creds.email) {
      html += `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="color:var(--text-muted); font-size:13px; min-width:70px;">Email:</span>
          <code style="flex:1; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px; font-size:13px; color:#fff; word-break:break-all;">${creds.email}</code>
          <button onclick="copyToClipboard('${creds.email.replace(/'/g, "\\'")}')" style="padding:6px 10px; background:rgba(98,160,255,0.2); border:none; border-radius:6px; color:#62a0ff; cursor:pointer; font-size:11px;">Copy</button>
        </div>
      `;
    }
    if (creds.password) {
      html += `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="color:var(--text-muted); font-size:13px; min-width:70px;">Password:</span>
          <code style="flex:1; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px; font-size:13px; color:#fff;">${creds.password}</code>
          <button onclick="copyToClipboard('${creds.password.replace(/'/g, "\\'")}')" style="padding:6px 10px; background:rgba(98,160,255,0.2); border:none; border-radius:6px; color:#62a0ff; cursor:pointer; font-size:11px;">Copy</button>
        </div>
      `;
    }
    if (creds.chatgptPassword) {
      html += `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="color:var(--text-muted); font-size:13px; min-width:70px;">ChatGPT:</span>
          <code style="flex:1; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px; font-size:13px; color:#fff;">${creds.chatgptPassword}</code>
          <button onclick="copyToClipboard('${creds.chatgptPassword.replace(/'/g, "\\'")}')" style="padding:6px 10px; background:rgba(98,160,255,0.2); border:none; border-radius:6px; color:#62a0ff; cursor:pointer; font-size:11px;">Copy</button>
        </div>
      `;
    }
    
    html += `</div></div>`;
  });
  
  html += `
      <div style="margin-top:20px; display:flex; gap:10px; flex-wrap:wrap;">
        <button onclick="copyAllPayPalCredentials()" style="flex:1; padding:14px; background:linear-gradient(135deg, #003087, #0070ba); border:none; border-radius:10px; color:white; font-weight:600; cursor:pointer; font-size:14px;">📋 Copy All</button>
        <a href="./dashboard.html" style="flex:1; padding:14px; background:rgba(255,255,255,0.1); border:none; border-radius:10px; color:white; font-weight:600; text-decoration:none; text-align:center; font-size:14px;">Go to Dashboard</a>
      </div>
      <div style="margin-top:12px; padding:12px; background:rgba(255,171,64,0.1); border-radius:8px; font-size:12px; color:#ffab40; text-align:center;">
        ⚠️ Save these credentials now! You can also view them in your Dashboard.
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  container.style.display = 'block';
  
  // Store for copy all function
  window._paypalCredentials = items;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Visual feedback could be added here
  }).catch(() => {
    prompt('Copy:', text);
  });
}

function copyAllPayPalCredentials() {
  const items = window._paypalCredentials || [];
  let text = '🔐 Your PlugMarket Credentials\n';
  text += '================================\n\n';
  
  items.forEach((item) => {
    const creds = item.credentials || {};
    text += `📦 ${item.product.toUpperCase()} - ${item.plan}\n`;
    if (creds.email) text += `   Email: ${creds.email}\n`;
    if (creds.password) text += `   Password: ${creds.password}\n`;
    if (creds.chatgptPassword) text += `   ChatGPT: ${creds.chatgptPassword}\n`;
    text += '\n';
  });
  
  text += '================================\n';
  text += 'Thank you for shopping at PlugMarket!\n';
  
  navigator.clipboard.writeText(text).then(() => {
    alert('✅ All credentials copied to clipboard!');
  }).catch(() => {
    prompt('Copy these credentials:', text);
  });
}

// Make functions global for onclick handlers
window.copyPayPalEmail = copyPayPalEmail;
window.copyPayPalNote = copyPayPalNote;
window.copyToClipboard = copyToClipboard;
window.copyAllPayPalCredentials = copyAllPayPalCredentials;
