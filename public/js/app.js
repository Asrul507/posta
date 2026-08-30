import { state } from './state.js';
import { api } from './api.js';
import { loadComponents } from './loader.js';
import { initNavigation, navigateTo } from './navigation.js';
import { initPOSView } from './views/pos.js';

// =========================================================================
// GLOBAL CONTROLLERS (MODAL & SIDEBAR)
// =========================================================================
window.openModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.zIndex = '9999';
  }
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
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
// INISIALISASI UTAMA
// =========================================================================
async function initApp() {
  console.log('Posta POS App Initializing...');

  // 1. Muat template komponen HTML
  await loadComponents();

  // 2. Ambil informasi tenant dari server
  try {
    const tenantInfo = await api('/api/tenant/info', 'GET');
    if (tenantInfo && tenantInfo.data) {
      state.tenant = tenantInfo.data;
    }
  } catch (err) {
    console.warn('Gagal memuat tenant info:', err);
  }

  // 3. Jalankan navigasi (akan otomatis membuka Superadmin di posta.gpro.my.id)
  initNavigation();
}

// Jalankan ketika dokumen siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
