import { toggleSidebar, switchView, toggleMobileCartDrawer } from './navigation.js';
import * as pos from './views/pos.js';
import * as checkout from './views/checkout.js';
import * as po from './views/po.js';
import * as reports from './views/reports.js';
import * as scanner from './scanner.js';

// Ekspos ke window agar atribut onclick di HTML tetap bekerja langsung
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

// Jalankan saat halaman siap
document.addEventListener('DOMContentLoaded', () => {
  pos.loadProducts();
  scanner.initHardwareScannerListener();

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.addEventListener('input', pos.renderProductGrid);
});
