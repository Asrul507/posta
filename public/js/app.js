import { state } from './state.js';
import { api } from './api.js';
import { loadComponents } from './loader.js';
import { checkAuth } from './views/auth.js';
import { initNavigation } from './navigation.js';

// =========================================================================
// MODAL & SIDEBAR CONTROLLER NATIVE POSTA
// =========================================================================
window.openModal = function(modalId) {
  // Dukung alternatif nama ID modal
  let modal = document.getElementById(modalId);
  if (!modal && modalId === 'modal-tenant') modal = document.getElementById('modal-create-tenant');
  if (!modal && modalId === 'modal-user') modal = document.getElementById('modal-create-user');

  if (modal) {
    modal.classList.remove('hidden');
    // Jika modal menggunakan class modal-backdrop
    modal.style.display = 'flex';
  }
};

window.closeModal = function(modalId) {
  let modal = document.getElementById(modalId);
  if (!modal && modalId === 'modal-tenant') modal = document.getElementById('modal-create-tenant');
  if (!modal && modalId === 'modal-user') modal = document.getElementById('modal-create-user');

  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
};

window.toggleSidebar = function(forceState) {
  const sidebar = document.querySelector('.sidebar, .app-sidebar, aside') || document.getElementById('sidebar-root');
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
  console.log('Posta POS Initializing...');

  // 1. Muat komponen HTML
  await loadComponents();

  // 2. Ambil informasi tenant
  try {
    const tenantInfo = await api('/api/tenant/info', 'GET');
    if (tenantInfo && tenantInfo.data) {
      state.tenant = tenantInfo.data;
    }
  } catch (err) {
    console.warn('Gagal memuat tenant info:', err);
  }

  // 3. Cek autentikasi login
  checkAuth();

  // 4. Inisialisasi navigasi
  initNavigation();

  // 5. Setup tombol header
  setupGlobalEvents();
}

function setupGlobalEvents() {
  const menuBtns = document.querySelectorAll('.header-menu-btn, .btn-menu-toggle');
  menuBtns.forEach(btn => {
    btn.onclick = () => window.toggleSidebar();
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
