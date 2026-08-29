import { state, showToast } from '../state.js';

export async function checkAuthSession(tenantInfo) {
  // 1. Cek apakah ada SSO Token dari Superadmin di URL
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
    
    // Validasi tenant
    if (!tenantInfo.is_admin && user.tenant_id !== tenantInfo.id && user.role !== 'SUPERADMIN') {
      logout();
      return false;
    }

    state.currentUser = user;
    applyRolePermissions(user);
    if (loginOverlay) loginOverlay.classList.add('hidden');

    // Otomatis cek apakah kasir punya shift aktif, jika tidak maka modal Buka Shift muncul
    if (user.role !== 'SUPERADMIN' && typeof window.checkActiveShift === 'function') {
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
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const result = await res.json();

    if (result.success) {
      localStorage.setItem('posta_token', result.token);
      localStorage.setItem('posta_user', JSON.stringify(result.user));
      state.currentUser = result.user;

      document.getElementById('login-overlay').classList.add('hidden');
      applyRolePermissions(result.user);
      showToast(`Selamat datang, ${result.user.name}!`);

      if (result.user.role === 'SUPERADMIN') {
        document.getElementById('view-admin-portal').classList.remove('hidden');
        if (typeof window.loadAdminTenants === 'function') window.loadAdminTenants();
      } else {
        if (typeof window.loadProducts === 'function') window.loadProducts();
        
        // Panggil pengecekan shift saat login berhasil
        if (typeof window.checkActiveShift === 'function') {
          window.checkActiveShift();
        }
      }
    } else {
      showToast(result.error || 'Username atau password salah', 'error');
    }
  } catch (err) {
    showToast('Gagal menghubungi server.', 'error');
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
  nameLabels.forEach(el => el.innerText = `${user.name} (${user.role})`);

  // Jika CASHIER: Sembunyikan menu Master Produk, Riwayat & Laporan
  if (user.role === 'CASHIER') {
    const restricted = document.querySelectorAll('.role-admin-only');
    restricted.forEach(el => el.classList.add('hidden'));
  } else {
    const restricted = document.querySelectorAll('.role-admin-only');
    restricted.forEach(el => el.classList.remove('hidden'));
  }
}
