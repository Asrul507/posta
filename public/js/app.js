import { state } from './state.js';
import { api } from './api.js';
import { loadComponents } from './loader.js';
import { checkAuth } from './views/auth.js';
import { initNavigation } from './navigation.js';

// =========================================================================
// MODAL & SIDEBAR CONTROLLER
// =========================================================================
window.openModal = function(modalId) {
  let modal = document.getElementById(modalId);
  if (!modal && modalId === 'modal-tenant') modal = document.getElementById('modal-create-tenant');
  if (!modal && modalId === 'modal-user') modal = document.getElementById('modal-create-user');

  if (modal) {
    modal.classList.remove('hidden');
  } else {
    console.warn('Modal target tidak ditemukan:', modalId);
  }
};

window.closeModal = function(modalId) {
  let modal = document.getElementById(modalId);
  if (!modal && modalId === 'modal-tenant') modal = document.getElementById('modal-create-tenant');
  if (!modal && modalId === 'modal-user') modal = document.getElementById('modal-create-user');

  if (modal) {
    modal.classList.add('hidden');
  }
};

window.toggleSidebar = function(forceState) {
  const sidebar = document.getElementById('sidebar-root') || document.querySelector('.sidebar');
  if (!sidebar) return;

  if (typeof forceState === 'boolean') {
    sidebar.classList.toggle('active', forceState);
  } else {
    sidebar.classList.toggle('active');
  }
};

// =========================================================================
// INISIALISASI UTAMA
// =========================================================================
async function initApp() {
  console.log('Posta POS Initializing...');

  // 1. Muat komponen HTML
  await loadComponents();

  // 2. Ambil informasi toko
  try {
    const tenantInfo = await api('/api/tenant/info', 'GET');
    if (tenantInfo && tenantInfo.data) {
      state.tenant = tenantInfo.data;
    }
  } catch (err) {
    console.warn('Tenant info load:', err);
  }

  // 3. Autentikasi sesi
  checkAuth();

  // 4. Jalankan Navigasi
  initNavigation();

  // 5. Setup tombol
  setupGlobalEvents();
}

function setupGlobalEvents() {
  // Tombol menu sidebar
  document.addEventListener('click', (e) => {
    if (e.target.closest('.header-menu-btn, .btn-menu-toggle, [onclick*="toggleSidebar"]')) {
      e.preventDefault();
      window.toggleSidebar();
    }
  });

  // Tombol Shift
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
