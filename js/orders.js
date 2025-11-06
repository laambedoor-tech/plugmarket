// Orders page - View order history and credentials
const API_BASE = 'https://plugmarket-api.laambedoor.workers.dev';
const STORAGE_KEY = 'plugmarket_orders_email';

let currentEmail = null;

// Helper to format money
function money(cents) {
  return '$' + (cents / 100).toFixed(2);
}

// Helper to format date
function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Fetch orders from API
async function fetchOrders(email) {
  const res = await fetch(`${API_BASE}/api/get-orders?email=${encodeURIComponent(email)}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to fetch orders' }));
    throw new Error(error.error || 'Failed to fetch orders');
  }
  return res.json();
}

// Show login panel
function showLogin() {
  document.getElementById('login-panel').style.display = 'block';
  document.getElementById('orders-panel').style.display = 'none';
  currentEmail = null;
  sessionStorage.removeItem(STORAGE_KEY);
}

// Show orders panel
function showOrders(email, orders) {
  currentEmail = email;
  sessionStorage.setItem(STORAGE_KEY, email);
  
  document.getElementById('login-panel').style.display = 'none';
  document.getElementById('orders-panel').style.display = 'block';
  document.getElementById('orders-email').textContent = email;

  const list = document.getElementById('orders-list');
  const empty = document.getElementById('orders-empty');

  if (!orders || orders.length === 0) {
    empty.style.display = 'block';
    list.innerHTML = '';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = orders.map(order => `
    <div class="card" style="margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
        <div>
          <h3 style="margin: 0 0 0.5rem 0;">Pedido ${order.id.substring(0, 8)}</h3>
          <p style="color: var(--text-muted); margin: 0;">
            ${formatDate(order.created_at)}
          </p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.25rem; font-weight: 600; color: var(--accent);">
            ${money(order.total_cents)}
          </div>
          <div style="font-size: 0.875rem; color: var(--text-muted);">
            ${order.items.length} item(s)
          </div>
        </div>
      </div>

      <div class="order-items">
        ${order.items.map((item, idx) => `
          <div class="order-item" style="
            padding: 1rem;
            border: 1px solid var(--border);
            border-radius: 8px;
            margin-top: ${idx > 0 ? '1rem' : '0'};
            background: rgba(255,255,255,0.02);
          ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <div>
                <strong style="text-transform: capitalize;">${item.pid.replace(/-/g, ' ')}</strong>
                <span style="color: var(--text-muted); margin-left: 0.5rem;">— ${item.plan}</span>
              </div>
              <div style="color: var(--accent);">
                ${money(item.unitAmount)}
              </div>
            </div>

            <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 6px;">
              <div style="margin-bottom: 0.5rem;">
                <label style="font-size: 0.875rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">
                  Email
                </label>
                <code style="
                  display: block;
                  padding: 0.5rem;
                  background: rgba(255,255,255,0.05);
                  border-radius: 4px;
                  font-size: 0.9rem;
                  user-select: all;
                ">${item.credentials.email}</code>
              </div>
              <div>
                <label style="font-size: 0.875rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">
                  Contraseña
                </label>
                <code style="
                  display: block;
                  padding: 0.5rem;
                  background: rgba(255,255,255,0.05);
                  border-radius: 4px;
                  font-size: 0.9rem;
                  user-select: all;
                ">${item.credentials.password}</code>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// Set message
function setMessage(msg, isError = false) {
  const el = document.getElementById('login-message');
  if (!msg) {
    el.style.display = 'none';
    el.textContent = '';
    return;
  }
  el.textContent = msg;
  el.style.display = 'block';
  el.style.color = isError ? 'var(--error, #ff4444)' : 'var(--success, #4caf50)';
}

// Update cart count (shared across pages)
function updateCartCount() {
  try {
    const cart = JSON.parse(localStorage.getItem('plugmarket_cart')) || [];
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    const el = document.getElementById('cart-count');
    if (el) el.textContent = String(count);
  } catch {}
}

// Initialize
addEventListener('DOMContentLoaded', () => {
  updateCartCount();

  // Check if user was logged in
  const savedEmail = sessionStorage.getItem(STORAGE_KEY);
  if (savedEmail) {
    // Auto-load orders
    setMessage('Cargando pedidos...');
    fetchOrders(savedEmail)
      .then(data => {
        setMessage('');
        showOrders(savedEmail, data.orders);
      })
      .catch(err => {
        setMessage(err.message, true);
        showLogin();
      });
  }

  // Login form
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage('');

    const email = document.getElementById('login-email').value.trim();
    if (!email) {
      setMessage('Ingresa tu email', true);
      return;
    }

    setMessage('Cargando pedidos...');

    try {
      const data = await fetchOrders(email);
      setMessage('');
      showOrders(email, data.orders);
    } catch (err) {
      setMessage(err.message, true);
    }
  });

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    showLogin();
  });
});
