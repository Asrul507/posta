import { state } from './state.js';
import { initAdminView } from './views/admin.js';

// =========================================================================
// NAVIGASI ANTAR VIEW
// =========================================================================
export function navigateTo(viewName) {
  console.log('Navigasi ke:', viewName);

  // 1. Sembunyikan semua tampilan view
  const allViews = document.querySelectorAll('.app-view, [id^="view-"]');
  allViews.forEach(v => {
    v.classList.add('hidden');
    v.style.display = 'none';
  });

  // 2. Nonaktifkan status aktif tombol menu
  const navBtns = document.querySelectorAll('.nav-item, .sidebar-link, [data-view]');
  navBtns.forEach(btn => btn.classList.remove('active'));

  // 3. Tampilkan view yang dituju
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.remove('hidden');
    targetView.style.display = 'block';
  }

  // 4. Beri highlight pada menu aktif
  const activeBtns = document.querySelectorAll(`[data-view="${viewName}"]`);
  activeBtns.forEach(btn => btn.classList.add('active'));

  // 5. Tutup sidebar setelah menu diklik
  if (window.toggleSidebar) {
    window.toggleSidebar(false);
  }

  state.currentView = viewName;

  // 6. Jalankan inisialisasi view terkait
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
// KONTROL VISIBILITAS MENU BERDASARKAN ROLE
// =========================================================================
export function updateNavVisibility() {
  const isSuperAdmin = state.user?.role === 'SUPERADMIN' || window.location.hostname.includes('posta.gpro.my.id') || window.location.hostname === 'localhost';
  const role = state.user?.role || 'KASIR';

  const adminNav = document.querySelectorAll('.nav-admin-only, [data-role="admin"]');
  adminNav.forEach(el => {
    el.style.display = (isSuperAdmin || role === 'OWNER' || role === 'ADMIN') ? '' : 'none';
  });

  const superAdminNav = document.querySelectorAll('.nav-superadmin-only, [data-role="superadmin"]');
  superAdminNav.forEach(el => {
    el.style.display = isSuperAdmin ? '' : 'none';
  });
}

// =========================================================================
// INISIALISASI NAVIGASI & EVENT LISTENER
// =========================================================================
export function initNavigation() {
  console.log('Inisialisasi Navigasi App...');

  // Event delegation untuk semua elemen dengan data-view atau onclick navigasi
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

  updateNavVisibility();

  // Buka default view POS
  navigateTo('pos');
}

// Global window bindings
window.navigateTo = navigateTo;
window.updateNavVisibility = updateNavVisibility;
window.initNavigation = initNavigation;
