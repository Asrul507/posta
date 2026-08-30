import { state } from './state.js';
import { api } from './api.js';
import { loadComponents } from './loader.js';
import { initNavigation, navigateTo } from './navigation.js';
import { initPOSView } from './views/pos.js';

// =========================================================================
// GLOBAL SIDEBAR CONTROLLER
// =========================================================================
window.toggleSidebar = function(forceState) {
  const sidebar = document.querySelector('.sidebar, .app-sidebar, aside') || document.getElementById('sidebar') || document.getElementById('sidebar-root');
  if (!sidebar) return;

  if (typeof forceState === 'boolean') {
    if (forceState) {
      sidebar.classList.add('active', 'open');
      sidebar.style.display = 'block';
    } else {
      sidebar.classList.remove('active', 'open');
    }
  } else {
    sidebar.classList.toggle('active');
    sidebar.classList.toggle('open');
  }
};

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

  // 1. Muat SEMUA komponen partial HTML
  await loadComponents();

  // 2. Ambil data tenant
  try {
    const tenantInfo = await api('/api/tenant/info', 'GET');
    if (tenantInfo && tenantInfo.data) {
      state.tenant = tenantInfo.data;
    }
  } catch (err) {
    console.warn('Gagal memuat info tenant:', err);
  }

  // 3. Inisialisasi navigasi & tampilkan view POS
  initNavigation();

  // 4. Inisialisasi data & event POS
  await initPOSView();
}

// Jalankan aplikasi saat dokumen siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
