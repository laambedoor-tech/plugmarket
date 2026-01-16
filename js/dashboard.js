// Dashboard functionality
// API_BASE is defined in auth.js

// Check authentication on page load
const auth = requireAuth();

let allOrders = []; // Store orders globally

// Balance management
let selectedAmount = 0;
let stripe, cardElement;

// Make switchPanel globally accessible
window.switchPanel = switchPanel;
window.toggleOrderDetails = toggleOrderDetails;
window.copyToClipboard = copyToClipboard;

if (auth) {
  loadDashboardData(auth);
  // Initialize balance after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeBalance());
  } else {
    initializeBalance();
  }
}

// Switch between panels
function switchPanel(panelName) {
  // Update sidebar active state
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.panel === panelName) {
      link.classList.add('active');
    }
  });
  
  // Hide all panels
  document.querySelectorAll('.panel').forEach(panel => {
    panel.classList.remove('active');
  });
  
  // Show selected panel
  const panel = document.getElementById(`${panelName}-panel`);
  if (panel) {
    panel.classList.add('active');
    
    // Load orders if switching to orders panel
    if (panelName === 'orders') {
      displayAllOrders(allOrders);
    }
  }
}

async function loadDashboardData(auth) {
  // Display user email
  document.getElementById('user-email').textContent = auth.email;
  document.getElementById('sidebar-email').textContent = auth.email;
  
  try {
    // Fetch user orders
    const response = await fetch(`${API_BASE}/api/get-user-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`
      },
      body: JSON.stringify({ email: auth.email })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('📦 Dashboard data:', data);
      allOrders = data.orders || []; // Store globally
      displayDashboardStats(data);
      displayLatestOrders(allOrders);
    } else if (response.status === 401) {
      // Token expired or invalid
      logout();
    } else {
      console.error('Failed to load orders', response.status);
    }
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
}

function displayDashboardStats(data) {
  const orders = data.orders || [];
  // Count all orders as completed since they only exist if payment succeeded
  const completedOrders = orders.length;
  const totalSpent = orders.reduce((sum, o) => sum + (parseFloat(o.total_cents / 100) || 0), 0);
  
  document.getElementById('completed-orders').textContent = completedOrders;
  document.getElementById('total-spent').textContent = `€${totalSpent.toFixed(2)}`;
  
  if (data.customer_since) {
    const date = new Date(data.customer_since);
    const formattedDate = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: '2-digit', 
      year: 'numeric' 
    });
    document.getElementById('customer-since').textContent = formattedDate;
  } else if (orders.length > 0) {
    // Use first order date
    const firstOrder = orders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
    const date = new Date(firstOrder.created_at);
    const formattedDate = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: '2-digit', 
      year: 'numeric' 
    });
    document.getElementById('customer-since').textContent = formattedDate;
  }
}

function displayLatestOrders(orders) {
  const container = document.getElementById('orders-container');
  
  if (!orders || orders.length === 0) {
    // Keep the empty state that's already in the HTML
    return;
  }
  
  // Show ALL orders
  let ordersHTML = '';
  orders.forEach(order => {
    const detailsId = `details-${order.id}`;
    const items = order.items || [];
    
    let credentialsHTML = '';
    items.forEach((item, index) => {
      // Debug: Check all possible product identifier fields
      const productId = item.pid || item.product_id || item.productId || item.name || '';
      console.log('Dashboard item:', item, 'productId:', productId);
      
      // Special handling for Discord Real Server Members
      if (productId === 'realmembers' || productId.includes('realmembers')) {
        credentialsHTML += `
          <div style="background: rgba(46, 213, 115, 0.1); padding: 1rem; border-radius: 8px; border-left: 3px solid #2ed573; margin-bottom: 1rem;">
            <div style="font-size: 0.95rem; color: #d7d9e0; line-height: 1.6;">
              <strong style="color: #2ed573;">✅ How to claim your members:</strong><br>
              Open a ticket on Discord to claim your members. Our team will process your order and deliver the members to your server.
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
              ">
                🎫 Open Ticket on Discord
              </a>
            </div>
          </div>
        `;
      } else {
        const credentials = item.credentials || {};
        Object.entries(credentials).forEach(([key, value]) => {
          const safeValue = String(value).replace(/'/g, "\\\\'").replace(/"/g, '&quot;');
          credentialsHTML += `
            <div class="credential-item">
              <div class="credential-info">
                <div class="credential-label">${key}</div>
                <div class="credential-value">${value}</div>
              </div>
              <button class="btn-copy" onclick="copyToClipboard('${safeValue}', this)">Copy</button>
            </div>
          `;
        });
      }
    });
    
    if (!credentialsHTML) {
      credentialsHTML = '<p style="color: #6b7280; font-size: 14px;">No credentials available for this order</p>';
    }
    
    ordersHTML += `
      <tr>
        <td>
          <div class="order-id">#${order.id ? order.id.slice(0, 8) : 'N/A'}</div>
          <div class="order-product">${getProductNames(order.items)}</div>
        </td>
        <td>${formatDate(order.created_at)}</td>
        <td>
          <span class="status-badge ${'status-completed'}">
            <span>●</span>
            <span>${order.status ? capitalizeFirst(order.status) : 'Completed'}</span>
          </span>
        </td>
        <td>€${parseFloat(order.total_cents / 100 || 0).toFixed(2)}</td>
        <td>
          <button class="btn-view" onclick="toggleOrderDetails('${detailsId}', this)">View</button>
        </td>
      </tr>
      <tr class="order-details-row" id="${detailsId}">
        <td colspan="5">
          <div class="order-details-content">
            <h3 style="color: #fff; font-size: 16px; margin-bottom: 16px;">Order #${order.id.slice(0, 16)}</h3>
            <div class="credentials-section">
              ${credentialsHTML}
            </div>
          </div>
        </td>
      </tr>
    `;
  });
  
  container.innerHTML = `
    <table class="orders-table">
      <thead>
        <tr>
          <th>Order</th>
          <th>Date</th>
          <th>Status</th>
          <th>Total</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${ordersHTML}
      </tbody>
    </table>
  `;
}

function getProductNames(items) {
  if (!items || !Array.isArray(items)) return 'Products';
  
  try {
    const products = items.map(item => item.pid || item.name || 'Product');
    if (products.length === 0) return 'Products';
    if (products.length === 1) return products[0];
    return `${products[0]} & ${products.length - 1} more`;
  } catch (e) {
    return 'Products';
  }
}

function displayAllOrders(orders) {
  const container = document.getElementById('all-orders-container');
  
  if (!orders || orders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <h3 class="empty-title">No orders yet</h3>
        <p class="empty-text">You haven't made any purchases yet. Browse our products and make your first order!</p>
        <a href="./index.html#products" class="btn-action">
          <span>Shop now</span>
          <span>→</span>
        </a>
      </div>
    `;
    return;
  }
  
  let ordersHTML = '';
  orders.forEach(order => {
    const detailsId = `details-all-${order.id}`;
    const items = order.items || [];
    
    let credentialsHTML = '';
    items.forEach((item, index) => {
      // Special handling for Discord Real Server Members
      if (item.pid === 'realmembers') {
        credentialsHTML += `
          <div style="background: rgba(46, 213, 115, 0.1); padding: 1rem; border-radius: 8px; border-left: 3px solid #2ed573; margin-bottom: 1rem;">
            <div style="font-size: 0.95rem; color: #d7d9e0; line-height: 1.6;">
              <strong style="color: #2ed573;">✅ How to claim your members:</strong><br>
              Open a ticket on Discord to claim your members. Our team will process your order and deliver the members to your server.
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
              ">
                🎫 Open Ticket on Discord
              </a>
            </div>
          </div>
        `;
      } else {
        const credentials = item.credentials || {};
        Object.entries(credentials).forEach(([key, value]) => {
          const safeValue = String(value).replace(/'/g, "\\\\'").replace(/"/g, '&quot;');
          credentialsHTML += `
            <div class="credential-item">
              <div class="credential-info">
                <div class="credential-label">${key}</div>
                <div class="credential-value">${value}</div>
              </div>
              <button class="btn-copy" onclick="copyToClipboard('${safeValue}', this)">Copy</button>
            </div>
          `;
        });
      }
    });
    
    if (!credentialsHTML) {
      credentialsHTML = '<p style="color: #6b7280; font-size: 14px;">No credentials available for this order</p>';
    }
    
    ordersHTML += `
      <tr>
        <td>
          <div class="order-id">#${order.id ? order.id.slice(0, 8) : 'N/A'}</div>
          <div class="order-product">${getProductNames(order.items)}</div>
        </td>
        <td>${formatDate(order.created_at)}</td>
        <td>
          <span class="status-badge ${'status-completed'}">
            <span>●</span>
            <span>${order.status ? capitalizeFirst(order.status) : 'Completed'}</span>
          </span>
        </td>
        <td>€${parseFloat(order.total_cents / 100 || 0).toFixed(2)}</td>
        <td>
          <button class="btn-view" onclick="toggleOrderDetails('${detailsId}', this)">View</button>
        </td>
      </tr>
      <tr class="order-details-row" id="${detailsId}">
        <td colspan="5">
          <div class="order-details-content">
            <h3 style="color: #fff; font-size: 16px; margin-bottom: 16px;">Order #${order.id.slice(0, 16)}</h3>
            <div class="credentials-section">
              ${credentialsHTML}
            </div>
          </div>
        </td>
      </tr>
    `;
  });
  
  container.innerHTML = `
    <table class="orders-table">
      <thead>
        <tr>
          <th>Order</th>
          <th>Date</th>
          <th>Status</th>
          <th>Total</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${ordersHTML}
      </tbody>
    </table>
  `;
}

function toggleOrderDetails(detailsId, button) {
  const detailsRow = document.getElementById(detailsId);
  if (!detailsRow) return;
  
  const isActive = detailsRow.classList.contains('active');
  
  // Close all other details
  document.querySelectorAll('.order-details-row').forEach(row => {
    row.classList.remove('active');
  });
  document.querySelectorAll('.btn-view').forEach(btn => {
    btn.classList.remove('active');
    btn.textContent = 'View';
  });
  
  // Toggle current details
  if (!isActive) {
    detailsRow.classList.add('active');
    button.classList.add('active');
    button.textContent = 'Hide';
  }
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: '2-digit', 
    year: 'numeric' 
  });
}

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function deleteAccount() {
  if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
    return;
  }
  
  if (!confirm('This will permanently delete all your data. Are you absolutely sure?')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`
      },
      body: JSON.stringify({ email: auth.email })
    });
    
    if (response.ok) {
      alert('Account deleted successfully.');
      logout();
    } else {
      const data = await response.json();
      alert(data.error || 'Failed to delete account. Please contact support.');
    }
  } catch (error) {
    console.error('Error deleting account:', error);
    alert('Network error. Please try again later.');
  }
}

function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    button.style.background = 'rgba(45, 213, 115, 0.2)';
    button.style.borderColor = 'rgba(45, 213, 115, 0.5)';
    button.style.color = '#2dd573';
    
    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = '';
      button.style.borderColor = '';
      button.style.color = '';
    }, 2000);
  }).catch(err => {
    alert('Failed to copy');
  });
}

// Balance Functions
const USD_TO_EUR_RATE = 0.92; // Exchange rate USD to EUR

async function initializeBalance() {
  await loadBalance();
  await loadTransactions();
  setupBalanceUI();
}

function formatBalanceDisplay(balanceUSD) {
  const balanceNum = parseFloat(balanceUSD || 0);
  const usd = balanceNum.toFixed(2);
  const eur = (balanceNum * USD_TO_EUR_RATE).toFixed(2);
  return `$${usd} / €${eur}`;
}

async function loadBalance() {
  console.log('Loading balance...');
  try {
    const response = await fetch(`${API_BASE}/api/get-balance`, {
      headers: {
        'Authorization': `Bearer ${auth.token}`
      }
    });
    
    console.log('Balance response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Balance data:', data);
      const balanceEl = document.getElementById('current-balance');
      console.log('Balance element:', balanceEl);
      if (balanceEl) {
        const balanceText = formatBalanceDisplay(data.balance);
        balanceEl.textContent = balanceText;
        console.log('Balance set to:', balanceText);
      } else {
        console.error('current-balance element not found');
      }
    } else {
      const errorText = await response.text();
      console.error('Balance fetch failed:', errorText);
    }
  } catch (error) {
    console.error('Error loading balance:', error);
  }
}

async function loadTransactions() {
  try {
    const response = await fetch(`${API_BASE}/api/get-balance-transactions`, {
      headers: {
        'Authorization': `Bearer ${auth.token}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      displayTransactions(data.transactions || []);
    }
  } catch (error) {
    console.error('Error loading transactions:', error);
  }
}

function displayTransactions(transactions) {
  const listEl = document.getElementById('transactions-list');
  if (!listEl) return;
  
  if (transactions.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No transactions yet</div>';
    return;
  }
  
  listEl.innerHTML = transactions.map(tx => {
    const isPositive = tx.type === 'topup' || tx.type === 'refund';
    const amountClass = isPositive ? 'positive' : 'negative';
    const amountSign = isPositive ? '+' : '-';
    
    const date = new Date(tx.created_at);
    const dateStr = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `
      <div class="transaction-item">
        <div class="transaction-info">
          <div class="transaction-type">${formatTransactionType(tx.type)}</div>
          <div class="transaction-desc">${tx.description || 'N/A'} • ${dateStr}</div>
        </div>
        <div class="transaction-amount ${amountClass}">
          ${amountSign}$${parseFloat(tx.amount).toFixed(2)}
        </div>
      </div>
    `;
  }).join('');
}

function formatTransactionType(type) {
  const types = {
    'topup': 'Balance Top-up',
    'purchase': 'Purchase',
    'refund': 'Refund'
  };
  return types[type] || type;
}

function setupBalanceUI() {
  const addFundsBtn = document.getElementById('add-funds-btn');
  const modal = document.getElementById('topup-modal');
  const closeBtn = document.getElementById('close-topup-modal');
  const amountOptions = document.querySelectorAll('.amount-option');
  const customAmountInput = document.getElementById('custom-amount');
  const submitBtnCard = document.getElementById('submit-topup-card');
  const submitBtnCrypto = document.getElementById('submit-topup-crypto');
  
  if (!addFundsBtn || !modal) {
    console.error('Required elements not found');
    return;
  }
  
  // Payment method tabs
  const paymentTabs = document.querySelectorAll('.payment-tab');
  const cardForm = document.getElementById('card-payment-form');
  const cryptoForm = document.getElementById('crypto-payment-form');
  
  paymentTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const method = tab.dataset.method;
      
      // Update tab styles
      paymentTabs.forEach(t => {
        t.classList.remove('active');
        t.style.background = 'rgba(255, 255, 255, 0.03)';
        t.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        t.style.color = '#9aa0ad';
      });
      tab.classList.add('active');
      tab.style.background = 'rgba(255, 39, 67, 0.1)';
      tab.style.borderColor = '#ff2743';
      tab.style.color = '#ff2743';
      
      // Show/hide forms
      if (method === 'card') {
        cardForm.style.display = 'block';
        cryptoForm.style.display = 'none';
      } else {
        cardForm.style.display = 'none';
        cryptoForm.style.display = 'block';
      }
    });
  });
  
  // Open modal
  addFundsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Opening modal...');
    modal.style.display = 'flex';
    modal.classList.add('active');
    
    // Ensure modal content is visible
    const modalContent = modal.querySelector('.modal');
    if (modalContent) {
      modalContent.style.display = 'block';
      modalContent.style.position = 'relative';
      modalContent.style.zIndex = '10001';
      console.log('Modal content found and styled');
    } else {
      console.error('Modal content (.modal) not found');
    }
    
    setTimeout(() => initializeStripe(), 100);
  });
  
  // Close modal
  closeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    modal.style.display = 'none';
    modal.classList.remove('active');
    resetTopupForm();
  });
  
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
      resetTopupForm();
    }
  });
  
  // Amount selection
  amountOptions.forEach(option => {
    option.addEventListener('click', () => {
      amountOptions.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      selectedAmount = parseFloat(option.dataset.amount);
      customAmountInput.value = '';
      if (submitBtnCard) submitBtnCard.disabled = false;
      if (submitBtnCrypto) submitBtnCrypto.disabled = false;
      updateSubmitButtons();
    });
  });
  
  // Custom amount input
  customAmountInput?.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    if (value >= 5 && value <= 500) {
      amountOptions.forEach(opt => opt.classList.remove('selected'));
      selectedAmount = value;
      if (submitBtnCard) submitBtnCard.disabled = false;
      if (submitBtnCrypto) submitBtnCrypto.disabled = false;
      updateSubmitButtons();
    } else {
      selectedAmount = 0;
      if (submitBtnCard) submitBtnCard.disabled = true;
      if (submitBtnCrypto) submitBtnCrypto.disabled = true;
    }
  });
  
  // Submit card top-up
  submitBtnCard?.addEventListener('click', handleTopupSubmitCard);
  
  // Submit crypto top-up
  submitBtnCrypto?.addEventListener('click', handleTopupSubmitCrypto);
}

async function initializeStripe() {
  if (stripe) return;
  
  try {
    // Get Stripe publishable key
    const configResponse = await fetch(`${API_BASE}/api/get-stripe-config`);
    const config = await configResponse.json();
    
    stripe = Stripe(config.publishableKey);
    const elements = stripe.elements();
    
    cardElement = elements.create('card', {
      style: {
        base: {
          color: '#fff',
          fontSize: '16px',
          '::placeholder': {
            color: '#9aa0ad'
          }
        },
        invalid: {
          color: '#ff2743'
        }
      }
    });
    
    cardElement.mount('#card-element');
    
    cardElement.on('change', (event) => {
      const errorEl = document.getElementById('card-errors');
      if (event.error) {
        errorEl.textContent = event.error.message;
      } else {
        errorEl.textContent = '';
      }
    });
  } catch (error) {
    console.error('Error initializing Stripe:', error);
  }
}

async function handleTopupSubmitCard() {
  if (!selectedAmount || selectedAmount < 5) {
    alert('Please select or enter an amount of at least $5');
    return;
  }
  
  const submitBtn = document.getElementById('submit-topup-card');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Processing...';
  
  try {
    // Create payment intent
    const response = await fetch(`${API_BASE}/api/create-topup-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`
      },
      body: JSON.stringify({ amount: selectedAmount })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create payment intent');
    }
    
    const { clientSecret } = await response.json();
    
    // Confirm payment
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement
      }
    });
    
    if (error) {
      throw new Error(error.message);
    }
    
    if (paymentIntent.status === 'succeeded') {
      alert('Funds added successfully!');
      document.getElementById('topup-modal').classList.remove('active');
      document.getElementById('topup-modal').style.display = 'none';
      resetTopupForm();
      await loadBalance();
      await loadTransactions();
    }
  } catch (error) {
    console.error('Error processing topup:', error);
    alert(error.message || 'Failed to process payment');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Funds';
  }
}

async function handleTopupSubmitCrypto() {
  if (!selectedAmount || selectedAmount < 5) {
    alert('Please select or enter an amount of at least $5');
    return;
  }
  
  const submitBtn = document.getElementById('submit-topup-crypto');
  const currency = document.getElementById('crypto-currency').value;
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating payment...';
  
  try {
    const response = await fetch(`${API_BASE}/api/crypto-create-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`
      },
      body: JSON.stringify({ 
        amount: selectedAmount,
        currency: currency,
        type: 'topup'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create crypto payment');
    }
    
    const data = await response.json();
    
    // Close topup modal
    document.getElementById('topup-modal').classList.remove('active');
    document.getElementById('topup-modal').style.display = 'none';
    resetTopupForm();
    
    // Show crypto payment modal (reuse from cart.js logic)
    showCryptoPaymentModal(data);
    
  } catch (error) {
    console.error('Error creating crypto payment:', error);
    alert(error.message || 'Failed to create crypto payment');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Generate Crypto Payment';
  }
}

function showCryptoPaymentModal(paymentData) {
  // Create modal dynamically
  const modalHTML = `
    <div class="modal-overlay active" id="crypto-payment-modal" style="z-index: 10002;">
      <div class="modal" style="max-width: 600px;">
        <div class="modal-header">
          <h3 class="modal-title">Crypto Payment</h3>
          <button class="modal-close" onclick="closeCryptoPaymentModal()">×</button>
        </div>
        <div class="modal-body">
          <div style="text-align: center; margin-bottom: 24px;">
            <p style="color: #9aa0ad; margin-bottom: 16px;">Send exactly this amount to complete your payment:</p>
            <div style="background: rgba(255, 255, 255, 0.05); border: 2px solid rgba(255, 39, 67, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
              <div style="font-size: 28px; font-weight: 700; color: #ff2743; margin-bottom: 8px;">
                ${paymentData.cryptoAmount} ${paymentData.currency}
              </div>
              <div style="font-size: 14px; color: #9aa0ad;">
                ≈ $${paymentData.usdAmount}
              </div>
            </div>
          </div>
          
          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
            <div style="margin-bottom: 16px;">
              <label style="display: block; color: #9aa0ad; font-size: 12px; margin-bottom: 8px; text-transform: uppercase;">Wallet Address</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" value="${paymentData.address}" readonly style="flex: 1; padding: 12px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; color: #fff; font-size: 13px; font-family: monospace;">
                <button onclick="copyToClipboard('${paymentData.address}', this)" class="btn btn--ghost" style="padding: 12px 20px;">Copy</button>
              </div>
            </div>
            
            <div style="text-align: center;">
              <div style="background: white; padding: 16px; border-radius: 12px; display: inline-block; margin-bottom: 12px;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${paymentData.address}" alt="QR Code" style="display: block; width: 200px; height: 200px;">
              </div>
              <p style="color: #9aa0ad; font-size: 13px;">Scan QR code with your wallet app</p>
            </div>
          </div>
          
          <div style="background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 16px;">
            <p style="color: #ffa500; font-size: 13px; margin: 0;">
              ⚠️ Payment ID: <strong>${paymentData.paymentId}</strong><br>
              Your balance will be credited automatically once the transaction is confirmed on the blockchain.
            </p>
          </div>
          
          <button onclick="checkCryptoPaymentStatus('${paymentData.paymentId}')" class="btn btn--primary" style="width: 100%;">
            Check Payment Status
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Remove existing modal if any
  const existingModal = document.getElementById('crypto-payment-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.closeCryptoPaymentModal = function() {
  const modal = document.getElementById('crypto-payment-modal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  }
};

window.checkCryptoPaymentStatus = async function(paymentId) {
  try {
    const response = await fetch(`${API_BASE}/api/crypto-now-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ paymentId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to check payment status');
    }
    
    const data = await response.json();
    
    if (data.status === 'completed' || data.status === 'confirmed') {
      alert('Payment received! Your balance has been updated.');
      closeCryptoPaymentModal();
      await loadBalance();
      await loadTransactions();
    } else if (data.status === 'pending' || data.status === 'waiting') {
      alert('Payment is pending. Please wait for blockchain confirmation.');
    } else {
      alert(`Payment status: ${data.status}`);
    }
  } catch (error) {
    console.error('Error checking payment status:', error);
    alert('Failed to check payment status. Please try again.');
  }
};

function updateSubmitButtons() {
  const submitBtnCard = document.getElementById('submit-topup-card');
  const submitBtnCrypto = document.getElementById('submit-topup-crypto');
  
  if (submitBtnCard && selectedAmount > 0) {
    submitBtnCard.textContent = `Add $${selectedAmount.toFixed(2)}`;
  }
  if (submitBtnCrypto && selectedAmount > 0) {
    submitBtnCrypto.textContent = `Generate Payment - $${selectedAmount.toFixed(2)}`;
  }
}

function resetTopupForm() {
  const modal = document.getElementById('topup-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
  selectedAmount = 0;
  document.querySelectorAll('.amount-option').forEach(opt => opt.classList.remove('selected'));
  const customInput = document.getElementById('custom-amount');
  if (customInput) customInput.value = '';
  
  const submitBtnCard = document.getElementById('submit-topup-card');
  if (submitBtnCard) {
    submitBtnCard.textContent = 'Add Funds';
    submitBtnCard.disabled = true;
  }
  
  const submitBtnCrypto = document.getElementById('submit-topup-crypto');
  if (submitBtnCrypto) {
    submitBtnCrypto.textContent = 'Generate Crypto Payment';
    submitBtnCrypto.disabled = true;
  }
  
  if (cardElement) {
    cardElement.clear();
  }
}
