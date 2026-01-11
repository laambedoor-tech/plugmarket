// Auth functions for email verification system
const API_BASE = 'https://plugmarket-api.laambedoor.workers.dev';

// Auto-redirect to dashboard if already logged in
if (window.location.pathname.includes('my-account.html')) {
  const token = localStorage.getItem('auth_token');
  const email = localStorage.getItem('auth_email');
  if (token && email) {
    window.location.href = './dashboard.html';
  }
}

// Send verification code to email
async function sendCode(event) {
  event.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const alertEl = document.getElementById('alert-email');
  const btnEl = document.getElementById('btn-send-code');
  
  if (!email) {
    showAlert(alertEl, 'Please enter a valid email address', 'error');
    return;
  }
  
  // Disable button
  btnEl.disabled = true;
  btnEl.innerHTML = '<span>Sending...</span>';
  
  try {
    const response = await fetch(`${API_BASE}/send-verification-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Store email in session
      sessionStorage.setItem('verification_email', email);
      sessionStorage.setItem('code_sent_at', Date.now().toString());
      
      // Show success and switch to code step
      showAlert(alertEl, 'Code sent! Check your email.', 'success');
      
      setTimeout(() => {
        document.getElementById('email-step').classList.add('hidden');
        document.getElementById('code-step').classList.remove('hidden');
        document.getElementById('sent-email').textContent = email;
        startTimer();
      }, 1000);
    } else {
      showAlert(alertEl, data.error || 'Failed to send code. Please try again.', 'error');
    }
  } catch (error) {
    console.error('Error sending code:', error);
    showAlert(alertEl, 'Network error. Please check your connection and try again.', 'error');
  } finally {
    btnEl.disabled = false;
    btnEl.innerHTML = '<span>Send code</span><span>→</span>';
  }
}

// Verify the code entered by user
async function verifyCode(event) {
  event.preventDefault();
  
  const code = document.getElementById('code').value.trim();
  const email = sessionStorage.getItem('verification_email');
  const alertEl = document.getElementById('alert-code');
  const btnEl = document.getElementById('btn-verify-code');
  
  if (!code || code.length !== 6) {
    showAlert(alertEl, 'Please enter a valid 6-digit code', 'error');
    return;
  }
  
  if (!email) {
    showAlert(alertEl, 'Session expired. Please request a new code.', 'error');
    setTimeout(() => goBackToEmail(), 2000);
    return;
  }
  
  // Disable button
  btnEl.disabled = true;
  btnEl.innerHTML = '<span>Verifying...</span>';
  
  try {
    const response = await fetch(`${API_BASE}/verify-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, code })
    });
    
    const data = await response.json();
    
    if (response.ok && data.token) {
      // Store auth token permanently (no expiration)
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_email', email);
      
      // Clear session storage
      sessionStorage.removeItem('verification_email');
      sessionStorage.removeItem('code_sent_at');
      
      showAlert(alertEl, 'Verified! Redirecting...', 'success');
      
      setTimeout(() => {
        window.location.href = './dashboard.html';
      }, 1000);
    } else {
      showAlert(alertEl, data.error || 'Invalid code. Please try again.', 'error');
    }
  } catch (error) {
    console.error('Error verifying code:', error);
    showAlert(alertEl, 'Network error. Please check your connection and try again.', 'error');
  } finally {
    btnEl.disabled = false;
    btnEl.innerHTML = '<span>Verify code</span><span>✓</span>';
  }
}

// Go back to email step
function goBackToEmail() {
  document.getElementById('code-step').classList.add('hidden');
  document.getElementById('email-step').classList.remove('hidden');
  document.getElementById('code').value = '';
  document.getElementById('alert-code').classList.remove('show');
  
  if (timerInterval) {
    clearInterval(timerInterval);
  }
}

// Show alert message
function showAlert(element, message, type) {
  element.textContent = message;
  element.className = `alert alert-${type} show`;
  
  setTimeout(() => {
    element.classList.remove('show');
  }, 5000);
}

// Timer for code expiration
let timerInterval;

function startTimer() {
  let timeLeft = 15 * 60; // 15 minutes in seconds
  const timerEl = document.getElementById('timer');
  
  function updateTimer() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      showAlert(document.getElementById('alert-code'), 'Code expired. Please request a new one.', 'error');
      setTimeout(() => goBackToEmail(), 2000);
    }
    
    timeLeft--;
  }
  
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

// Check if user is already authenticated
function checkAuth() {
  const token = localStorage.getItem('auth_token');
  const email = localStorage.getItem('auth_email');
  
  if (token && email) {
    return { token, email };
  }
  
  return null;
}

// Redirect to login if not authenticated
function requireAuth() {
  const auth = checkAuth();
  
  if (!auth) {
    window.location.href = './my-account.html';
    return null;
  }
  
  return auth;
}

// Logout function
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_email');
    sessionStorage.clear();
    window.location.href = './my-account.html';
  }
}

// Auto-format code input (numbers only)
if (document.getElementById('code')) {
  document.getElementById('code').addEventListener('input', function(e) {
    this.value = this.value.replace(/[^0-9]/g, '').slice(0, 6);
  });
}

// Check if already logged in when on login page
if (window.location.pathname.includes('my-account.html')) {
  const auth = checkAuth();
  if (auth) {
    window.location.href = './dashboard.html';
  }
}
