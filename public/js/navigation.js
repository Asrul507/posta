import { state } from './state.js';
import { api } from './api.js';
import { loadAdminDashboardData, initAdminView } from './views/admin.js';
import { initReports } from './views/reports.js';
import { checkAndRestoreShift } from './views/shifts.js';

// Peta nama singkat (dipakai tombol di sidebar.html / modals.html) -> id view utama di index.html
const VIEW_MAP = {
  POS: 'view-pos',
  PRODUCTS: 'view-products',
  HISTORY: 'view-po',
  PO_HISTORY: 'view-po',
  DAILY_REPORT: 'view-reports',
  MONTHLY_REPORT: 'view-reports',
  ADMIN: 'view-admin'
};

export function navigateTo(viewId) {
  // Sembunyikan semua view utama
  const views = ['view-pos', 'view-products', 'view-po', 'view-reports', 'view-admin'];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  // Tampilkan view tujuan
  const target = document.getElementById(viewId.startsWith('view-') ? viewId : `view-${viewId}`);
  if (target) {
    target.classList.remove('hidden');
  }

  // Update active style di sidebar (jika ada elemen .nav-item dengan data-target)
  document.querySelectorAll('.nav-item').forEach(btn => {
    const btnTarget = btn.getAttribute('data-target');
    if (btnTarget === viewId || `view-${btnTarget}` === viewId) {
      btn.classList.add('bg-blue-50', 'text-blue-600', 'font-semibold');
      btn.classList.remove('text-gray-600', 'hover:bg-gray-50');
    } else {
      btn.classList.remove('bg-blue-50', 'text-blue-600', 'font-semibold');
      btn.classList.add('text-gray-600', 'hover:bg-gray-50');
    }
  });

  // Inisialisasi data per view
  if (viewId === 'view-admin' || viewId === 'admin') {
    initAdminView();
  } else if (viewId === 'view-reports' || viewId === 'reports') {
    initReports();
  } else if (viewId === 'view-pos' || viewId === 'pos') {
    checkAndRestoreShift();
  }
}

// Dipakai oleh tombol-tombol di sidebar.html / modals.html (mis. window.switchView('POS'))
export function switchView(name) {
  const key = (name || '').toUpperCase();
  const outer = VIEW_MAP[key] || (name && name.startsWith('view-') ? name : `view-${(name || '').toLowerCase()}`);
  navigateTo(outer);

  if (key === 'HISTORY' || key === 'PO_HISTORY') {
    const innerHistory = document.getElementById('view-history');
    const innerPO = document.getElementById('view-po-history');
    if (key === 'HISTORY') {
      innerHistory?.classList.remove('hidden');
      innerPO?.classList.add('hidden');
      window.fetchTransactions?.();
    } else {
      innerPO?.classList.remove('hidden');
      innerHistory?.classList.add('hidden');
      window.fetchPOHistory?.();
    }
    return;
  }

  if (key === 'PRODUCTS') {
    window.loadMasterProducts?.();
    return;
  }

  if (key === 'DAILY_REPORT') {
    window.postaReports?.switchReportTab('daily');
  } else if (key === 'MONTHLY_REPORT') {
    window.postaReports?.switchReportTab('monthly');
  }
}

// Buka / tutup drawer sidebar mobile (header.html & sidebar.html)
export function toggleSidebar(show) {
  const drawer = document.getElementById('sidebar-drawer');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!drawer) return;

  const willShow = show === undefined ? drawer.classList.contains('-translate-x-full') : !!show;
  if (willShow) {
    drawer.classList.remove('-translate-x-full');
    backdrop?.classList.remove('hidden');
  } else {
    drawer.classList.add('-translate-x-full');
    backdrop?.classList.add('hidden');
  }
}

// Buka / tutup drawer keranjang mobile (modals.html)
export function toggleMobileCartDrawer(show) {
  const drawer = document.getElementById('mobile-cart-drawer');
  if (!drawer) return;
  const willShow = show === undefined ? drawer.classList.contains('hidden') : !!show;
  drawer.classList.toggle('hidden', !willShow);
}

// Modal kelola user sederhana (dipanggil dari tombol "Kelola User" di dashboard admin)
export async function openUserManagementModal() {
  const name = prompt('Nama lengkap user baru:');
  if (!name) return;
  const username = prompt('Username login:');
  if (!username) return;
  const password = prompt('Password awal:');
  if (!password) return;
  const role = (prompt('Role (ADMIN/OWNER/CASHIER):', 'CASHIER') || 'CASHIER').toUpperCase();

  try {
    const res = await api('/api/admin/users', 'POST', {
      name,
      username,
      password,
      role,
      tenant_id: state.tenantId
    });
    if (res && res.success) {
      alert(res.message || 'User berhasil ditambahkan');
    } else {
      alert(res?.error || 'Gagal menambahkan user');
    }
  } catch (err) {
    console.error('Gagal menambah user:', err);
    alert('Terjadi kesalahan jaringan.');
  }
}

export function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    if (!btn.dataset.bound) {
      btn.dataset.bound = 'true';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.getAttribute('data-target');
        if (target) navigateTo(target);
      });
    }
  });
}

window.postaNav = {
  navigateTo,
  switchView,
  initNavigation,
  toggleSidebar,
  toggleMobileCartDrawer,
  openUserManagementModal
};

window.switchView = switchView;
window.toggleSidebar = toggleSidebar;
window.toggleMobileCartDrawer = toggleMobileCartDrawer;
