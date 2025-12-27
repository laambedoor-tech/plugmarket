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
      } catch (e){
        setPaypalMessage(e.message || 'Payment failed');
      }
    },
    onError: (err) => setPaypalMessage(err?.message || 'PayPal error')
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
    // Usar PNG para todos los productos
    const logoFile = it.pid === 'geoguessr' ? 'geoguesser.png' : it.pid === 'youtube-premium' ? 'youtube.png' : `${it.pid}.png`;
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
          <button class="btn btn--ghost btn--sm js-dec" data-i="${idx}">–</button>
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
  if (inc){ const i = +inc.dataset.i; const items = getCart(); items[i].qty++; setCart(items); }
  if (dec){ const i = +dec.dataset.i; const items = getCart(); items[i].qty = Math.max(1, items[i].qty - 1); setCart(items); }
  if (rem){ const i = +rem.dataset.i; const items = getCart(); items.splice(i,1); setCart(items); }
});

// Clear and checkout
addEventListener('DOMContentLoaded', () => {
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
});
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
    'waiting': 'Waiting for payment...',
    'pending': '⏳ Pending confirmation...',
    'confirming': '⚙️ Confirming transaction...',
    'confirmed': '✅ Payment confirmed!',
    'finished': '🎉 Payment finished!',
    'failed': '❌ Payment failed',
    'unknown': '❓ Unknown status'
  };
  const text = msgs[status] || msgs['unknown'];
  const colors = {
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
  const payCurrency = currencyEl ? currencyEl.value : 'ltc';
  if (!customerEmail) { setCryptoMessage('Please enter your email'); return; }
  const items = getCart();
  if (!items.length) { setCryptoMessage('Your cart is empty'); return; }
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
  const panel = document.getElementById('crypto-panel');
  if (panel) panel.style.display = 'block';
  document.getElementById('btn-create-crypto').style.display = 'none';
  document.getElementById('btn-cancel-crypto').style.display = 'inline-block';
  const addrEl = document.getElementById('crypto-address');
  const amtEl = document.getElementById('crypto-amount');
  const qrEl = document.getElementById('crypto-qr');
  if (addrEl) addrEl.value = j.payAddress || '';
  if (amtEl) amtEl.textContent = `${j.payAmount} ${String(j.payCurrency).toUpperCase()} (${money(j.priceAmount)} USD)`;
  if (qrEl) qrEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(j.payAddress||'')}`;
  setCryptoStatus('waiting');
  // Poll status endpoint for real-time updates
  try { if (cryptoPoll) clearInterval(cryptoPoll); } catch {}
  const paymentId = j.paymentId;
  cryptoPoll = setInterval(async () => {
    try {
      const statusRes = await fetch(`${API_BASE}/api/crypto/now/status?paymentId=${encodeURIComponent(paymentId)}`);
      const statusData = await statusRes.json();
      if (statusRes.ok) {
        const st = (statusData.status || 'unknown').toLowerCase();
        setCryptoStatus(st);
        // On confirmed/finished, check orders for fulfillment
        if (['confirmed', 'finished'].includes(st)) {
          try {
            const ordersRes = await fetch(`${API_BASE}/api/get-orders?email=${encodeURIComponent(customerEmail)}`);
            const ordersData = await ordersRes.json();
            const found = (ordersData.orders||[]).find(o => String(o.payment_intent_id) === String(paymentId));
            if (found && Array.isArray(found.items) && found.items.length > 0) {
              clearInterval(cryptoPoll);
              setCart([]);
              showCheckout(false);
              const modal = document.getElementById('success-modal');
              if (modal) modal.style.display = 'flex';
            }
          } catch (e) { console.error('Orders fetch error:', e); }
        }
      }
    } catch (e) { console.error('Status poll error:', e); }
  }, 5000); // Poll every 5 seconds
}
