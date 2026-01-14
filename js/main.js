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

// 1) Partículas en canvas con glow rojo (optimizado rendimiento)
(() => {
  const canvas = document.getElementById('bg-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = matchMedia('(max-width: 768px)').matches;
  // Menor DPR en móvil para reducir coste de fill/blur
  const DPR = prefersReduced ? 1 : (isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  let w, h;

  const particles = [];
  // Reducimos el número de partículas y conexiones en dispositivos modestos
  const COUNT = prefersReduced ? 18 : (isMobile ? 28 : 48);
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
    const d2 = dx * dx + dy * dy;
    const max = 90 * DPR;
    if (d2 < max * max) {
      const alpha = 1 - Math.sqrt(d2) / max;
      ctx.strokeStyle = 'rgba(255,255,255,' + (alpha * 0.08) + ')';
      ctx.lineWidth = 1 * DPR;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  let last = 0;
  const FRAME_MS = prefersReduced ? 1000 / 20 : 1000 / 30; // 20–30fps
  function tick(ts) {
    if (ts && ts - last < FRAME_MS) {
      requestAnimationFrame(tick);
      return;
    }
    last = ts || 0;
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx * DPR * 2;
      p.y += p.vy * DPR * 2;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      ctx.shadowColor = p.color;
      ctx.shadowBlur = prefersReduced ? 4 * DPR : 8 * DPR;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * DPR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Conexiones sutiles pero limitadas: solo vecinos cercanos y muestreo
    if (!prefersReduced) {
      const MAX_NEIGHBORS = isMobile ? 4 : 6;
      for (let i = 0; i < particles.length; i += 2) { // saltar cada 2 para reducir O(n^2)
        const a = particles[i];
        // Buscar solo próximos K índices
        for (let k = 1; k <= MAX_NEIGHBORS && i + k < particles.length; k++) {
          connect(a, particles[i + k]);
        }
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
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname.includes('192.168') || window.location.hostname.includes('.local')
  ? 'http://localhost:8788'
  : 'https://plugmarket.es';

const products = [
  { id: 'netflix', title: 'Netflix', price: '€', tone: 'red' },
  { id: 'spotify', title: 'Spotify Premium', price: '€', tone: 'green' },
  { id: 'youtube-premium', title: 'YouTube Premium', price: '€', tone: 'orange' },
  { id: 'disney', title: 'Disney+ ', price: '€', tone: 'blue' },
  { id: 'prime', title: 'Prime Video', price: '€', tone: 'blue' },
  { id: 'hbomax', title: 'HBO Max', price: '€', tone: 'purple' },
  { id: 'nordvpn', title: 'NordVPN', price: '€', tone: 'cyan' },
  { id: 'realmembers', title: 'Discord Real Server Members [KEYS]', price: '€', tone: 'green' },
  { id: 'nitro', title: 'Discord Nitro', price: '€', tone: 'purple' },
  { id: 'discordpromocode', title: 'Discord Nitro Promo Code', price: '€', tone: 'purple' },
  { id: 'chatgpt', title: 'ChatGPT Plus', price: '€', tone: 'teal' },
  { id: 'chatgpt-pro', title: 'ChatGPT Pro', price: '€', tone: 'teal' },
  { id: 'capcut', title: 'CapCut Pro', price: '€', tone: 'cyan' },
  { id: 'geoguessr', title: 'GeoGuessr', price: '€', tone: 'green' },
  { id: 'filmora', title: 'Wondershare Filmora', price: '€', tone: 'teal' },
  { id: 'duolingo', title: 'Duolingo', price: '€', tone: 'green' },
  { id: 'movistar', title: 'Movistar+ (LaLiga+)', price: '€', tone: 'blue' },
  { id: 'dazn', title: 'DAZN', price: '€1.35', tone: 'orange' },
  { id: 'steamaccount', title: 'Steam Accounts', price: '€0.25', tone: 'blue' },
  { id: 'crunchy', title: 'Crunchyroll', price: '€', tone: 'orange' },
];

let stockData = {};

// Suscripciones por producto (precios según adjuntos, en USD)
const subscriptions = {
  // Solo Netflix tendrá opción Lifetime
  netflix: { '1 Month': 1.35, '3 Months': 3.15, '6 Months': 5.4, '12 Months': 9.9, 'Lifetime': 14.99 },

  // Ajustados tomando como guía las capturas (valores diferenciados y sin Lifetime)
  spotify: { '1 Month': 1.98, '3 Months': 3.42, '6 Months': 5.58, '12 Months': 10.69 },
  'youtube-premium': { '1 Month': 2.52, '3 Months': 3.89, '12 Months': 11.25 },
  disney: { '1 Month': 0.99, '3 Months': 2.43, '6 Months': 4.32, '12 Months': 8.55 },
  prime: { '1 Month': 0.72, '3 Months': 1.98, '6 Months': 3.6, '12 Months': 6.66 },
  hbomax: { '1 Month': 1.08, '3 Months': 2.7, '6 Months': 4.14, '12 Months': 6.75 },
  nordvpn: { '1 Month': 1.62, '3 Months': 3.06, '6 Months': 5.22, '12 Months': 9.58 },
  crunchyroll: { '1 Month': 1.17, '3 Months': 2.97, '6 Months': 5.22, '12 Months': 9.36 },
  // Discord Nitro: solo las variantes de la captura
  nitro: { 'Boost 1m': 4.31, 'Boost 1 Year': 13.65, 'Basic 1m': 1.22 },
  discordpromocode: { '1 Month Nitro': 1.8, '3 Months Nitro': 4.86 },
  chatgpt: { '1 Month': 2.88, '3 Months': 7.02, '6 Months': 10.69, '12 Months': 15.17 },
  'chatgpt-pro': { '1 Month': 35.96 },
  capcut: { '1 Month': 2.61, '3 Months': 6.66, '6 Months': 11.88, '12 Months': 20.88 },
  geoguessr: { '1 Month': 0.9, '3 Months': 2.34, '6 Months': 4.32, '12 Months': 7.92 },
  filmora: { '1 Year': 8.1 },
  duolingo: { '1 Month': 1.8, '3 Months': 4.32, '6 Months': 7.2, '12 Months': 12.42 },
  movistar: { '1 Month': 3.24, '3 Months': 8.1, '6 Months': 14.94, '12 Months': 27.9 },
  dazn: { '1 Month': 2.88, '3 Months': 7.38, '6 Months': 13.5, '12 Months': 25.2 },
  steamaccount: { 'Fresh': 0.72 },
  realmembers: { '[500]': 2.25, '[1000]': 4.25, '[2000]': 7.88, '[3000]': 11.63, '[4000]': 12.24, '[5000]': 15.61 },
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

(async function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  // Fetch stock data
  try {
    console.log('[STOCK] Fetching from:', `${API_BASE}/api/get-stock`);
    console.log('[STOCK] Full URL:', window.location.origin + `${API_BASE}/api/get-stock`);
    const res = await fetch(`${API_BASE}/api/get-stock`);
    console.log('[STOCK] Response status:', res.status);
    console.log('[STOCK] Response headers:', Object.fromEntries(res.headers.entries()));
    
    if (res.ok) {
      const data = await res.json();
      console.log('[STOCK] Raw data received:', data);
      stockData = data.stock || {};
      console.log('[STOCK] Total stock items:', Object.keys(stockData).length);
      console.log('[STOCK] All stock keys:', Object.keys(stockData));
      console.log('[STOCK] Netflix stock:', Object.keys(stockData).filter(k => k.startsWith('netflix:')).map(k => ({ key: k, stock: stockData[k] })));
    } else {
      const errorText = await res.text();
      console.error('[STOCK] API failed with status:', res.status, 'Error:', errorText);
    }
  } catch (err) {
    console.error('[STOCK] Failed to fetch:', err);
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

  grid.innerHTML = products.map((p, index) => {
    const min = getMinPrice(p.id);
    // Si el producto tiene un precio fijo, usarlo en lugar del mínimo calculado
    const priceText = p.price.startsWith('€') && p.price !== '€' ? p.price : (min == null ? 'Plans available' : `From €${min.toFixed(2)}`);
    // Mapeo de IDs a nombres de archivos de imágenes
    const imageMap = {
      'spotify': 'spotify.png',
      'youtube-premium': 'youtube.png',
      'disney': 'disneyplus.png',
      'chatgpt': 'chatgptplus.png',
      'chatgpt-pro': 'chatgptpro.png',
      'capcut': 'capcutpro.png',
      'crunchy': 'crunchyroll.png',
      'geoguessr': 'geoguessr.png',
      'nitro': 'nitroboost.png',
      'duolingo': 'duolingo.png',
      'movistar': 'movistar+.png',
      'steamaccount': 'steamaccounts.png',
      'realmembers': 'realmembers.png'
    };
    const logoFile = imageMap[p.id] || `${p.id}.png`;
    
    // Solo los 3 primeros con prioridad alta; el resto se difiere para mejorar LCP
    const isTopProduct = index < 3;
    const loadingAttr = isTopProduct ? 'eager' : 'lazy';
    const fetchPriorityAttr = isTopProduct ? 'high' : 'low';

    return `
    <article class="product-card" data-pid="${p.id}" data-product-name="${p.title.toLowerCase()}">
      <div class="product-card__media" style="background:${toneToGradient(p.tone)}">
        <img src="./assets/products/${logoFile}"
             alt="${p.title} logo"
             width="400" height="200"
             loading="${loadingAttr}"
             decoding="async"
             fetchpriority="${fetchPriorityAttr}"
             onerror="this.style.display='none'" />
      </div>
      <div class="product-card__body">
        <h3 class="product-card__title">${p.title}</h3>
        <p class="product-card__price">${priceText}</p>
      </div>
    </article>`;
  }).join('');
  
  // Implementar funcionalidad de búsqueda
  const searchInput = document.getElementById('product-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase().trim();
      const cards = document.querySelectorAll('.product-card');
      
      cards.forEach(card => {
        const productName = card.getAttribute('data-product-name');
        if (productName.includes(searchTerm)) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }
  
  // Agregar event listeners para los productos
  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Prevent any default/other handlers from flashing old panels
      e.preventDefault();
      e.stopPropagation();

      const pid = card.dataset.pid;
      const product = products.find(p => p.id === pid);
      
      // Close any open modals/panels immediately
      const modal = document.querySelector('[role="dialog"]');
      if (modal) modal.remove();
      const panels = document.querySelectorAll('.product-panel, .product-details');
      panels.forEach(p => p.remove());
      
      // All products redirect to their dedicated pages
      const pageMap = {
        'netflix': 'product-netflix.html',
        'spotify': 'product-spotify.html',
        'youtube-premium': 'product-youtube-premium.html',
        'disney': 'product-disney.html',
        'prime': 'product-prime.html',
        'hbomax': 'product-hbomax.html',
        'nordvpn': 'product-nordvpn.html',
        'crunchyroll': 'product-crunchyroll.html',
        'nitro': 'product-nitro.html',
        'discordpromocode': 'product-discordpromocode.html',
        'chatgpt': 'product-chatgpt.html',
        'chatgpt-pro': 'product-chatgpt-pro.html',
        'capcut': 'product-capcut.html',
        'geoguessr': 'product-geoguessr.html',
        'filmora': 'product-filmora.html',
        'duolingo': 'product-duolingo.html',
        'movistar': 'product-movistar.html',
        'dazn': 'product-dazn.html',
        'steamaccount': 'product-steamaccount.html',
        'realmembers': 'product-realmembers.html'
      };
      
      if (pageMap[pid]) {
        window.location.href = './' + pageMap[pid];
      }
    });
  });
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
    if (pid === 'nitro') {
      modalContent.innerHTML = `
        <div class="card" style="margin:10px; padding:20px; text-align:center;">
          <h3 style="margin-bottom:15px;">🎮 Purchase via Discord</h3>
          <p style="margin-bottom:20px;">To purchase this product, please visit our Discord server where our team will assist you.</p>
          <a href="https://discord.gg/plugmarket" target="_blank" class="btn btn--primary" style="display:inline-block; text-decoration:none;">Join Discord Server</a>
        </div>
      `;
    } else if (pid === 'discordpromocode') {
      // Discord Promo Code with special notice
      const plans = subscriptions[pid];
      modalContent.innerHTML = `
        <div class="card" style="margin:10px 10px 15px 10px; padding:15px; background:rgba(255,171,64,.15); border:1px solid rgba(255,171,64,.3);">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
            <span style="font-size:20px;">⚠️</span>
            <strong style="color:#ffab40;">Important Notice</strong>
          </div>
          <p style="margin:0; font-size:14px; color:#d7d9e0;">Only for accounts that never had Nitro</p>
        </div>
        ${Object.entries(plans).map(([label, price]) => {
          const stockKey = `${pid}:${label}`;
          const stockCount = stockData[stockKey] || 0;
          const available = stockCount > 0;
          const stockBadge = available
            ? '<span class="stock-badge stock-badge--in">In Stock</span>'
            : '<span class="stock-badge stock-badge--out">Out of Stock</span>';
          const logoFile = 'resized/discordpromocode84.png';

          return `
          <div class="variant${!available ? ' variant--disabled' : ''}" data-pid="${pid}" data-plan="${label}" data-price="${price}">
            <div class="variant__thumb" style="background:${toneToGradient(product.tone)}">
              <img src="./assets/products/${logoFile}"
                   alt="${product.title} logo"
                   width="84" height="84"
                   loading="lazy" decoding="async" fetchpriority="low"
                   onerror="this.style.display='none'" />
            </div>
            <div>
              <h4 class="variant__title">${product.title} — ${label}</h4>
              <div class="variant__meta">Instant delivery · ${stockBadge}</div>
            </div>
            <div class="variant__actions">
              <div class="variant__price">€${price}</div>
              <button class="btn btn--ghost btn--sm js-add-cart" aria-label="Add to cart" ${!available ? 'disabled' : ''}>Add to cart</button>
              <button class="btn btn--primary btn--sm js-buy-now" aria-label="Buy now" ${!available ? 'disabled' : ''}>Buy now</button>
            </div>
          </div>
        `}).join('')}
      `;
    } else if (!plans) {
      modalContent.innerHTML = `
        <div class="card" style="margin:10px">We're adding subscription options for this product. Check back soon.</div>
      `;
    } else {
      // Add description for realmembers
      let descriptionHTML = '';
      if (pid === 'realmembers') {
        descriptionHTML = `
        <div class="card" style="margin:10px 10px 15px 10px; padding:15px; background:rgba(46, 213, 115, 0.1); border:1px solid rgba(46, 213, 115, 0.3);">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
            <span style="font-size:20px;">👥</span>
            <strong style="color:#2ed573;">About Real Server Members</strong>
          </div>
          <p style="margin:0; font-size:14px; color:#d7d9e0; line-height:1.5;">
            Boost your Discord server with real, active members. Increase interaction, visibility, and server activity with authentic users.
          </p>
        </div>
      `;
      }
      
      modalContent.innerHTML = descriptionHTML + Object.entries(plans).map(([label, price]) => {
        const stockKey = `${pid}:${label}`;
        const stockCount = stockData[stockKey] || 0;
        const available = stockCount > 0;
        
        console.log(`Product: ${pid}, Plan: ${label}, Key: ${stockKey}, Stock: ${stockCount}, Available: ${available}`);
        
        const stockBadge = available
          ? '<span class="stock-badge stock-badge--in">In Stock</span>'
          : '<span class="stock-badge stock-badge--out">Out of Stock</span>';
        // Mapeo de IDs a nombres de archivos de imágenes redimensionadas para el modal
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
          'discordpromocode': 'resized/discordpromocode84.png',
          'chatgpt': 'resized/chatgptplus84.png',
          'chatgpt-pro': 'resized/chatgptpro84.png',
          'capcut': 'resized/capcutpro84.png',
          'geoguessr': 'resized/geoguessr84.png',
          'filmora': 'resized/filmora84.png',
          'duolingo': 'resized/duolingo84.png',
          'movistar': 'resized/movistar+84.png',
          'dazn': 'resized/dazn84.png',
          'steamaccount': 'resized/steamaccounts84.png',
          'realmembers': 'resized/realmembers84.png'
        };
        const logoFile = imageMap[product.id] || `${product.id}.png`;

        return `
        <div class="variant${!available ? ' variant--disabled' : ''}" data-pid="${product.id}" data-plan="${label}" data-price="${price}">
          <div class="variant__thumb" style="background:${toneToGradient(product.tone)}">
            <img src="./assets/products/${logoFile}"
                 alt="${product.title} logo"
                 width="84" height="84"
                 loading="lazy" decoding="async" fetchpriority="low"
                 onerror="this.style.display='none'" />
          </div>
          <div>
            <h4 class="variant__title">${pid === 'steamaccount' ? label : product.title + ' — ' + label}${pid === 'steamaccount' && label === 'Random Games' ? ' (Maybe with balance)' : ''}</h4>
            <div class="variant__meta">Instant delivery · ${stockBadge}</div>
          </div>
          <div class="variant__actions">
            <div class="variant__price">€${price}</div>
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
      const pid = card.dataset.pid;
      // Redirigir a página dedicada si es Netflix
      if (pid === 'netflix') {
        window.location.href = './product-netflix.html';
        return;
      }
      // Para otros productos, abrir modal
      open(pid);
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
function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
}
function setCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  renderCartCount();
}
function addToCart({ pid, plan, price }) {
  const product = products.find(p => p.id === pid);
  if (!product) return;
  const items = getCart();
  const key = pid + '|' + plan;
  const idx = items.findIndex(i => i.key === key);
  if (idx >= 0) { items[idx].qty += 1; }
  else { items.push({ key, pid, title: product.title, tone: product.tone, plan, price, qty: 1 }); }
  setCart(items);
}
function cartCount() { return getCart().reduce((a, b) => a + b.qty, 0); }
function renderCartCount() {
  const el = document.getElementById('cart-count');
  if (el) el.textContent = String(cartCount());
}
renderCartCount();
