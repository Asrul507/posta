import { state } from './state.js';
import { api } from './api.js';
import { loadComponents } from './loader.js';
import { checkAuth } from './views/auth.js';
import { initNavigation, navigateTo } from './navigation.js';

// =========================================================================
// MODAL CONTROLLER GLOBAL (ANTI-FREEZE)
// =========================================================================
window.openModal = function(modalId) {
  let modal = document.getElementById(modalId);
  if (!modal && modalId === 'modal-tenant') modal = document.getElementById('modal-create-tenant');
  if (!modal && modalId === 'modal-user') modal = document.getElementById('modal-create-user');

  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.pointerEvents = 'auto';

    const container = modal.closest('#modals-container') || document.getElementById('modals-container');
    if (container) container.style.pointerEvents = 'auto';
  } else {
    console.warn('Modal tidak ditemukan:', modalId);
  }
};

window.closeModal = function(modalId) {
  let modal = document.getElementById(modalId);
  if (!modal && modalId === 'modal-tenant') modal = document.getElementById('modal-create-tenant');
  if (!modal && modalId === 'modal-user') modal = document.getElementById('modal-create-user');

  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
    modal.style.pointerEvents = 'none';

    const activeModals = document.querySelectorAll('.modal-backdrop:not(.hidden)');
    if (activeModals.length === 0) {
      const container = document.getElementById('modals-container');
      if (container) container.style.pointerEvents = 'none';
    }
  }
};

window.toggleSidebar = function(forceState) {
  const sidebar = document.querySelector('.sidebar, .app-sidebar, aside') || document.getElementById('sidebar-container');
  if (!sidebar) return;

  if (typeof forceState === 'boolean') {
    sidebar.classList.toggle('active', forceState);
  } else {
    sidebar.classList.toggle('active');
  }
};

// =========================================================================
// INISIALISASI APLIKASI
// =========================================================================
async function initApp() {
  console.log('Posta POS App Initializing...');

  // 1. Muat seluruh partial HTML
  await loadComponents();

  // 2. Ambil data tenant
  try {
    const tenantInfo = await api('/api/tenant/info', 'GET');
    if (tenantInfo && tenantInfo.data) {
      state.tenant = tenantInfo.data;
    }
  } catch (err) {
    console.warn('Gagal memuat tenant info:', err);
  }

  // 3. Cek login
  checkAuth();

  // 4. Inisialisasi navigasi SPA
  initNavigation();

  // 5. Daftarkan event global
  setupGlobalEvents();
}

function setupGlobalEvents() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('.header-menu-btn, .btn-menu-toggle, [onclick*="toggleSidebar"]')) {
      e.preventDefault();
      window.toggleSidebar();
    }
  });

  const shiftBtn = document.getElementById('btn-shift-status') || document.querySelector('.btn-shift');
  if (shiftBtn) {
    shiftBtn.onclick = () => window.openModal('modal-shift');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
