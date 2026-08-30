import { state } from './state.js';
import { api } from './api.js';
import { loadComponents } from './loader.js';
import { initNavigation, navigateTo } from './navigation.js';
import { initPOSView } from './views/pos.js';

// =========================================================================
// GLOBAL MODAL HELPERS
// =========================================================================
window.openModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
};

// =========================================================================
// INIT APP
// =========================================================================
async function initApp() {
  console.log('Posta POS App Initializing...');

  // 1. Muat seluruh file partial HTML terlebih dahulu
  await loadComponents();

  // 2. Ambil informasi toko / tenant
  try {
    const tenantInfo = await api('/api/tenant/info', 'GET');
    if (tenantInfo && tenantInfo.data) {
      state.tenant = tenantInfo.data;
    }
  } catch (err) {
    console.warn('Gagal memuat data tenant:', err);
  }

  // 3. Pasang navigasi & event listener tombol
  initNavigation();

  // 4. Setup event tombol menu/sidebar
  setupGlobalEvents();
}

function setupGlobalEvents() {
  // Tombol toggle sidebar / menu
  const menuButtons = document.querySelectorAll('.header-menu-btn, .btn-menu-toggle');
  menuButtons.forEach(btn => {
    btn.onclick = () => {
      const sidebar = document.querySelector('.app-sidebar') || document.getElementById('sidebar');
      if (sidebar) sidebar.classList.toggle('active');
    };
  });

  // Tombol Shift
  const shiftBtn = document.getElementById('btn-shift-status') || document.querySelector('.btn-shift');
  if (shiftBtn) {
    shiftBtn.onclick = () => {
      window.openModal('modal-shift');
    };
  }
}

// Jalankan aplikasi setelah struktur DOM dasar terbaca
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
