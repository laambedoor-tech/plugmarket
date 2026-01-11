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
    const response = await fetch(`${API_BASE}/get-user-orders`, {
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
  const completedOrders = orders.filter(o => o.status === 'completed').length;
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
          <span class="status-badge ${order.status === 'completed' ? 'status-completed' : 'status-pending'}">
            <span>●</span>
            <span>${capitalizeFirst(order.status || 'pending')}</span>
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
          <span class="status-badge ${order.status === 'completed' ? 'status-completed' : 'status-pending'}">
            <span>●</span>
            <span>${capitalizeFirst(order.status || 'pending')}</span>
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
    const response = await fetch(`${API_BASE}/delete-account`, {
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
async function initializeBalance() {
  await loadBalance();
  await loadTransactions();
  setupBalanceUI();
}

async function loadBalance() {
  console.log('Loading balance...');
  try {
    const response = await fetch(`${API_BASE}/get-balance`, {
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
        const balanceText = `$${parseFloat(data.balance || 0).toFixed(2)}`;
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
    const response = await fetch(`${API_BASE}/get-balance-transactions`, {
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
  const submitBtn = document.getElementById('submit-topup');
  
  if (!addFundsBtn || !modal) {
    console.error('Required elements not found');
    return;
  }
  
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
      submitBtn.disabled = false;
      updateSubmitButton();
    });
  });
  
  // Custom amount input
  customAmountInput?.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    if (value >= 5 && value <= 500) {
      amountOptions.forEach(opt => opt.classList.remove('selected'));
      selectedAmount = value;
      submitBtn.disabled = false;
      updateSubmitButton();
    } else {
      selectedAmount = 0;
      submitBtn.disabled = true;
    }
  });
  
  // Submit top-up
  submitBtn?.addEventListener('click', handleTopupSubmit);
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

async function handleTopupSubmit() {
  if (!selectedAmount || selectedAmount < 5) {
    alert('Please select or enter an amount of at least $5');
    return;
  }
  
  const submitBtn = document.getElementById('submit-topup');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Processing...';
  
  try {
    // Create payment intent
    const response = await fetch(`${API_BASE}/create-topup-intent`, {
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

function updateSubmitButton() {
  const submitBtn = document.getElementById('submit-topup');
  if (submitBtn && selectedAmount > 0) {
    submitBtn.textContent = `Add $${selectedAmount.toFixed(2)}`;
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
  const submitBtn = document.getElementById('submit-topup');
  if (submitBtn) {
    submitBtn.textContent = 'Add Funds';
    submitBtn.disabled = true;
  }
  if (cardElement) {
    cardElement.clear();
  }
}
