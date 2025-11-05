// Cart page rendering and interactions
const CART_KEY = 'plugmarket_cart';

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

  list.innerHTML = items.map((it, idx) => `
    <div class="variant" style="border-radius:0; border-left:0; border-right:0;">
      <div class="variant__thumb" style="background:${toneToGradient(it.tone)}">
        <img src="./assets/products/${it.pid}.svg" alt="${it.title} logo" loading="lazy" decoding="async" onerror="this.style.display='none'" />
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
  `).join('');

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
  document.getElementById('btn-checkout')?.addEventListener('click', () => {
    // TODO: Implementar función de checkout/pago
    alert('Checkout - Próximamente disponible');
  });
  render(); updateCount();
});
