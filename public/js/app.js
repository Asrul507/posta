import { state } from './state.js';
import { api } from './api.js';
import { initNavigation, navigateTo } from './navigation.js';
import { initPOSView } from './views/pos.js';

// =========================================================================
// MODAL CONTROLLER GLOBAL
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
// INISIALISASI APLIKASI
// =========================================================================
async function initApp() {
  console.log('Posta POS App Initializing...');

  // 1. Ambil info tenant / toko saat ini
  try {
    const tenantInfo = await api('/api/tenant/info', 'GET');
    if (tenantInfo && tenantInfo.data) {
      state.tenant = tenantInfo.data;
    }
  } catch (err) {
    console.warn('Gagal memuat data tenant:', err);
  }

  // 2. Pasang inisialisasi Navigasi & View Default
  initNavigation();

  // 3. Muat Katalog POS
  await initPOSView();

  // 4. Setup Tombol Shift & Sidebar
  setupHeaderEvents();
}

function setupHeaderEvents() {
  // Tombol Menu / Sidebar Toggle
  const menuBtn = document.querySelector('.header-menu-btn') || document.querySelector('button[aria-label="menu"]') || document.querySelector('.fa-bars')?.parentElement;
  if (menuBtn) {
    menuBtn.onclick = () => {
      const sidebar = document.querySelector('.app-sidebar') || document.getElementById('sidebar');
      if (sidebar) sidebar.classList.toggle('active');
    };
  }

  // Tombol Shift
  const shiftBtn = document.querySelector('.btn-shift') || document.getElementById('btn-shift-status');
  if (shiftBtn) {
    shiftBtn.onclick = () => {
      window.openModal('modal-shift');
    };
  }
}

// Jalankan aplikasi saat DOM siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
