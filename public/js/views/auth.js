import { state } from '../state.js';
import { api } from '../api.js';

export function checkAuth() {
  const savedToken = localStorage.getItem('posta_token');
  const savedUser = localStorage.getItem('posta_user');

  if (savedToken && savedUser) {
    try {
      state.token = savedToken;
      state.user = JSON.parse(savedUser);
      hideLoginModal();
      return true;
    } catch (e) {
      logout();
      return false;
    }
  } else {
    // Jangan kunci layar jika di domain superadmin / posta pusat
    const isSuperDomain = window.location.hostname === 'posta.gpro.my.id' || window.location.hostname === 'localhost';
    if (!isSuperDomain) {
      showLoginModal();
    }
    return false;
  }
}

export function showLoginModal() {
  const loginModal = document.getElementById('login-modal') || document.querySelector('.login-backdrop') || document.getElementById('login-root');
  if (loginModal) {
    loginModal.classList.remove('hidden');
    loginModal.style.pointerEvents = 'auto';
  }
}

export function hideLoginModal() {
  const loginModal = document.getElementById('login-modal') || document.querySelector('.login-backdrop') || document.getElementById('login-root');
  if (loginModal) {
    loginModal.classList.add('hidden');
    loginModal.style.pointerEvents = 'none';
  }
}

export async function handleLoginSubmit(event) {
  if (event) event.preventDefault();
  
  const usernameInput = document.getElementById('login-username') || document.querySelector('input[name="username"]');
  const passwordInput = document.getElementById('login-password') || document.querySelector('input[name="password"]');
  const errorEl = document.getElementById('login-error');

  const username = usernameInput?.value.trim();
  const password = passwordInput?.value.trim();

  if (!username || !password) {
    if (errorEl) {
      errorEl.textContent = 'Username dan password wajib diisi!';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  try {
    const res = await api('/api/auth/login', 'POST', { username, password });
    if (res.success && res.token) {
      state.token = res.token;
      state.user = res.user;

      localStorage.setItem('posta_token', res.token);
      localStorage.setItem('posta_user', JSON.stringify(res.user));

      hideLoginModal();
      if (errorEl) errorEl.classList.add('hidden');

      if (window.initNavigation) window.initNavigation();
      if (window.updateNavVisibility) window.updateNavVisibility();
    } else {
      if (errorEl) {
        errorEl.textContent = res.error || 'Login gagal, periksa username/password.';
        errorEl.classList.remove('hidden');
      }
    }
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = 'Gagal menghubungi server.';
      errorEl.classList.remove('hidden');
    }
  }
}

export function logout() {
  localStorage.removeItem('posta_token');
  localStorage.removeItem('posta_user');
  state.token = null;
  state.user = null;
  window.location.reload();
}

window.handleLoginSubmit = handleLoginSubmit;
window.postaLogout = logout;
window.postaAuth = { checkAuth, showLoginModal, hideLoginModal, logout };
