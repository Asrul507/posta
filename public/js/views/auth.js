import { state, showToast } from '../state.js';

// Cek Sesi User saat awal buka
export async function checkAuthSession(tenantInfo) {
  const token = localStorage.getItem('posta_token');
  const userJson = localStorage.getItem('posta_user');
  const loginOverlay = document.getElementById('login-overlay');

  const domainSpan = document.getElementById('login-current-domain');
  if (domainSpan) domainSpan.innerText = window.location.hostname;

  // Sesuaikan tema form login sesuai tipe domain
  if (tenantInfo.is_admin) {
    // Superadmin theme
    document.getElementById('login-store-name').innerText = 'Posta Management Hub';
    document.getElementById('login-store-sub').innerText = 'Portal Pengembang & Superadmin';
    const iconWrap = document.getElementById('login-icon-wrapper');
    if (iconWrap) {
      iconWrap.className = 'w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl mx-auto shadow-lg shadow-indigo-900/40';
    }
    const btnSubmit = document.getElementById('btn-submit-login');
    if (btnSubmit) {
      btnSubmit.className = 'w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-2 active:scale-98';
    }
  } else {
    // Toko Kasir theme
    document.getElementById('login-store-name').innerText = tenantInfo.name || 'Posta POS';
    document.getElementById('login-store-sub').innerText = `Kasir Toko - ${tenantInfo.subdomain}.gpro.my.id`;
  }

  // Jika belum login atau token hilang
  if (!token || !userJson) {
    if (loginOverlay) loginOverlay.classList.remove('hidden');
    return false;
  }

  try {
    const user = JSON.parse(userJson);
    
    // Validasi: Superadmin hanya boleh buka di posta.gpro.my.id
    if (tenantInfo.is_admin && user.role !== 'SUPERADMIN') {
      logout();
      return false;
    }

    // Validasi: Kasir toko biasa tidak boleh buka tenant lain
    if (!tenantInfo.is_admin && user.tenant_id !== tenantInfo.id) {
      logout();
      return false;
    }

    state.currentUser = user;
    applyRolePermissions(user);
    if (loginOverlay) loginOverlay.classList.add('hidden');
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

  // Jika CASHIER: Sembunyikan Master Produk, Riwayat Transaksi & PO
  if (user.role === 'CASHIER') {
    const restricted = document.querySelectorAll('.role-admin-only');
    restricted.forEach(el => el.classList.add('hidden'));
  }
}
