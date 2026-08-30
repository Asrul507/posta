import { state } from './state.js';
import { initAdminView } from './views/admin.js';

// =========================================================================
// NAVIGASI ANTAR VIEW / HALAMAN
// =========================================================================
export function navigateTo(viewName) {
  // 1. Sembunyikan semua kontainer view
  const views = document.querySelectorAll('.app-view');
  views.forEach(v => v.classList.add('hidden'));

  // 2. Nonaktifkan semua status aktif tombol navigasi
  const navBtns = document.querySelectorAll('.nav-item, .sidebar-link, [data-view]');
  navBtns.forEach(btn => btn.classList.remove('active'));

  // 3. Tampilkan view target
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.remove('hidden');
  }

  // 4. Beri class active pada tombol menu yang sesuai
  const activeBtns = document.querySelectorAll(`[data-view="${viewName}"]`);
  activeBtns.forEach(btn => btn.classList.add('active'));

  state.currentView = viewName;

  // 5. Jalankan inisialisasi modul view terkait
  if (viewName === 'admin' && typeof initAdminView === 'function') {
    initAdminView();
  } else if (viewName === 'pos' && typeof window.initPOSView === 'function') {
    window.initPOSView();
  } else if (viewName === 'history' && typeof window.initHistoryView === 'function') {
    window.initHistoryView();
  } else if (viewName === 'reports' && typeof window.initReportsView === 'function') {
    window.initReportsView();
  } else if (viewName === 'products' && typeof window.loadAdminProducts === 'function') {
    window.loadAdminProducts();
  }
}

// =========================================================================
// KONTROL VISIBILITAS MENU BERDASARKAN ROLE & SUBDOMAIN
// =========================================================================
export function updateNavVisibility() {
  const isSuperAdmin = state.user?.role === 'SUPERADMIN' || window.location.hostname.includes('posta.gpro.my.id') || window.location.hostname === 'localhost';
  const role = state.user?.role || 'KASIR';

  // Menu Admin / Owner
  const adminNav = document.querySelectorAll('.nav-admin-only, [data-role="admin"]');
  adminNav.forEach(el => {
    el.style.display = (isSuperAdmin || role === 'OWNER' || role === 'ADMIN') ? '' : 'none';
  });

  // Menu Superadmin / Developer Pusat
  const superAdminNav = document.querySelectorAll('.nav-superadmin-only, [data-role="superadmin"]');
  superAdminNav.forEach(el => {
    el.style.display = isSuperAdmin ? '' : 'none';
  });
}

// =========================================================================
// INISIALISASI NAVIGASI & EVENT LISTENER (DIPANGGIL OLEH APP.JS)
// =========================================================================
export function initNavigation() {
  console.log('Inisialisasi Navigasi App...');

  // Daftarkan event listener untuk semua tombol/link yang punya attribute data-view
  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-view]');
    if (navBtn) {
      e.preventDefault();
      const targetView = navBtn.getAttribute('data-view');
      if (targetView) {
        navigateTo(targetView);
      }
    }
  });

  // Perbarui visibilitas menu sesuai login role
  updateNavVisibility();

  // Buka view default jika ada sesi login
  const defaultView = (state.user?.role === 'SUPERADMIN') ? 'admin' : (state.currentView || 'pos');
  navigateTo(defaultView);
}

// Global window bindings
window.navigateTo = navigateTo;
window.updateNavVisibility = updateNavVisibility;
window.initNavigation = initNavigation;
