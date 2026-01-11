// Dashboard functionality
// API_BASE is defined in auth.js

// Check authentication on page load
const auth = requireAuth();

let allOrders = []; // Store orders globally

if (auth) {
  loadDashboardData(auth);
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
  const ordersHTML = orders.map(order => `
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
        <button class="btn-view" onclick="switchPanel('orders')">View</button>
      </td>
    </tr>
  `).join('');
  
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
  
  const ordersHTML = orders.map(order => `
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
        <button class="btn-view" onclick="alert('Order details: ' + '${order.id}')">View</button>
      </td>
    </tr>
  `).join('');
  
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
