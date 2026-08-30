import { api } from '../api.js';
import { state } from '../state.js';
import { navigateTo } from '../navigation.js';
import { checkAndRestoreShift, updateHeaderShiftStatus } from './shifts.js';

// Form login di components/login.html tidak memiliki id dan disubmit lewat
// atribut onsubmit="window.submitLogin()", jadi tidak perlu bind addEventListener di sini.
export function initAuth() {
  // no-op: disediakan agar app.js tetap bisa memanggil initAuth() tanpa error.
}

function applyRoleBasedUI(user) {
  const headerUser = document.getElementById('header-user-info');
  if (headerUser) headerUser.textContent = `${user.name} (${user.role})`;

  document.querySelectorAll('.current-user-name').forEach(el => {
    el.textContent = user.name;
  });

  const adminNavs = document.querySelectorAll('.role-admin-only');
  if (user.role === 'CASHIER') {
    adminNavs.forEach(el => el.classList.add('hidden'));
  } else {
    adminNavs.forEach(el => el.classList.remove('hidden'));
  }
}

export async function submitLogin() {
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const btn = document.getElementById('btn-submit-login');

  const username = usernameInput?.value?.trim() || '';
  const password = passwordInput?.value || '';

  if (!username || !password) {
    alert('Username dan password wajib diisi');
    return;
  }

  const originalBtnHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Memproses...</span>';
  }

  try {
    const res = await api('/api/auth/login', 'POST', { username, password });

    if (res && res.success) {
      state.token = res.token;
      state.user = res.user;
      state.tenantId = res.user.tenant_id || null;

      localStorage.setItem('posta_token', res.token);
      localStorage.setItem('posta_user', JSON.stringify(res.user));

      document.getElementById('login-overlay')?.classList.add('hidden');
      document.getElementById('main-layout')?.classList.remove('hidden');

      applyRoleBasedUI(res.user);

      if (res.user.role === 'CASHIER') {
        navigateTo('view-pos');
        await checkAndRestoreShift();
      } else {
        navigateTo('view-admin');
        updateHeaderShiftStatus(null);
      }
    } else {
      alert(res?.error || 'Login gagal, periksa username & password.');
    }
  } catch (err) {
    console.error('Login error:', err);
    alert('Terjadi kesalahan jaringan atau server.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnHtml || '<span>Masuk Sekarang</span> <i class="fa-solid fa-arrow-right"></i>';
    }
  }
}

export function toggleLoginPasswordVisibility() {
  const passwordInput = document.getElementById('login-password');
  const icon = document.getElementById('login-eye-icon');
  if (!passwordInput) return;

  const isHidden = passwordInput.type === 'password';
  passwordInput.type = isHidden ? 'text' : 'password';

  if (icon) {
    icon.classList.toggle('fa-eye', !isHidden);
    icon.classList.toggle('fa-eye-slash', isHidden);
  }
}

export function handleLogout() {
  state.token = null;
  state.user = null;
  state.tenantId = null;
  state.tenantInfo = null;
  state.activeShift = null;
  state.cart = [];

  localStorage.removeItem('posta_token');
  localStorage.removeItem('posta_user');

  document.getElementById('main-layout')?.classList.add('hidden');
  document.getElementById('login-overlay')?.classList.remove('hidden');
}

window.postaAuth = {
  initAuth,
  submitLogin,
  handleLogout,
  logout: handleLogout,
  toggleLoginPasswordVisibility
};

window.submitLogin = submitLogin;
window.toggleLoginPasswordVisibility = toggleLoginPasswordVisibility;
window.logout = handleLogout;
