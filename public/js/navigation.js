import { state } from './state.js';
import { initAdminView } from './views/admin.js';
import { initPOSView } from './views/pos.js';

export function navigateTo(viewName) {
  console.log('Navigasi ke:', viewName);

  // 1. Sembunyikan semua kontainer view
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

  // 3. Update status menu aktif di header & sidebar
  document.querySelectorAll('.nav-item, .sidebar-link, [data-view]').forEach(btn => {
    btn.classList.remove('active', 'bg-blue-50', 'text-blue-600', 'font-bold');
  });
  document.querySelectorAll(`[data-view="${viewName}"]`).forEach(btn => {
    btn.classList.add('active', 'bg-blue-50', 'text-blue-600', 'font-bold');
  });

  // 4. Tutup sidebar jika dalam mode mobile
  if (window.toggleSidebar) {
    window.toggleSidebar(false);
  }

  state.currentView = viewName;

  // 5. Jalankan inisialisasi modul terkait
  if (viewName === 'admin' && typeof initAdminView === 'function') {
    initAdminView();
  } else if (viewName === 'pos' && typeof initPOSView === 'function') {
    initPOSView();
  } else if (viewName === 'history' && typeof window.initHistoryView === 'function') {
    window.initHistoryView();
  } else if (viewName === 'reports' && typeof window.initReportsView === 'function') {
    window.initReportsView();
  } else if (viewName === 'products' && typeof window.loadAdminProducts === 'function') {
    window.loadAdminProducts();
  }
}

export function updateNavVisibility() {
  const isSuperDomain = window.location.hostname === 'posta.gpro.my.id' || window.location.hostname === 'localhost';
  const role = state.user?.role || 'KASIR';

  const posNavs = document.querySelectorAll('[data-view="pos"]');
  posNavs.forEach(el => {
    el.style.display = isSuperDomain ? 'none' : '';
  });

  const adminNavs = document.querySelectorAll('[data-view="admin"], .nav-admin-only');
  adminNavs.forEach(el => {
    el.style.display = (isSuperDomain || role === 'SUPERADMIN' || role === 'OWNER' || role === 'ADMIN') ? '' : 'none';
  });
}

export function initNavigation() {
  console.log('Inisialisasi Navigasi Posta...');

  // Event listener untuk tombol navigasi
  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-view]');
    if (navBtn) {
      e.preventDefault();
      const target = navBtn.getAttribute('data-view');
      if (target) navigateTo(target);
    }
  });

  updateNavVisibility();

  // BUKA DASHBOARD DEVELOPER DI POSTA PUSAT, ATAU KASIR POS DI TOKO
  const isSuperDomain = window.location.hostname === 'posta.gpro.my.id' || window.location.hostname === 'localhost';
  if (isSuperDomain || state.user?.role === 'SUPERADMIN') {
    navigateTo('admin');
  } else {
    navigateTo('pos');
  }
}

window.navigateTo = navigateTo;
window.updateNavVisibility = updateNavVisibility;
window.initNavigation = initNavigation;
