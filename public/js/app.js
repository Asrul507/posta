import { state } from './state.js';
import { api } from './api.js';
import { initAdminView } from './views/admin.js';
import { initPOSView } from './views/pos.js';

// =========================================================================
// MODAL CONTROLLER
// =========================================================================
window.openModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
  }
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
  }
};

// =========================================================================
// SIDEBAR DRAWER CONTROLLER
// =========================================================================
window.toggleSidebar = function(forceState) {
  const sidebar = document.getElementById('sidebar-drawer');
  if (!sidebar) return;

  if (typeof forceState === 'boolean') {
    sidebar.classList.toggle('active', forceState);
  } else {
    sidebar.classList.toggle('active');
  }
};

// =========================================================================
// NAVIGASI SPA
// =========================================================================
window.navigateTo = function(viewName) {
  document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.classList.remove('hidden');
  }

  window.toggleSidebar(false);

  if (viewName === 'admin') initAdminView();
  else if (viewName === 'pos') initPOSView();
  else if (viewName === 'products' && window.loadAdminProducts) window.loadAdminProducts();
};

// =========================================================================
// INIT UTAMA
// =========================================================================
async function initApp() {
  console.log('Posta POS App Initializing...');

  // Event listener tombol navigasi
  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-view]');
    if (navBtn) {
      e.preventDefault();
      const target = navBtn.getAttribute('data-view');
      if (target) window.navigateTo(target);
    }
  });

  // Tentukan view default
  const isSuperDomain = window.location.hostname === 'posta.gpro.my.id' || window.location.hostname === 'localhost';
  if (isSuperDomain) {
    window.navigateTo('admin');
  } else {
    window.navigateTo('pos');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
