import { state } from './state.js';
import { loadAdminDashboardData, initAdminView } from './views/admin.js';
import { initReports } from './views/reports.js';
import { checkAndRestoreShift } from './views/shifts.js';

export function navigateTo(viewId) {
  // Sembunyikan semua view
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

  // Update active style di sidebar
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
  initNavigation
};
