import { loadComponent } from './loader.js';
import { toggleSidebar, switchView, toggleMobileCartDrawer } from './navigation.js';
import * as pos from './views/pos.js';
import * as checkout from './views/checkout.js';
import * as po from './views/po.js';
import * as reports from './views/reports.js';
import * as scanner from './scanner.js';
import * as admin from './views/admin.js';

// Daftarkan semua modul ke window
Object.assign(window, {
  toggleSidebar,
  switchView,
  toggleMobileCartDrawer,
  ...pos,
  ...checkout,
  ...po,
  ...reports,
  ...scanner,
  ...admin
});

// Inisialisasi: Muat HTML modular terlebih dahulu
window.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    loadComponent('comp-sidebar', '/components/sidebar.html'),
    loadComponent('comp-header', '/components/header.html'),
    loadComponent('comp-view-pos', '/components/view-pos.html'),
    loadComponent('comp-view-products', '/components/view-products.html'),
    loadComponent('comp-view-history', '/components/view-history.html'),
    loadComponent('comp-view-admin', '/components/view-admin.html'),
    loadComponent('comp-modals', '/components/modals.html')
  ]);

  // Setelah seluruh elemen HTML nempel di DOM, inisialisasi sesi & produk
  try {
    pos.loadProducts();
    scanner.initHardwareScannerListener();
  } catch (e) {
    console.error("Init POS Error:", e);
  }

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', pos.renderProductGrid);
  }
});
// Jalankan loadProducts setelah DOM siap
window.addEventListener('DOMContentLoaded', () => {
  try {
    pos.loadProducts();
    scanner.initHardwareScannerListener();
  } catch (e) {
    console.error("Inisialisasi POS:", e);
  }

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', pos.renderProductGrid);
  }
});

// Ekspos semua fungsi ke window agar onclick di HTML bisa langsung mengaksesnya
Object.assign(window, {
  toggleSidebar,
  switchView,
  toggleMobileCartDrawer,
  ...pos,
  ...checkout,
  ...po,
  ...reports,
  ...scanner
});

// Tunggu hingga seluruh HTML siap
window.addEventListener('load', () => {
  try {
    pos.loadProducts();
    scanner.initHardwareScannerListener();
  } catch (e) {
    console.error("Inisialisasi POS:", e);
  }

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', pos.renderProductGrid);
  }
});
