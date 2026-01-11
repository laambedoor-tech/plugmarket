// Dashboard functionality
const API_BASE = 'https://plugmarket-api.laambedoor.workers.dev';

// Check authentication on page load
const auth = requireAuth();

if (auth) {
  loadDashboardData(auth);
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
      displayDashboardStats(data);
      displayLatestOrders(data.orders || []);
    } else if (response.status === 401) {
      // Token expired or invalid
      logout();
    } else {
      console.error('Failed to load orders');
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
        <a href="./orders.html" class="btn-view">View</a>
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
