import { state } from './state.js';
import { api } from './api.js';
import { loadComponents } from './loader.js';
import { checkAuth } from './views/auth.js';
import { initNavigation } from './navigation.js';

// =========================================================================
// MODAL CONTROLLER
// =========================================================================
window.openModal = function(modalId) {
  let modal = document.getElementById(modalId);
  if (!modal && modalId === 'modal-tenant') modal = document.getElementById('modal-create-tenant');
  if (!modal && modalId === 'modal-user') modal = document.getElementById('modal-create-user');

  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.pointerEvents = 'auto';

    // Buka akses pointer pada kontainer root modal
    const modalsRoot = document.getElementById('modals-root');
    if (modalsRoot) modalsRoot.style.pointerEvents = 'auto';
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

    // Kunci kembali akses pointer jika semua modal sudah tertutup
    const openModals = document.querySelectorAll('.modal-backdrop:not(.hidden)');
    if (openModals.length === 0) {
      const modalsRoot = document.getElementById('modals-root');
      if (modalsRoot) modalsRoot.style.pointerEvents = 'none';
    }
  }
};

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
// INISIALISASI UTAMA
// =========================================================================
async function initApp() {
  console.log('Posta POS Initializing...');

  // 1. Muat template partial HTML
  await loadComponents();

  // 2. Ambil informasi toko
  try {
    const tenantInfo = await api('/api/tenant/info', 'GET');
    if (tenantInfo && tenantInfo.data) {
      state.tenant = tenantInfo.data;
    }
  } catch (err) {
    console.warn('Gagal memuat info tenant:', err);
  }

  // 3. Autentikasi
  checkAuth();

  // 4. Inisialisasi navigasi
  initNavigation();

  // 5. Daftarkan event tombol
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
