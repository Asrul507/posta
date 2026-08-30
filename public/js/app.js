import { state } from './state.js';
import { api } from './api.js';
import { loadComponents } from './loader.js';
import { initNavigation, navigateTo } from './navigation.js';
import { initPOSView } from './views/pos.js';

// =========================================================================
// GLOBAL MODAL CONTROLLERS
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

  // 1. Muat SEMUA komponen HTML sampai tuntas
  await loadComponents();

  // 2. Ambil data tenant saat ini
  try {
    const tenantInfo = await api('/api/tenant/info', 'GET');
    if (tenantInfo && tenantInfo.data) {
      state.tenant = tenantInfo.data;
    }
  } catch (err) {
    console.warn('Gagal memuat data tenant:', err);
  }

  // 3. Pasang navigasi & render view default
  initNavigation();

  // 4. Pastikan katalog POS langsung dimuat
  await initPOSView();

  // 5. Daftarkan event tombol global
  setupGlobalEvents();
}

function setupGlobalEvents() {
  // Toggle Sidebar Menu
  const menuButtons = document.querySelectorAll('.header-menu-btn, .btn-menu-toggle, [data-action="toggle-sidebar"]');
  menuButtons.forEach(btn => {
    btn.onclick = () => {
      const sidebar = document.querySelector('.app-sidebar') || document.getElementById('sidebar') || document.getElementById('sidebar-root');
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

// Jalankan aplikasi saat dokumen siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
