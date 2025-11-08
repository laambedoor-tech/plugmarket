// Plug Market — JS: partículas, productos demo y contadores

// 0) Mobile Menu Toggle
(() => {
  const toggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.getElementById('mobile-sidebar');
  const close = document.getElementById('mobile-sidebar-close');
  const overlay = document.getElementById('mobile-sidebar-overlay');

  if (!toggle || !sidebar) return;

  function openSidebar() {
    sidebar.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar.classList.remove('active');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', openSidebar);
  if (close) close.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // Close sidebar when clicking links
  sidebar.querySelectorAll('.mobile-sidebar__link').forEach(link => {
    link.addEventListener('click', () => {
      setTimeout(closeSidebar, 200);
    });
  });
})();

// 1) Partículas en canvas con glow rojo
(() => {
  const canvas = document.getElementById('bg-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let w, h;

  const particles = [];
  const COUNT = 80;
  const COLOR = 'rgba(255, 39, 67, 0.8)';
  const COLOR_DIM = 'rgba(255, 255, 255, 0.15)';

  function resize() {
    w = canvas.width = Math.floor(innerWidth * DPR);
    h = canvas.height = Math.floor(innerHeight * DPR);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
  }

  function rand(a, b) { return Math.random() * (b - a) + a; }

  function spawn(i) {
    const speed = rand(0.04, 0.14);
    const isAccent = i % 6 === 0;
    return {
      x: rand(0, w),
      y: rand(0, h),
      vx: rand(-speed, speed),
      vy: rand(-speed, speed),
      r: rand(1.0, isAccent ? 2.6 : 2.0),
      color: isAccent ? COLOR : COLOR_DIM,
      life: rand(0, 1)
    };
  }

  function connect(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const d2 = dx*dx + dy*dy;
    const max = 110 * DPR;
    if (d2 < max*max) {
      const alpha = 1 - Math.sqrt(d2) / max;
      ctx.strokeStyle = 'rgba(255,255,255,' + (alpha * 0.08) + ')';
      ctx.lineWidth = 1 * DPR;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  function tick() {
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx * DPR * 2;
      p.y += p.vy * DPR * 2;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12 * DPR;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * DPR, 0, Math.PI * 2);
      ctx.fill();
    }

    // conexiones sutiles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        connect(particles[i], particles[j]);
      }
    }

    requestAnimationFrame(tick);
  }

  resize();
  addEventListener('resize', resize);
  for (let i = 0; i < COUNT; i++) particles.push(spawn(i));
  requestAnimationFrame(tick);
})();

// 2) Productos demo
const API_BASE = 'https://plugmarket-api.laambedoor.workers.dev';

const products = [
  { id: 'netflix', title: 'Netflix', price: '$', tone: 'red' },
  { id: 'spotify', title: 'Spotify Premium', price: '$', tone: 'green' },
  { id: 'youtube-premium', title: 'YouTube Premium', price: '$', tone: 'orange' },
  { id: 'disney', title: 'Disney+ ', price: '$', tone: 'blue' },
  { id: 'prime', title: 'Prime Video', price: '$', tone: 'blue' },
  { id: 'hbomax', title: 'HBO Max', price: '$', tone: 'purple' },
  { id: 'nordvpn', title: 'NordVPN', price: '$', tone: 'cyan' },
  { id: 'crunchy', title: 'Crunchyroll', price: '$', tone: 'orange' },
  { id: 'nitro', title: 'Discord Nitro', price: '$', tone: 'purple' },
  { id: 'chatgpt', title: 'ChatGPT Plus', price: '$', tone: 'teal' },
  { id: 'capcut', title: 'CapCut Pro', price: '$', tone: 'cyan' },
  { id: 'geoguessr', title: 'GeoGuessr', price: '$', tone: 'green' },
];

let stockData = {};

// Suscripciones por producto (precios según adjuntos, en USD)
const subscriptions = {
  // Solo Netflix tendrá opción Lifetime
  netflix: { '1 Month': 1.5, '3 Months': 3.5, '6 Months': 6.0, '12 Months': 11.0, 'Lifetime': 18.0 },

  // Ajustados tomando como guía las capturas (valores diferenciados y sin Lifetime)
  spotify: { '1 Month': 2.2, '3 Months': 3.8, '6 Months': 6.2, '12 Months': 12.5 },
  youtube: { '1 Month': 1.6, '3 Months': 3.2, '6 Months': 5.5, '12 Months': 10.5 },
  disney:  { '1 Month': 1.1, '3 Months': 2.7, '6 Months': 4.8, '12 Months': 9.5 },
  prime:   { '1 Month': 1.8, '3 Months': 3.4, '6 Months': 5.8, '12 Months': 11.2 },
  hbomax:  { '1 Month': 1.4, '3 Months': 3.1, '6 Months': 4.7, '12 Months': 9.8 },
  nordvpn: { '1 Month': 0.85, '3 Months': 2.0, '6 Months': 3.6, '12 Months': 6.9 },
  crunchy: { '1 Month': 0.9, '3 Months': 2.1, '6 Months': 3.8, '12 Months': 7.2 },
  // Discord Nitro: solo las variantes de la captura
  nitro:   { 'Boost 1m': 4.79, 'Boost 1 Year': 15.97, 'Basic 1m': 1.35 },
  chatgpt: { '1 Month': 3.2, '3 Months': 7.8, '6 Months': 12.5, '12 Months': 24.0 },
  capcut:  { '1 Month': 1.2, '3 Months': 2.5, '6 Months': 4.2, '12 Months': 8.0 },
  geoguessr: { '1 Month': 2.0, '3 Months': 5.0, '12 Months': 10.0 },
};

const toneToGradient = (tone) => {
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
};

(async function renderProducts(){
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  // Fetch stock data
  try {
    const res = await fetch(`${API_BASE}/api/get-stock`);
    if (res.ok) {
      const data = await res.json();
      stockData = data.stock || {};
    }
  } catch (err) {
    console.error('Failed to fetch stock:', err);
  }

  const getMinPrice = (pid) => {
    const plans = subscriptions[pid];
    if (!plans) return null;
    const vals = Object.values(plans).map(Number).filter(v => Number.isFinite(v));
    if (!vals.length) return null;
    return Math.min(...vals);
  };

  const hasAnyStock = (pid) => {
    const plans = subscriptions[pid];
    if (!plans) return false;
    
    for (const plan of Object.keys(plans)) {
      const key = `${pid}:${plan}`;
      if (stockData[key] && stockData[key] > 0) {
        return true;
      }
    }
    return false;
  };

  grid.innerHTML = products.map(p => {
    const min = getMinPrice(p.id);
    const priceText = min == null ? 'Plans available' : `From $${min.toFixed(2)}`;
    const logoExt = p.id === 'geoguessr' ? 'png' : 'svg';
    const logoFile = p.id === 'geoguessr' ? 'geoguessrlogo.png' : `${p.id}.svg`;
    
    return `
    <article class="product-card" data-pid="${p.id}">
      <div class="product-card__media" style="background:${toneToGradient(p.tone)}">
        <img src="./assets/products/${logoFile}" alt="${p.title} logo" loading="lazy" decoding="async" onerror="this.style.display='none'" />
      </div>
      <div class="product-card__body">
        <h3 class="product-card__title">${p.title}</h3>
        <p class="product-card__price">${priceText}</p>
      </div>
    </article>`;
  }).join('');
})();

// 3) Animación de contadores (simple)
(() => {
  const els = document.querySelectorAll('[data-count]');
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  els.forEach(el => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    let start = null;

    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / 1200);
      const val = ease(p) * target;
      const isInt = el.dataset.integer === 'true' || Number.isInteger(target);
      if (isInt) {
        el.textContent = Math.round(val).toLocaleString() + suffix;
      } else {
        const formatted = (target > 1000)
          ? Math.round(val).toLocaleString()
          : val.toFixed(2).replace(/\.00$/, '');
        el.textContent = formatted + suffix;
      }
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
})();

// 4) Modal de producto
(() => {
  const modal = document.getElementById('product-modal');
  const modalContent = document.getElementById('modal-content');
  const modalTitle = document.getElementById('modal-title');
  if (!modal || !modalContent) return;

  function close() {
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function open(pid) {
    const product = products.find(p => p.id === pid);
    if (!product) return;
    modalTitle.textContent = `${product.title} — Subscriptions`;
    const plans = subscriptions[pid];

    // Products that require Discord purchase
    if (pid === 'youtube-premium' || pid === 'nitro') {
      modalContent.innerHTML = `
        <div class="card" style="margin:10px; padding:20px; text-align:center;">
          <h3 style="margin-bottom:15px;">🎮 Purchase via Discord</h3>
          <p style="margin-bottom:20px;">To purchase this product, please visit our Discord server where our team will assist you.</p>
          <a href="https://discord.gg/VCMbpaqX" target="_blank" class="btn btn--primary" style="display:inline-block; text-decoration:none;">Join Discord Server</a>
        </div>
      `;
    } else if (!plans) {
      modalContent.innerHTML = `
        <div class="card" style="margin:10px">We're adding subscription options for this product. Check back soon.</div>
      `;
    } else {
      modalContent.innerHTML = Object.entries(plans).map(([label, price]) => {
        const stockKey = `${pid}:${label}`;
        const stockCount = stockData[stockKey] || 0;
        const available = stockCount > 0;
        const stockBadge = available
          ? '<span class="stock-badge stock-badge--in">In Stock</span>'
          : '<span class="stock-badge stock-badge--out">Out of Stock</span>';
        const logoFile = product.id === 'geoguessr' ? 'geoguessrlogo.png' : `${product.id}.svg`;
        
        return `
        <div class="variant${!available ? ' variant--disabled' : ''}" data-pid="${product.id}" data-plan="${label}" data-price="${price}">
          <div class="variant__thumb" style="background:${toneToGradient(product.tone)}">
            <img src="./assets/products/${logoFile}" alt="${product.title} logo" loading="lazy" decoding="async" onerror="this.style.display='none'" />
          </div>
          <div>
            <h4 class="variant__title">${product.title} — ${label}</h4>
            <div class="variant__meta">Instant delivery · ${stockBadge}</div>
          </div>
          <div class="variant__actions">
            <div class="variant__price">$${price}</div>
            <button class="btn btn--ghost btn--sm js-add-cart" aria-label="Add to cart" ${!available ? 'disabled' : ''}>Add to cart</button>
            <button class="btn btn--primary btn--sm js-buy-now" aria-label="Buy now" ${!available ? 'disabled' : ''}>Buy now</button>
          </div>
        </div>
      `}).join('');
    }

    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  // Delegación de clicks en grid
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.product-card');
    if (card && card.dataset.pid) {
      open(card.dataset.pid);
    }
    if (e.target.matches('[data-close]')) {
      close();
    }
    // add to cart
    const addBtn = e.target.closest('.js-add-cart');
    if (addBtn && !addBtn.disabled) {
      const row = addBtn.closest('.variant');
      if (row) {
        const pid = row.dataset.pid; const plan = row.dataset.plan; const price = parseFloat(row.dataset.price);
        addToCart({ pid, plan, price });
        addBtn.textContent = 'Added';
        setTimeout(() => (addBtn.textContent = 'Add to cart'), 1200);
      }
    }
    const buyBtn = e.target.closest('.js-buy-now');
    if (buyBtn && !buyBtn.disabled) {
      const row = buyBtn.closest('.variant');
      if (row) {
        const pid = row.dataset.pid; const plan = row.dataset.plan; const price = parseFloat(row.dataset.price);
        addToCart({ pid, plan, price });
        window.location.href = 'cart.html';
      }
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();

// 5) Cart (localStorage)
const CART_KEY = 'plugmarket_cart';
function getCart(){
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
}
function setCart(items){
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  renderCartCount();
}
function addToCart({ pid, plan, price }){
  const product = products.find(p => p.id === pid);
  if (!product) return;
  const items = getCart();
  const key = pid + '|' + plan;
  const idx = items.findIndex(i => i.key === key);
  if (idx >= 0) { items[idx].qty += 1; }
  else { items.push({ key, pid, title: product.title, tone: product.tone, plan, price, qty: 1 }); }
  setCart(items);
}
function cartCount(){ return getCart().reduce((a,b)=>a+b.qty,0); }
function renderCartCount(){
  const el = document.getElementById('cart-count');
  if (el) el.textContent = String(cartCount());
}
renderCartCount();
