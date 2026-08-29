import { toggleSidebar, switchView, toggleMobileCartDrawer } from './navigation.js';
import * as pos from './views/pos.js';
import * as checkout from './views/checkout.js';
import * as po from './views/po.js';
import * as reports from './views/reports.js';
import * as scanner from './scanner.js';

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
