// Cart page rendering and interactions
const CART_KEY = 'plugmarket_cart';
const API_BASE = 'https://plugmarket-api.laambedoor.workers.dev';

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

async function createPaymentIntent(){
  const items = getCart();
  const data = await fetchJSON(`${API_BASE}/api/create-payment-intent`, {
    method: 'POST',
    body: JSON.stringify({ cart: items.map(i => ({ pid: i.pid, plan: i.plan, qty: i.qty })) })
  });
  return data.clientSecret;
}

async function mountElements(){
  await initStripe();
  clientSecret = await createPaymentIntent();
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
  // No need to load SDK for manual PayPal flow
  paypalLoaded = true;
  return true;
}

async function mountPaypalButtons(){
  const ok = await ensurePaypal();
  if (!ok) return;
  
  // Show manual payment button
  const container = document.getElementById('paypal-buttons');
  if (!container) return;
  
  container.innerHTML = `
    <button type="button" id="btn-paypal-manual" class="btn btn--primary" style="width: 100%; padding: 14px; font-size: 16px; margin-top: 10px;">
      Continuar con PayPal
    </button>
  `;
  
  document.getElementById('btn-paypal-manual')?.addEventListener('click', async () => {
    try {
      const emailEl = document.getElementById('paypal-email');
      const customerEmail = emailEl ? emailEl.value.trim() : '';
      if (!customerEmail || !customerEmail.includes('@')) {
        setPaypalMessage('Por favor ingresa tu email');
        return;
      }
      
      setPaypalMessage('Generando instrucciones de pago...');
      
      const items = getCart();
      const res = await fetch(`${API_BASE}/api/paypal/manual-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cart: items.map(i => ({ pid: i.pid, plan: i.plan, qty: i.qty })),
          customerEmail
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setPaypalMessage(data.error || 'Error al generar instrucciones');
        return;
      }
      
      // Show payment instructions
      const instructions = data.instructions.es;
      const instructionsHTML = `
        <div style="background: rgba(255,171,64,.1); border: 2px solid #ffab40; border-radius: 8px; padding: 20px; margin-top: 15px;">
          <h3 style="margin: 0 0 15px 0; color: #ffab40; font-size: 18px;">📱 Instrucciones de Pago</h3>
          <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li style="margin-bottom: 10px;">${instructions.step1}</li>
            <li style="margin-bottom: 10px;">${instructions.step2}</li>
            <li style="margin-bottom: 10px; color: #ff2743; font-weight: 600;">${instructions.step3}</li>
            <li style="margin-bottom: 10px;">
              ${instructions.step4}<br>
              <div style="background: rgba(0,0,0,.3); padding: 10px; border-radius: 4px; margin-top: 8px; font-family: monospace; font-size: 16px; font-weight: 700; color: #2ed573; text-align: center; cursor: pointer;" onclick="navigator.clipboard.writeText('${data.reference}').then(() => alert('✅ Copiado al portapapeles'))">
                ${data.reference}
                <span style="font-size: 12px; opacity: 0.8; display: block; margin-top: 4px;">👆 Click para copiar</span>
              </div>
            </li>
            <li style="color: #2ed573; font-weight: 600;">${instructions.step5}</li>
          </ol>
          <div style="margin-top: 20px; padding: 15px; background: rgba(0,0,0,.2); border-radius: 6px;">
            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">💰 Monto a enviar:</div>
            <div style="font-size: 24px; font-weight: 700; color: #2ed573;">$${data.amount} ${data.currency}</div>
            <div style="font-size: 14px; opacity: 0.9; margin-top: 12px;">📧 Email de PayPal:</div>
            <div style="font-size: 16px; font-weight: 600; color: #62a0ff; font-family: monospace;">${data.paypalEmail}</div>
          </div>
          <div style="margin-top: 15px; padding: 12px; background: rgba(46,213,115,.15); border-radius: 6px; font-size: 13px; text-align: center;">
            ✅ Tu pedido será procesado automáticamente una vez detectemos el pago
          </div>
        </div>
      `;
      
      container.innerHTML = instructionsHTML;
      setPaypalMessage('');
      
    } catch (error) {
      setPaypalMessage(error.message || 'Error al procesar solicitud');
    }
  });
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

function money(n){ return '$' + n.toFixed(2); }

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

  list.innerHTML = items.map((it, idx) => {
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
      'chatgpt': 'resized/chatgptplus84.png',
      'capcut': 'resized/capcutpro84.png',
      'geoguessr': 'resized/geoguessr84.png',
      'filmora': 'resized/filmora84.png',
      'duolingo': 'resized/duolingo84.png',
      'movistar': 'resized/movistar+84.png'
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

  const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  subtotalEl.textContent = money(subtotal);
}

// Event handlers
addEventListener('click', (e) => {
  const inc = e.target.closest('.js-inc');
  const dec = e.target.closest('.js-dec');
  const rem = e.target.closest('.js-remove');
  const copy = e.target.closest('#btn-copy-address');
  if (inc){ const i = +inc.dataset.i; const items = getCart(); items[i].qty++; setCart(items); }
  if (dec){ const i = +dec.dataset.i; const items = getCart(); items[i].qty = Math.max(1, items[i].qty - 1); setCart(items); }
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
    const crypto = document.getElementById('crypto-container'); if (crypto) crypto.style.display = 'none';
    document.getElementById('tab-card').classList.add('btn--primary');
    document.getElementById('tab-paypal')?.classList.remove('btn--primary');
    document.getElementById('tab-crypto')?.classList.remove('btn--primary');
  });
  document.getElementById('tab-paypal')?.addEventListener('click', async () => {
    document.getElementById('payment-form').style.display = 'none';
    document.getElementById('paypal-container').style.display = 'block';
    const crypto = document.getElementById('crypto-container'); if (crypto) crypto.style.display = 'none';
    document.getElementById('tab-paypal').classList.add('btn--primary');
    document.getElementById('tab-card')?.classList.remove('btn--primary');
    document.getElementById('tab-crypto')?.classList.remove('btn--primary');
    try { await mountPaypalButtons(); } catch (e){ setPaypalMessage(e.message || 'Unable to load PayPal'); }
  });
  document.getElementById('tab-crypto')?.addEventListener('click', async () => {
    document.getElementById('payment-form').style.display = 'none';
    document.getElementById('paypal-container').style.display = 'none';
    const crypto = document.getElementById('crypto-container'); if (crypto) crypto.style.display = 'block';
    document.getElementById('tab-crypto')?.classList.add('btn--primary');
    document.getElementById('tab-card')?.classList.remove('btn--primary');
    document.getElementById('tab-paypal')?.classList.remove('btn--primary');
    try {
      const sel = document.getElementById('crypto-currency');
      const val = sel ? sel.value : 'usdcpoly';
      updateCryptoLogos(val);
    } catch {}
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

  // Update crypto logos on currency change
  const currencySel = document.getElementById('crypto-currency');
  currencySel?.addEventListener('change', () => {
    updateCryptoLogos(currencySel.value);
  });

  document.getElementById('payment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!stripe || !elements) {
      try { await mountElements(); } catch (err){ return setMessage(err.message || 'Unable to start payment'); }
    }
    
    // Get email from form
    const emailEl = document.getElementById('checkout-email');
    const customerEmail = emailEl ? emailEl.value.trim() : '';
    if (!customerEmail) {
      setMessage('Please enter your email');
      return;
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

