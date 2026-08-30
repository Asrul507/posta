import { api } from '../api.js';
import { state } from '../state.js';
import { navigateTo } from '../navigation.js';
import { checkAndRestoreShift, updateHeaderShiftStatus } from './shifts.js';

export function initAuth() {
  const loginForm = document.getElementById('login-form');
  if (loginForm && !loginForm.dataset.bound) {
    loginForm.dataset.bound = 'true';
    loginForm.addEventListener('submit', handleLogin);
  }

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = 'true';
    logoutBtn.addEventListener('click', handleLogout);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('input-username');
  const passwordInput = document.getElementById('input-password');
  const errorMsg = document.getElementById('login-error-msg');

  if (errorMsg) errorMsg.classList.add('hidden');

  try {
    const res = await api('/api/auth/login', 'POST', {
      username: usernameInput.value,
      password: passwordInput.value
    });

    if (res && res.success) {
      state.token = res.token;
      state.user = res.user;

      localStorage.setItem('posta_token', res.token);
      localStorage.setItem('posta_user', JSON.stringify(res.user));

      // Tampilkan UI Aplikasi Utama
      document.getElementById('auth-container')?.classList.add('hidden');
      document.getElementById('main-layout')?.classList.remove('hidden');

      // Update info header user
      const headerUser = document.getElementById('header-user-name');
      if (headerUser) headerUser.textContent = `${res.user.name} (${res.user.role})`;

      // Penyesuaian Routing Berdasarkan Role
      if (res.user.role === 'CASHIER') {
        navigateTo('pos');
        await checkAndRestoreShift();
      } else {
        // ADMIN, OWNER, SUPERADMIN langsung ke Dashboard Admin
        navigateTo('admin');
        updateHeaderShiftStatus(null);
      }
    } else {
      if (errorMsg) {
        errorMsg.textContent = res?.error || 'Login gagal, periksa username & password.';
        errorMsg.classList.remove('hidden');
      }
    }
  } catch (err) {
    console.error('Login error:', err);
    if (errorMsg) {
      errorMsg.textContent = 'Terjadi kesalahan jaringan atau server.';
      errorMsg.classList.remove('hidden');
    }
  }
}

export function handleLogout() {
  state.token = null;
  state.user = null;
  state.activeShift = null;

  localStorage.removeItem('posta_token');
  localStorage.removeItem('posta_user');

  document.getElementById('main-layout')?.classList.add('hidden');
  document.getElementById('auth-container')?.classList.remove('hidden');
}

window.postaAuth = {
  initAuth,
  handleLogout
};
