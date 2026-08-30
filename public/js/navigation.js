import { state } from './state.js';
import { initAdminView } from './views/admin.js';

// =========================================================================
// NAVIGASI VIEW
// =========================================================================
export function navigateTo(viewName) {
  console.log('Navigasi aktif ke:', viewName);

  // 1. Sembunyikan semua view
  const views = document.querySelectorAll('.app-view, [id^="view-"]');
  views.forEach(v => {
    v.classList.add('hidden');
    v.style.display = 'none';
  });

  // 2. Tampilkan view yang dipilih
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.remove('hidden');
    targetView.style.display = 'block';
  }

  // 3. Update highlight tombol navigasi
  document.querySelectorAll('.nav-item, .sidebar-link, [data-view]').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelectorAll(`[data-view="${viewName}"]`).forEach(btn => {
    btn.classList.add('active');
  });

  state.currentView = viewName;

  // 4. Inisialisasi controller view
  if (viewName === 'admin') {
    initAdminView();
  } else if (viewName === 'pos' && window.initPOSView) {
    window.initPOSView();
  } else if (viewName === 'history' && window.initHistoryView) {
    window.initHistoryView();
  } else if (viewName === 'reports' && window.initReportsView) {
    window.initReportsView();
  } else if (viewName === 'products' && window.loadAdminProducts) {
    window.loadAdminProducts();
  }
}

// =========================================================================
// KONTROL VISIBILITAS MENU BERDASARKAN ROLE & DOMAIN
// =========================================================================
export function updateNavVisibility() {
  const isSuperDomain = window.location.hostname === 'posta.gpro.my.id' || window.location.hostname === 'localhost';

  // Sembunyikan tombol POS / Kasir jika sedang di domain pusat
  const posNavs = document.querySelectorAll('[data-view="pos"]');
  posNavs.forEach(el => {
    el.style.display = isSuperDomain ? 'none' : '';
  });

  // Tampilkan menu Admin
  const adminNavs = document.querySelectorAll('[data-view="admin"], .nav-admin-only');
  adminNavs.forEach(el => {
    el.style.display = '';
  });
}

// =========================================================================
// INISIALISASI NAVIGASI
// =========================================================================
export function initNavigation() {
  console.log('Inisialisasi Navigasi App...');

  // Event listener tombol navigasi
  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-view]');
    if (navBtn) {
      e.preventDefault();
      const target = navBtn.getAttribute('data-view');
      if (target) navigateTo(target);
    }
  });

  updateNavVisibility();

  // JIKA DI POSTA.GPRO.MY.ID: BUKA ADMIN (SUPERADMIN DASHBOARD)
  // JIKA DI SUBDOMAIN TOKO LAIN: BUKA POS (KASIR)
  const isSuperDomain = window.location.hostname === 'posta.gpro.my.id' || window.location.hostname === 'localhost';
  if (isSuperDomain) {
    navigateTo('admin');
  } else {
    navigateTo('pos');
  }
}

window.navigateTo = navigateTo;
window.updateNavVisibility = updateNavVisibility;
window.initNavigation = initNavigation;
