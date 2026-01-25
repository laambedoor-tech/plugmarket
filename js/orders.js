// Orders page - View order history and credentials
const API_BASE = 'https://plugmarket.es';
const STORAGE_KEY = 'plugmarket_orders_email';

let currentEmail = null;

// Helper to format money
function money(cents) {
  return '€' + (cents / 100).toFixed(2);
}

// Helper to format date
function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Fetch orders from API
async function fetchOrders(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const res = await fetch(`${API_BASE}/api/get-orders?email=${encodeURIComponent(normalizedEmail)}`);
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to fetch orders' }));
    throw new Error(error.error || 'Failed to fetch orders');
  }
  
  const data = await res.json();
  return data.orders || data; // Soportar ambos formatos: { orders: [...] } o [...]
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
  list.innerHTML = orders.map(order => {
    // Parse cart_items if it's a string
    let items = [];
    try {
      items = typeof order.cart_items === 'string' ? JSON.parse(order.cart_items) : (order.cart_items || order.items || []);
    } catch (e) {
      console.error('Error parsing cart_items:', e);
      items = order.items || [];
    }
    
    return `
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
            ${items.length} item(s)
          </div>
        </div>
      </div>

      <div class="order-items">
        ${items.map((item, idx) => `
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
              ${item.pid === 'realmembers' ? `
                <div style="margin-bottom: 0.75rem;">
                  <label style="font-size: 0.875rem; color: var(--accent); display: block; margin-bottom: 0.5rem; font-weight: 600;">
                    📋 Instructions
                  </label>
                  <div style="background: rgba(46, 213, 115, 0.1); padding: 1rem; border-radius: 4px; border-left: 3px solid #2ed573;">
                    <div style="font-size: 0.95rem; color: #d7d9e0; line-height: 1.6;">
                      <strong style="color: #2ed573;">✅ How to claim your members:</strong><br>
                      Open a ticket on Discord to claim your members. Our team will process your order and deliver the members to your server.
                    </div>
                  </div>
                </div>
                <div style="text-align: center; margin-top: 1rem;">
                  <a href="https://discord.gg/plugmarket" target="_blank" style="
                    display: inline-block;
                    padding: 0.75rem 1.5rem;
                    background: linear-gradient(135deg, #2ed573, #26c65e);
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: 600;
                    transition: transform 0.2s;
                  " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    🎫 Open Ticket on Discord
                  </a>
                </div>
              ` : item.pid === 'chatgpt' ? `
                <div style="margin-bottom: 0.75rem;">
                  <label style="font-size: 0.875rem; color: var(--accent); display: block; margin-bottom: 0.5rem; font-weight: 600;">
                    📋 Instrucciones
                  </label>
                  <div style="background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 4px; margin-bottom: 0.75rem; border-left: 3px solid var(--accent);">
                    <div style="margin-bottom: 0.5rem;">
                      <strong style="color: var(--accent);">Domain Access:</strong> outlook/hotmail
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                      <strong>Extra Info:</strong> Si la cuenta no tiene "Plus Plan", por favor inicia sesión en la cuenta y luego usa el código chatgpt (lo encontrarás en la entrega)
                    </div>
                  </div>
                </div>
                
                <div style="margin-bottom: 0.75rem;">
                  <label style="font-size: 0.875rem; color: var(--accent); display: block; margin-bottom: 0.5rem; font-weight: 600;">
                    📦 Deliverables
                  </label>
                </div>

                <div style="margin-bottom: 0.5rem;">
                  <label style="font-size: 0.875rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">
                    HOTMAIL (mail)
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
                
                <div style="margin-bottom: 0.5rem;">
                  <label style="font-size: 0.875rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">
                    HOTMAIL (pw)
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

                ${item.credentials.chatgptPassword ? `
                  <div style="margin-bottom: 0.5rem;">
                    <label style="font-size: 0.875rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">
                      CHATGPT (pw)
                    </label>
                    <code style="
                      display: block;
                      padding: 0.5rem;
                      background: rgba(255,255,255,0.05);
                      border-radius: 4px;
                      font-size: 0.9rem;
                      user-select: all;
                    ">${item.credentials.chatgptPassword}</code>
                  </div>
                ` : ''}

                ${item.credentials.chatgptCode ? `
                  <div style="margin-bottom: 0.5rem;">
                    <label style="font-size: 0.875rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">
                      CHATGPT (Code)
                    </label>
                    <code style="
                      display: block;
                      padding: 0.5rem;
                      background: rgba(255,255,255,0.05);
                      border-radius: 4px;
                      font-size: 0.9rem;
                      user-select: all;
                    ">${item.credentials.chatgptCode}</code>
                  </div>
                ` : ''}
              ` : (item.pid === 'netflix' && item.plan === 'FA') ? `
                <!-- Netflix Full Access Instructions -->
                <details style="margin-bottom: 1rem;">
                  <summary style="cursor: pointer; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 6px; font-weight: 600; color: var(--accent); user-select: none;">
                    ▶ Product usage instructions
                  </summary>
                  <div style="padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 6px; margin-top: 0.5rem;">
                    <div style="margin-bottom: 1rem;">
                      <strong style="color: #fff; font-size: 0.95rem;">Mobile:</strong>
                      <ul style="margin: 0.5rem 0 0 1.25rem; padding: 0; color: #d7d9e0; font-size: 0.9rem;">
                        <li>Use exclusively through the official Netflix mobile app.</li>
                      </ul>
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                      <strong style="color: #fff; font-size: 0.95rem;">PC / Browser:</strong>
                      <ul style="margin: 0.5rem 0 0 1.25rem; padding: 0; color: #d7d9e0; font-size: 0.9rem;">
                        <li>Access via cookies only when using a web browser.</li>
                        <li>Username and password are supported <strong style="color: #fff;">only in the official app</strong>, not in browsers.</li>
                        <li>Browser access may work in some cases but is <strong style="color: #fff;">not guaranteed</strong>.</li>
                      </ul>
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                      <strong style="color: #fff; font-size: 0.95rem;">VPN:</strong>
                      <ul style="margin: 0.5rem 0 0 1.25rem; padding: 0; color: #d7d9e0; font-size: 0.9rem;">
                        <li>Not required.</li>
                        <li>Recommended to connect from the account's region for best stability.</li>
                      </ul>
                    </div>
                    
                    <div>
                      <strong style="color: #fff; font-size: 0.95rem;">Help:</strong>
                      <ul style="margin: 0.5rem 0 0 1.25rem; padding: 0; color: #d7d9e0; font-size: 0.9rem;">
                        <li>If you have any issues, please <a href="https://discord.gg/plugmarket" target="_blank" style="color: #4da3ff; text-decoration: none;">open a ticket in Discord</a></li>
                      </ul>
                    </div>
                  </div>
                </details>

                <details style="margin-bottom: 1rem;">
                  <summary style="cursor: pointer; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 6px; font-weight: 600; color: var(--accent); user-select: none;">
                    ▶ Full Access log in instructions
                  </summary>
                  <div style="padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 6px; margin-top: 0.5rem;">
                    <div style="margin-bottom: 1.5rem;">
                      <strong style="color: #fff; font-size: 0.95rem; display: block; margin-bottom: 0.75rem;">Option A — "Forgot password" (recommended)</strong>
                      <div style="padding-left: 1rem; color: #d7d9e0; font-size: 0.9rem; line-height: 1.7;">
                        <p style="margin: 0.5rem 0;">On the Netflix login screen, select <strong style="color: #fff;">Forgot password?</strong></p>
                        <p style="margin: 0.5rem 0;">Choose <strong style="color: #fff;">Email</strong> and enter the <strong style="color: #fff;">account email</strong> provided.</p>
                        <p style="margin: 0.5rem 0;">Open the inbox by logging into <strong style="color: #fff;">Outlook</strong> with the <strong style="color: #fff;">email and password</strong> provided.</p>
                        <p style="margin: 0.5rem 0;">Use the reset email from Netflix to <strong style="color: #fff;">set a new Netflix password</strong>.</p>
                        <p style="margin: 0.5rem 0;">Log in to Netflix with the <strong style="color: #fff;">new password</strong>.</p>
                      </div>
                    </div>

                    <div>
                      <strong style="color: #fff; font-size: 0.95rem; display: block; margin-bottom: 0.75rem;">Option B — "Sign in with code"</strong>
                      <div style="padding-left: 1rem; color: #d7d9e0; font-size: 0.9rem; line-height: 1.7;">
                        <p style="margin: 0.5rem 0;">On the Netflix login screen, select <strong style="color: #fff;">Sign in with a code</strong>.</p>
                        <p style="margin: 0.5rem 0;">Netflix will send a code to the account email.</p>
                        <p style="margin: 0.5rem 0;">Open the inbox by logging into <strong style="color: #fff;">Outlook</strong> with the <strong style="color: #fff;">email and password</strong> provided and retrieve the code.</p>
                        <p style="margin: 0.5rem 0;">Log in using the code.</p>
                        <p style="margin: 0.5rem 0;">Go to <strong style="color: #fff;">Account Settings → Change password</strong> and set a new Netflix password.</p>
                      </div>
                    </div>
                  </div>
                </details>

                <div style="margin-bottom: 0.75rem;">
                  <label style="font-size: 0.875rem; color: var(--accent); display: block; margin-bottom: 0.5rem; font-weight: 600;">
                    📦 Deliverables
                  </label>
                </div>

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
              ` : `
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
              `}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  }).join('');
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
  el.style.background = isError ? 'rgba(255,68,68,0.1)' : 'rgba(76,175,80,0.1)';
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
    setMessage('Loading orders...');
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

    const rawEmail = document.getElementById('login-email').value.trim();
    const email = rawEmail.toLowerCase();
    
    if (!email) {
      setMessage('Please enter your email', true);
      return;
    }

    setMessage('Loading orders...');

    try {
      const data = await fetchOrders(email);
      setMessage('');
      showOrders(email, data);
    } catch (err) {
      setMessage(err.message, true);
    }
  });

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    showLogin();
  });
});
