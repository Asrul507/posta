import { state } from './state.js';
import { initAdminView } from './views/admin.js';

export function navigateTo(viewName) {
  // Sembunyikan semua view container
  const views = document.querySelectorAll('.app-view');
  views.forEach(v => v.classList.add('hidden'));

  // Sembunyikan semua tombol aktif di nav
  const navBtns = document.querySelectorAll('.nav-item');
  navBtns.forEach(btn => btn.classList.remove('active'));

  // Tampilkan view yang dipilih
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.remove('hidden');
  }

  // Tandai nav button yang aktif
  const activeBtn = document.querySelector(`[data-view="${viewName}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }

  state.currentView = viewName;

  // Jalankan inisialisasi view terkait
  if (viewName === 'admin') {
    initAdminView();
  } else if (viewName === 'pos' && window.initPOSView) {
    window.initPOSView();
  } else if (viewName === 'history' && window.initHistoryView) {
    window.initHistoryView();
  } else if (viewName === 'reports' && window.initReportsView) {
    window.initReportsView();
  }
}

export function updateNavVisibility() {
  const isSuperAdmin = state.user?.role === 'SUPERADMIN' || window.location.hostname === 'posta.gpro.my.id' || window.location.hostname === 'localhost';
  const role = state.user?.role || 'KASIR';

  // Kontrol akses menu navigasi
  const adminNav = document.querySelectorAll('.nav-admin-only');
  adminNav.forEach(el => {
    el.style.display = (isSuperAdmin || role === 'OWNER' || role === 'ADMIN') ? 'flex' : 'none';
  });

  const superAdminNav = document.querySelectorAll('.nav-superadmin-only');
  superAdminNav.forEach(el => {
    el.style.display = isSuperAdmin ? 'flex' : 'none';
  });
}

window.navigateTo = navigateTo;
window.updateNavVisibility = updateNavVisibility;
