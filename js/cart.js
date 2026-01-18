// Cart page rendering and interactions
const CART_KEY = 'plugmarket_cart';
const API_BASE = 'https://plugmarket.es';
const USD_TO_EUR_RATE_CART = 0.92; // Exchange rate USD to EUR

// Stripe Elements state
let stripe = null;
let elements = null;
let paymentElement = null;
let clientSecret = null;
let paypalLoaded = false;
let paypalConfig = null;
let paypalOrderRef = '';

async function fetchJSON(url, opts){
  const res = await fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
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

async function initStripe(){
  if (stripe) return stripe;
  // @ts-ignore Stripe is loaded via global script
  if (!window.Stripe) throw new Error('Stripe.js not loaded');
  const cfg = await fetchJSON(`${API_BASE}/api/get-stripe-config`);
  stripe = window.Stripe(cfg.publishableKey);
  return stripe;
}

async function createPaymentIntent(customerEmail){
  const items = getCart();
  const data = await fetchJSON(`${API_BASE}/api/create-payment-intent`, {
    method: 'POST',
    body: JSON.stringify({ 
      cart: items.map(i => ({ pid: i.pid, plan: i.plan, qty: i.qty })),
      customerEmail: customerEmail || '' 
    })
  });
  return data.clientSecret;
}

async function mountElements(customerEmail){
  await initStripe();
  clientSecret = await createPaymentIntent(customerEmail);
  elements = stripe.elements({ clientSecret });
  paymentElement = elements.create('payment');
  paymentElement.mount('#payment-element');
}

function setMessage(msg){
  const el = document.getElementById('payment-message');
  if (!el) return;
  if (!msg){ el.style.display = 'none'; el.textContent = ''; return; }
  el.textContent = msg;
  el.style.display = 'block';
}

function setPaypalMessage(msg){
  const el = document.getElementById('paypal-message');
  if (!el) return;
  if (!msg){ el.style.display = 'none'; el.textContent = ''; return; }
  el.textContent = msg;
  el.style.display = 'block';
}

async function ensurePaypal(){
  if (paypalLoaded) return true;
  paypalConfig = await fetchJSON(`${API_BASE}/api/paypal/config`);
  if (!paypalConfig.clientId){ setPaypalMessage('PayPal is not configured yet.'); return false; }
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    // Use capture intent; disable card/credit to avoid duplicate flows via PayPal
    const currency = encodeURIComponent(paypalConfig.currency || 'USD');
    const clientId = encodeURIComponent(paypalConfig.clientId);
    s.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}&intent=capture&disable-funding=card,credit,venmo&components=buttons&commit=true`;
    s.onload = () => { paypalLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('Failed to load PayPal SDK'));
    document.head.appendChild(s);
  });
  return true;
}

async function mountPaypalButtons(){
  const ok = await ensurePaypal();
  if (!ok) return;
  // @ts-ignore
  if (!window.paypal) { setPaypalMessage('PayPal SDK not available'); return; }
  // Prevent PayPal usage for very small orders (< $1.00) which PayPal rejects in live.
  try {
    const items = getCart();
    const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
    if (subtotal < 1) {
      setPaypalMessage('PayPal requires a minimum of $1.00. Please add more items or use Card.');
      const container = document.getElementById('paypal-buttons');
      if (container) container.innerHTML = '';
      return;
    }
  } catch {}
  const container = document.getElementById('paypal-buttons');
  container.innerHTML = '';
  // @ts-ignore
  window.paypal.Buttons({
    style: { layout: 'vertical', shape: 'rect', color: 'gold' },
    createOrder: async () => {
      const items = getCart();
      const res = await fetch(`${API_BASE}/api/paypal/create-order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart: items.map(i => ({ pid: i.pid, plan: i.plan, qty: i.qty })) })
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data?.details?.[0]?.issue || data?.details?.[0]?.description || data?.name || '';
        setPaypalMessage(`PayPal error: ${data.error || detail || 'Failed to create order'}`);
        throw new Error(data.error || detail || 'Failed to create PayPal order');
      }
      paypalOrderRef = data.reference || '';
      const refEl = document.getElementById('paypal-reference');
      if (refEl) {
        if (paypalOrderRef) {
          refEl.textContent = `Referencia PayPal: ${paypalOrderRef}`;
          refEl.style.display = 'block';
        } else {
          refEl.textContent = '';
          refEl.style.display = 'none';
        }
      }
      return data.id;
    },
    onApprove: async (data) => {
      try {
        const emailEl = document.getElementById('paypal-email');
        const customerEmail = emailEl ? emailEl.value.trim() : '';
        if (!customerEmail) {
          setPaypalMessage('Please enter your email');
          return;
        }
        const items = getCart();
        const res = await fetch(`${API_BASE}/api/paypal/capture-order`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: data.orderID,
            cart: items.map(i => ({ pid: i.pid, plan: i.plan, qty: i.qty })),
            customerEmail
          })
        });
        const j = await res.json();
        if (!res.ok) {
          const detail = j?.details?.[0]?.issue || j?.details?.[0]?.description || j?.name || '';
          setPaypalMessage(`PayPal capture error: ${j.error || detail || 'Capture failed'}`);
          throw new Error(j.error || detail || 'Capture failed');
        }
        // success
        setCart([]);
        showCheckout(false);
        const modal = document.getElementById('success-modal');
        if (modal) modal.style.display = 'flex';
        if (modal){
          const note = modal.querySelector('.paypal-ref');
          if (note) {
            note.textContent = paypalOrderRef ? `Referencia: ${paypalOrderRef}` : '';
            note.style.display = paypalOrderRef ? 'block' : 'none';
          }
        }
      } catch (e) {
        setPaypalMessage(e.message || 'Capture failed');
      }
    },
    onCancel: () => { setPaypalMessage('Payment was cancelled.'); },
    onError: (err) => { setPaypalMessage('An error occurred with PayPal.'); }
  }).render('#paypal-buttons');
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
      'chatgpt': 'resized/chatgptplus84.png',
      'chatgpt-pro': 'resized/chatgptpro84.png',
      'capcut': 'resized/capcutpro84.png',
      'geoguessr': 'resized/geoguessr84.png',
      'filmora': 'resized/filmora84.png',
      'duolingo': 'resized/duolingo84.png',
      'movistar': 'resized/movistar+84.png',
      'dazn': 'resized/dazn84.png'
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
  document.getElementById('btn-checkout')?.addEventListener('click', async () => {
    const items = getCart();
    if (!items.length) return;
    try {
      showCheckout(true);
      // Slight delay to ensure panel visible, then mount elements
      setTimeout(() => { mountElements().catch(err => setMessage(err.message)); }, 50);
      document.getElementById('checkout-email')?.focus();
    } catch (e) {
      setMessage(e.message || 'Checkout unavailable');
    }
  });
  // Method tab switching
  document.getElementById('tab-card')?.addEventListener('click', () => {
    document.getElementById('payment-form').style.display = 'block';
    document.getElementById('paypal-container').style.display = 'none';
    const paypalFF = document.getElementById('paypal-ff-container'); if (paypalFF) paypalFF.style.display = 'none';
    const crypto = document.getElementById('crypto-container'); if (crypto) crypto.style.display = 'none';
    const balance = document.getElementById('balance-container'); if (balance) balance.style.display = 'none';
    document.getElementById('tab-card').classList.add('btn--primary');
    document.getElementById('tab-paypal')?.classList.remove('btn--primary');
    document.getElementById('tab-paypal-ff')?.classList.remove('btn--primary');
    document.getElementById('tab-crypto')?.classList.remove('btn--primary');
    document.getElementById('tab-balance')?.classList.remove('btn--primary');
  });
  document.getElementById('tab-paypal')?.addEventListener('click', async () => {
    document.getElementById('payment-form').style.display = 'none';
    document.getElementById('paypal-container').style.display = 'block';
    const paypalFF = document.getElementById('paypal-ff-container'); if (paypalFF) paypalFF.style.display = 'none';
    const crypto = document.getElementById('crypto-container'); if (crypto) crypto.style.display = 'none';
    const balance = document.getElementById('balance-container'); if (balance) balance.style.display = 'none';
    document.getElementById('tab-paypal').classList.add('btn--primary');
    document.getElementById('tab-card')?.classList.remove('btn--primary');
    document.getElementById('tab-paypal-ff')?.classList.remove('btn--primary');
    document.getElementById('tab-crypto')?.classList.remove('btn--primary');
    document.getElementById('tab-balance')?.classList.remove('btn--primary');
    try { await mountPaypalButtons(); } catch (e){ setPaypalMessage(e.message || 'Unable to load PayPal'); }
  });
  document.getElementById('tab-paypal-ff')?.addEventListener('click', () => {
    document.getElementById('payment-form').style.display = 'none';
    document.getElementById('paypal-container').style.display = 'none';
    const paypalFF = document.getElementById('paypal-ff-container'); if (paypalFF) paypalFF.style.display = 'block';
    const crypto = document.getElementById('crypto-container'); if (crypto) crypto.style.display = 'none';
    const balance = document.getElementById('balance-container'); if (balance) balance.style.display = 'none';
    document.getElementById('tab-paypal-ff')?.classList.add('btn--primary');
    document.getElementById('tab-card')?.classList.remove('btn--primary');
    document.getElementById('tab-paypal')?.classList.remove('btn--primary');
    document.getElementById('tab-crypto')?.classList.remove('btn--primary');
    document.getElementById('tab-balance')?.classList.remove('btn--primary');
    
    // Pre-fill email if exists
    const savedEmail = localStorage.getItem('userEmail');
    const emailInput = document.getElementById('paypal-ff-email');
    if (savedEmail && emailInput && !emailInput.value) {
      emailInput.value = savedEmail;
    }
  });
  document.getElementById('tab-crypto')?.addEventListener('click', async () => {
    document.getElementById('payment-form').style.display = 'none';
    document.getElementById('paypal-container').style.display = 'none';
    const paypalFF = document.getElementById('paypal-ff-container'); if (paypalFF) paypalFF.style.display = 'none';
    const crypto = document.getElementById('crypto-container'); if (crypto) crypto.style.display = 'block';
    const balance = document.getElementById('balance-container'); if (balance) balance.style.display = 'none';
    document.getElementById('tab-crypto')?.classList.add('btn--primary');
    document.getElementById('tab-card')?.classList.remove('btn--primary');
    document.getElementById('tab-paypal')?.classList.remove('btn--primary');
    document.getElementById('tab-paypal-ff')?.classList.remove('btn--primary');
    document.getElementById('tab-balance')?.classList.remove('btn--primary');
    try {
      const sel = document.getElementById('crypto-currency');
      const val = sel ? sel.value : 'usdcpoly';
      updateCryptoLogos(val);
    } catch {}
  });
  document.getElementById('tab-balance')?.addEventListener('click', async () => {
    document.getElementById('payment-form').style.display = 'none';
    document.getElementById('paypal-container').style.display = 'none';
    const paypalFF = document.getElementById('paypal-ff-container'); if (paypalFF) paypalFF.style.display = 'none';
    const crypto = document.getElementById('crypto-container'); if (crypto) crypto.style.display = 'none';
    const balance = document.getElementById('balance-container'); if (balance) balance.style.display = 'block';
    document.getElementById('tab-balance')?.classList.add('btn--primary');
    document.getElementById('tab-card')?.classList.remove('btn--primary');
    document.getElementById('tab-paypal')?.classList.remove('btn--primary');
    document.getElementById('tab-paypal-ff')?.classList.remove('btn--primary');
    document.getElementById('tab-crypto')?.classList.remove('btn--primary');
    try { await loadBalanceInfo(); } catch (e){ console.error('Failed to load balance:', e); }
  });
  
  // PayPal F&F button - Validate email first, then show warning modal
  document.getElementById('btn-pay-paypal-ff')?.addEventListener('click', () => {
    // Get email from the input field in the panel
    const emailInput = document.getElementById('paypal-ff-email');
    const email = emailInput?.value.trim();
    
    // Validate email
    if (!email || !email.includes('@') || !email.includes('.')) {
      emailInput.style.borderColor = '#ff0055';
      emailInput.style.background = 'rgba(255, 0, 85, 0.1)';
      emailInput.focus();
      
      // Show error message
      const existingError = document.getElementById('email-error-msg');
      if (existingError) existingError.remove();
      
      const errorMsg = document.createElement('p');
      errorMsg.id = 'email-error-msg';
      errorMsg.style.cssText = 'color: #ff5555; font-size: 13px; margin: 8px 0 0 0; font-weight: 600;';
      errorMsg.textContent = '⚠️ Please enter a valid email address';
      emailInput.parentElement.appendChild(errorMsg);
      
      setTimeout(() => {
        emailInput.style.borderColor = 'rgba(100, 100, 255, 0.2)';
        emailInput.style.background = 'rgba(255, 255, 255, 0.05)';
        if (errorMsg.parentElement) errorMsg.remove();
      }, 3000);
      
      return;
    }
    
    // Save email to localStorage
    localStorage.setItem('userEmail', email);
    
    // Show PayPal warning modal
    showPayPalWarningModal();
  });
  document.getElementById('btn-cancel-paypal-ff')?.addEventListener('click', () => {
    showCheckout(false);
  });
  
  document.getElementById('btn-create-crypto')?.addEventListener('click', async () => {
    try { await startCryptoCheckout(); } catch (e){ setCryptoMessage(e.message || 'Unable to start crypto checkout'); }
  });
  document.getElementById('btn-cancel-paypal')?.addEventListener('click', () => {
    showCheckout(false); setPaypalMessage('');
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
  document.getElementById('btn-cancel-checkout')?.addEventListener('click', () => {
    showCheckout(false);
    setMessage('');
    // Optionally unmount elements to allow re-creating intents
    try { paymentElement && paymentElement.unmount(); } catch {}
    paymentElement = null; elements = null; clientSecret = null;
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
    
    // Get email from form first
    const emailEl = document.getElementById('checkout-email');
    const customerEmail = emailEl ? emailEl.value.trim() : '';
    if (!customerEmail) {
      setMessage('Please enter your email');
      return;
    }
    
    if (!stripe || !elements) {
      try { await mountElements(); } catch (err){ return setMessage(err.message || 'Unable to start payment'); }
    }
    
    // Update payment intent with email before confirming
    try {
      const response = await fetch(`${API_BASE}/api/update-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clientSecret: clientSecret,
          customerEmail: customerEmail 
        })
      });
      
      if (!response.ok) {
        console.warn('Failed to update payment intent with email');
      }
    } catch (err) {
      console.warn('Error updating payment intent:', err);
    }
    
    setMessage('');
    const btn = document.getElementById('btn-pay');
    btn && (btn.disabled = true);
    
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { 
        return_url: window.location.origin + '/cart.html',
        receipt_email: customerEmail
      },
      redirect: 'if_required',
    });
    
    btn && (btn.disabled = false);
    if (error) {
      setMessage(error.message || 'Payment failed. Please try again.');
      return;
    }
    if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Show success modal
      setCart([]);
      showCheckout(false);
      const modal = document.getElementById('success-modal');
      if (modal) modal.style.display = 'flex';
    } else {
      // For some methods, Stripe may redirect instead. We'll rely on return_url.
      setMessage('Follow the instructions to complete the payment.');
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
  const key = map[cur] || 'usdc';
  const selLogo = document.getElementById('crypto-logo');
  const panelLogo = document.getElementById('crypto-logo-panel');
  if (selLogo) selLogo.setAttribute('src', `./assets/crypto/${key}.svg`);
  if (panelLogo) panelLogo.setAttribute('src', `./assets/crypto/${key}.svg`);
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

function showPayPalFFWarning() {
  // Email is now handled in the panel, just show the warning modal
  showPayPalWarningModal();
}

function showEmailModal() {
  const modal = document.createElement('div');
  modal.id = 'email-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    backdrop-filter: blur(10px);
    animation: fadeIn 0.3s ease;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: linear-gradient(145deg, #1a1a3e 0%, #16213e 100%);
    border-radius: 24px;
    padding: 44px;
    max-width: 480px;
    width: 90%;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(100, 100, 255, 0.2);
    animation: slideUp 0.4s ease;
  `;

  modalContent.innerHTML = `
    <style>
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .email-input {
        width: 100%;
        padding: 16px;
        background: rgba(255, 255, 255, 0.05);
        border: 2px solid rgba(100, 100, 255, 0.2);
        border-radius: 12px;
        color: #fff;
        font-size: 15px;
        outline: none;
        transition: all 0.3s;
      }
      .email-input:focus {
        border-color: #0088ff;
        background: rgba(255, 255, 255, 0.08);
      }
      .email-input::placeholder {
        color: #7788aa;
      }
    </style>
    <div style="text-align: center;">
      <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #ff0080, #ff0055); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; box-shadow: 0 8px 24px rgba(255, 0, 128, 0.5);">
        <svg width="32" height="32" fill="none" stroke="white" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
        </svg>
      </div>
      <h2 style="color: #fff; font-size: 24px; margin-bottom: 12px; font-weight: 700;">Email Required</h2>
      <p style="color: #8899ff; font-size: 15px; line-height: 1.6; margin-bottom: 32px;">
        Please enter your email address to receive order updates and confirmation.
      </p>
      
      <input type="email" id="userEmailInput" class="email-input" placeholder="your.email@example.com" autofocus>
      
      <div style="display: flex; gap: 12px; margin-top: 28px;">
        <button id="cancel-email" style="flex: 1; padding: 16px; background: rgba(255, 255, 255, 0.08); color: #fff; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
          Cancel
        </button>
        <button id="save-email" style="flex: 1; padding: 16px; background: linear-gradient(135deg, #ff0080, #ff0055); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 16px rgba(255, 0, 128, 0.4);">
          Continue →
        </button>
      </div>
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  const input = modal.querySelector('#userEmailInput');
  const cancelBtn = modal.querySelector('#cancel-email');
  const saveBtn = modal.querySelector('#save-email');

  // Hover effects
  cancelBtn.addEventListener('mouseenter', () => {
    cancelBtn.style.background = 'rgba(255, 255, 255, 0.12)';
  });
  cancelBtn.addEventListener('mouseleave', () => {
    cancelBtn.style.background = 'rgba(255, 255, 255, 0.08)';
  });

  saveBtn.addEventListener('mouseenter', () => {
    saveBtn.style.transform = 'translateY(-2px)';
    saveBtn.style.boxShadow = '0 6px 24px rgba(255, 0, 128, 0.6)';
  });
  saveBtn.addEventListener('mouseleave', () => {
    saveBtn.style.transform = 'translateY(0)';
    saveBtn.style.boxShadow = '0 4px 16px rgba(255, 0, 128, 0.4)';
  });

  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  saveBtn.addEventListener('click', () => {
    const email = input.value.trim();
    if (!email || !email.includes('@') || !email.includes('.')) {
      input.style.borderColor = '#ff0055';
      input.focus();
      return;
    }
    localStorage.setItem('userEmail', email);
    document.body.removeChild(modal);
    showPayPalWarningModal();
  });

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveBtn.click();
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

function showPayPalWarningModal() {
  const modal = document.createElement('div');
  modal.id = 'paypal-ff-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(10px);
    animation: fadeIn 0.3s ease;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: linear-gradient(145deg, #1a1a3e 0%, #16213e 100%);
    border-radius: 24px;
    padding: 44px;
    max-width: 520px;
    width: 90%;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(100, 100, 255, 0.2);
    animation: slideUp 0.4s ease;
  `;

  modalContent.innerHTML = `
    <div style="text-align: center;">
      <div style="width: 68px; height: 68px; background: linear-gradient(135deg, #0088ff, #0066cc); border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; box-shadow: 0 8px 32px rgba(0, 136, 255, 0.5);">
        <svg width="36" height="36" fill="white" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
      </div>
      <h2 style="color: #fff; font-size: 26px; margin-bottom: 16px; font-weight: 700; letter-spacing: -0.5px;">Important - Friends & Family Payment</h2>
      <p style="color: #8899ff; font-size: 15px; line-height: 1.7; margin-bottom: 32px;">
        Make sure to send the payment as <strong style="color: #00ff88;">Friends & Family</strong> 
        and include the <strong style="color: #00ff88;">payment note</strong>, otherwise your order 
        <strong style="color: #ff5555;">will not be processed automatically</strong>.
      </p>
      
      <div style="background: rgba(0, 136, 255, 0.08); border: 1px solid rgba(0, 136, 255, 0.25); border-radius: 14px; padding: 20px; margin-bottom: 32px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; background: rgba(0, 136, 255, 0.15); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg width="22" height="22" fill="none" stroke="#0088ff" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
          </div>
          <div style="text-align: left; flex: 1;">
            <div style="color: #0088ff; font-size: 14px; font-weight: 700; margin-bottom: 4px;">For Friends and Family</div>
            <div style="color: #7788aa; font-size: 13px; line-height: 1.4;">Buyer Protection doesn't apply to this payment</div>
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 14px;">
        <button id="cancel-paypal-ff" style="flex: 1; padding: 16px; background: rgba(255, 255, 255, 0.08); color: #fff; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
          Cancel
        </button>
        <button id="continue-paypal-ff" style="flex: 2; padding: 16px; background: linear-gradient(135deg, #ff0080, #ff0055); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 20px rgba(255, 0, 128, 0.4);">
          I Understand, Continue →
        </button>
      </div>
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  const cancelBtn = modal.querySelector('#cancel-paypal-ff');
  const continueBtn = modal.querySelector('#continue-paypal-ff');

  cancelBtn.addEventListener('mouseenter', () => {
    cancelBtn.style.background = 'rgba(255, 255, 255, 0.12)';
  });
  cancelBtn.addEventListener('mouseleave', () => {
    cancelBtn.style.background = 'rgba(255, 255, 255, 0.08)';
  });

  continueBtn.addEventListener('mouseenter', () => {
    continueBtn.style.transform = 'translateY(-2px)';
    continueBtn.style.boxShadow = '0 6px 28px rgba(255, 0, 128, 0.6)';
  });
  continueBtn.addEventListener('mouseleave', () => {
    continueBtn.style.transform = 'translateY(0)';
    continueBtn.style.boxShadow = '0 4px 20px rgba(255, 0, 128, 0.4)';
  });

  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  continueBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
    const cart = getCart();
    const cartParam = encodeURIComponent(JSON.stringify(cart));
    window.location.href = `paypal-ff.html?cart=${cartParam}`;
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

