import { toggleSidebar, switchView, toggleMobileCartDrawer } from './navigation.js';
import * as pos from './views/pos.js';
import * as checkout from './views/checkout.js';
import * as po from './views/po.js';
import * as reports from './views/reports.js';
import * as scanner from './scanner.js';

// Ekspos fungsi ke objek window agar tombol HTML onclick tetap berjalan
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

// Jalankan inisialisasi saat dokumen selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
  if (typeof pos.loadProducts === 'function') {
    pos.loadProducts();
  }
  if (typeof scanner.initHardwareScannerListener === 'function') {
    scanner.initHardwareScannerListener();
  }

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', pos.renderProductGrid);
  }
});
