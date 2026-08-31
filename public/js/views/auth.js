import { state, showToast } from '../state.js';
import { updateHeaderShiftStatus } from './shifts.js';

function isPlatformAdmin(user) {
  return user?.role === 'SUPERADMIN' || user?.role === 'DEVELOPER';
}

export async function checkAuthSession(tenantInfo) {
  const urlParams = new URLSearchParams(window.location.search);
  const ssoToken = urlParams.get('sso_token');

  if (ssoToken) {
    try {
      const parts = ssoToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        localStorage.setItem('posta_token', ssoToken);
        localStorage.setItem('posta_user', JSON.stringify(payload));
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (_) {}
  }

  const token = localStorage.getItem('posta_token');
  const userJson = localStorage.getItem('posta_user');
  const loginOverlay = document.getElementById('login-overlay');

  const domainSpan = document.getElementById('login-current-domain');
  if (domainSpan) domainSpan.innerText = window.location.hostname;

  if (!token || !userJson) {
    if (loginOverlay) loginOverlay.classList.remove('hidden');
    return false;
  }

  try {
    const user = JSON.parse(userJson);
    
    if ((tenantInfo.is_admin && !isPlatformAdmin(user)) ||
        (!tenantInfo.is_admin && user.tenant_id !== tenantInfo.id && !isPlatformAdmin(user))) {
      logout();
      return false;
    }

    state.currentUser = user;
    state.tenantId = tenantInfo.id;
    applyRolePermissions(user);
    updateHeaderShiftStatus();

    if (loginOverlay) loginOverlay.classList.add('hidden');
    const app = document.getElementById('app');
    if (app) app.style.display = 'flex';

    if (!isPlatformAdmin(user) && typeof window.checkActiveShift === 'function') {
      window.checkActiveShift();
    }

    return true;
  } catch (e) {
    logout();
    return false;
  }
}

export async function submitLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!username || !password) {
    showToast('Username dan password wajib diisi!', 'error');
    return;
  }

  const btn = document.getElementById('btn-submit-login');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memvalidasi...';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `initTenantSession` derives this from the host.  On posta.gpro.my.id
      // it is `admin`, which lets the API look up SUPERADMIN accounts.
      body: JSON.stringify({ username, password, tenant_id: state.tenantId })
    });
    const result = await res.json().catch(() => ({}));

    if (result.token && result.user) {
      localStorage.setItem('posta_token', result.token);
      localStorage.setItem('posta_user', JSON.stringify(result.user));
      state.currentUser = result.user;
      state.tenantId = result.user.tenant_id;

      document.getElementById('login-overlay')?.classList.add('hidden');
      const app = document.getElementById('app');
      if (app) app.style.display = 'flex';
      applyRolePermissions(result.user);
      updateHeaderShiftStatus();
      showToast(`Selamat datang, ${result.user.full_name || result.user.username}!`);

      if (isPlatformAdmin(result.user) && state.tenantInfo?.is_admin) {
        document.getElementById('view-admin-portal')?.classList.remove('hidden');
        if (typeof window.loadAdminTenants === 'function') window.loadAdminTenants();
      } else {
        if (typeof window.loadProducts === 'function') window.loadProducts();
        if (typeof window.checkActiveShift === 'function') window.checkActiveShift();
      }
    } else {
      showToast(result.error || 'Username atau password salah', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Gagal menghubungi server.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Masuk Sekarang</span> <i class="fa-solid fa-arrow-right"></i>';
  }
}

export function toggleLoginPasswordVisibility() {
  const pass = document.getElementById('login-password');
  const eye = document.getElementById('login-eye-icon');
  if (pass.type === 'password') {
    pass.type = 'text';
    eye.className = 'fa-solid fa-eye-slash';
  } else {
    pass.type = 'password';
    eye.className = 'fa-solid fa-eye';
  }
}

export function logout() {
  localStorage.removeItem('posta_token');
  localStorage.removeItem('posta_user');
  location.reload();
}

export function applyRolePermissions(user) {
  const nameLabels = document.querySelectorAll('.current-user-name');
  nameLabels.forEach(el => el.innerText = `${user.full_name || user.username} (${user.role})`);

  if (user.role === 'CASHIER') {
    const restricted = document.querySelectorAll('.role-admin-only');
    restricted.forEach(el => el.classList.add('hidden'));
  } else {
    const restricted = document.querySelectorAll('.role-admin-only');
    restricted.forEach(el => el.classList.remove('hidden'));
  }
}

// Kept as a public initializer for compatibility with older deployments.
export function initAuth() {
  const loginOverlay = document.getElementById('login-overlay');
  if (loginOverlay && !localStorage.getItem('posta_token')) loginOverlay.classList.remove('hidden');
}
