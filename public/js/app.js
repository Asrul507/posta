import { state } from './state.js';
import { loadComponents } from './loader.js';
import { initAuth } from './views/auth.js';
import { navigateTo, initNavigation } from './navigation.js';
import { initShifts, checkAndRestoreShift, updateHeaderShiftStatus } from './views/shifts.js';
import { initPOS } from './views/pos.js';
import { initProducts } from './views/products.js';
import { initPO } from './views/po.js';
import { initReports } from './views/reports.js';
import { initAdminView } from './views/admin.js';

async function bootstrap() {
  try {
    // 1. Muat seluruh komponen UI HTML
    await loadComponents();

    // 2. Inisialisasi event listener seluruh modul view
    initAuth();
    initNavigation();
    
    if (typeof initPOS === 'function') initPOS();
    if (typeof initProducts === 'function') initProducts();
    if (typeof initPO === 'function') initPO();
    if (typeof initReports === 'function') initReports();
    if (typeof initShifts === 'function') initShifts();

    // 3. Periksa sesi login yang tersimpan
    const savedToken = localStorage.getItem('posta_token');
    const savedUser = localStorage.getItem('posta_user');

    if (savedToken && savedUser) {
      state.token = savedToken;
      state.user = JSON.parse(savedUser);

      document.getElementById('auth-container')?.classList.add('hidden');
      document.getElementById('main-layout')?.classList.remove('hidden');

      const headerUser = document.getElementById('header-user-name');
      if (headerUser) {
        headerUser.textContent = `${state.user.name} (${state.user.role})`;
      }

      // Role Routing
      const adminNavItems = document.querySelectorAll('.nav-admin-only');
      if (state.user.role === 'CASHIER') {
        adminNavItems.forEach(el => el.classList.add('hidden'));
        navigateTo('pos');
        await checkAndRestoreShift();
      } else {
        adminNavItems.forEach(el => el.classList.remove('hidden'));
        // Admin/Owner/Superadmin langsung ke Dashboard Admin
        navigateTo('admin');
        if (typeof updateHeaderShiftStatus === 'function') {
          updateHeaderShiftStatus(null);
        }
      }
    } else {
      document.getElementById('auth-container')?.classList.remove('hidden');
      document.getElementById('main-layout')?.classList.add('hidden');
    }
  } catch (err) {
    console.error('Bootstrap application failed:', err);
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
