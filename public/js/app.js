import { state } from './state.js';
import { api } from './api.js';
import { loadComponents } from './loader.js';
import { checkAuth } from './views/auth.js';
import { initNavigation } from './navigation.js';

// =========================================================================
// MODAL CONTROLLER GLOBAL
// =========================================================================
window.openModal = function(modalId) {
  let modal = document.getElementById(modalId);
  if (!modal && modalId === 'modal-tenant') modal = document.getElementById('modal-create-tenant');
  if (!modal && modalId === 'modal-user') modal = document.getElementById('modal-create-user');

  if (modal) {
    modal.classList.remove('hidden');
    // Jika modal berada di dalam backdrop container
    const backdrop = modal.closest('.modal-backdrop') || modal;
    backdrop.classList.remove('hidden');
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
    const backdrop = modal.closest('.modal-backdrop') || modal;
    backdrop.classList.add('hidden');
  }
};

// =========================================================================
// SIDEBAR DRAWER CONTROLLER
// =========================================================================
window.toggleSidebar = function(forceState) {
  const sidebar = document.getElementById('sidebar-root');
  if (!sidebar) return;

  if (typeof forceState === 'boolean') {
    sidebar.classList.toggle('active', forceState);
  } else {
    sidebar.classList.toggle('active');
  }
};

// =========================================================================
// INISIALISASI UTAMA APLIKASI
// =========================================================================
async function initApp() {
  console.log('Posta POS App Initializing...');

  // 1. Muat template komponen HTML
  await loadComponents();

  // 2. Ambil informasi toko / tenant
  try {
    const tenantInfo = await api('/api/tenant/info', 'GET');
    if (tenantInfo && tenantInfo.data) {
      state.tenant = tenantInfo.data;
    }
  } catch (err) {
    console.warn('Gagal memuat tenant info:', err);
  }

  // 3. Autentikasi sesi
  checkAuth();

  // 4. Jalankan Navigasi
  initNavigation();

  // 5. Setup tombol global
  setupGlobalEvents();
}

function setupGlobalEvents() {
  // Tombol buka/tutup menu sidebar
  document.addEventListener('click', (e) => {
    if (e.target.closest('.header-menu-btn, .btn-menu-toggle, .sidebar-close-btn, [onclick*="toggleSidebar"]')) {
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
