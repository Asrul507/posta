import { loadComponents } from './loader.js';
import * as auth from './views/auth.js';
import * as pos from './views/pos.js';
import * as checkout from './views/checkout.js';
import * as po from './views/po.js';
import * as reports from './views/reports.js';
import * as shifts from './views/shifts.js';
import * as admin from './views/admin.js';
import * as scanner from './scanner.js';
import { toggleSidebar, switchView, toggleMobileCartDrawer } from './navigation.js';

function showStartupError(error) {
  console.error('Inisialisasi aplikasi gagal:', error);
  const login = document.getElementById('login-container');
  if (login) login.innerHTML = '<p class="p-4 text-center text-rose-600">Aplikasi gagal dimuat. Silakan segarkan halaman.</p>';
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadComponents();
    Object.assign(window, {
      toggleSidebar, switchView, toggleMobileCartDrawer,
      ...auth, ...pos, ...checkout, ...po, ...reports, ...shifts, ...admin, ...scanner,
    });

    scanner.initHardwareScannerListener();
    checkout.initCheckoutEvents();
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', pos.renderProductGrid);
    const productSearch = document.getElementById('prod-table-search');
    if (productSearch) productSearch.addEventListener('input', pos.renderProductTable);

    // Resolve the current host before attempting login.  The old hard-coded
    // `berkah` tenant prevented users of every other store (and the developer
    // portal) from authenticating.
    await pos.initTenantSession();
  } catch (error) {
    showStartupError(error);
  }
});
