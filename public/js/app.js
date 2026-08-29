import { loadComponent } from './loader.js';
import { toggleSidebar, switchView, toggleMobileCartDrawer } from './navigation.js';
import * as pos from './views/pos.js';
import * as checkout from './views/checkout.js';
import * as po from './views/po.js';
import * as reports from './views/reports.js';
import * as scanner from './scanner.js';
import * as admin from './views/admin.js';
import * as auth from './views/auth.js';
import * as shifts from './views/shifts.js';
import { checkActiveShift } from './views/shifts.js';

// 1. Daftarkan semua modul ke window (cukup 1 kali)
Object.assign(window, {
  toggleSidebar,
  switchView,
  toggleMobileCartDrawer,
  ...pos,
  ...checkout,
  ...po,
  ...reports,
  ...scanner,
  ...admin,
  ...auth,
  ...shifts
});

// 2. Inisialisasi: Tunggu komponen HTML termuat SEMPURNA sebelum menjalankan logic
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await Promise.all([
      loadComponent('comp-login', '/components/login.html'),
      loadComponent('comp-sidebar', '/components/sidebar.html'),
      loadComponent('comp-header', '/components/header.html'),
      loadComponent('comp-view-pos', '/components/view-pos.html'),
      loadComponent('comp-view-products', '/components/view-products.html'),
      loadComponent('comp-view-history', '/components/view-history.html'),
      loadComponent('comp-view-admin', '/components/view-admin.html'),
      loadComponent('comp-modals', '/components/modals.html')
    ]);
  } catch (err) {
    console.error("Gagal memuat komponen HTML:", err);
  }

  // Setelah seluruh komponen HTML masuk ke DOM, jalankan logic kasir
  try {
    pos.loadProducts();
    scanner.initHardwareScannerListener();
  } catch (e) {
    console.error("Init POS Error:", e);
  }

  // Pasang event listener search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', pos.renderProductGrid);
  }
});
