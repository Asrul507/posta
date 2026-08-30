import { state } from './state.js';
import { loadComponents } from './loader.js';
import { initAuth } from './views/auth.js';
import { navigateTo, initNavigation } from './navigation.js';
import { initShifts, checkAndRestoreShift, updateHeaderShiftStatus } from './views/shifts.js';
import { initHardwareScannerListener } from './scanner.js';

// Load semua views agar event & fungsi window.* nya terpasang ke DOM
import './views/pos.js';
import './views/po.js';
import './views/checkout.js';
import './views/reports.js';
import './views/admin.js';
import './views/history.js';

function applyRoleBasedUI(user) {
  const headerUser = document.getElementById('header-user-info');
  if (headerUser) headerUser.textContent = `${user.name} (${user.role})`;

  document.querySelectorAll('.current-user-name').forEach(el => {
    el.textContent = user.name;
  });

  const adminNavs = document.querySelectorAll('.role-admin-only');
  if (user.role === 'CASHIER') {
    adminNavs.forEach(el => el.classList.add('hidden'));
  } else {
    adminNavs.forEach(el => el.classList.remove('hidden'));
  }
}

async function bootstrap() {
  try {
    // 1. Muat template komponen HTML
    await loadComponents();

    // 2. Inisialisasi Auth, Navigasi, Shift & Scanner
    initAuth();
    initNavigation();
    initShifts();
    initHardwareScannerListener();

    // 3. Periksa sesi login yang tersimpan
    const savedToken = localStorage.getItem('posta_token');
    const savedUser = localStorage.getItem('posta_user');

    if (savedToken && savedUser) {
      state.token = savedToken;
      state.user = JSON.parse(savedUser);
      state.tenantId = state.user.tenant_id || null;

      document.getElementById('login-overlay')?.classList.add('hidden');
      document.getElementById('main-layout')?.classList.remove('hidden');

      applyRoleBasedUI(state.user);

      if (state.user.role === 'CASHIER') {
        navigateTo('view-pos');
        await checkAndRestoreShift();
      } else {
        navigateTo('view-admin');
        updateHeaderShiftStatus(null);
      }
    } else {
      document.getElementById('main-layout')?.classList.add('hidden');
      document.getElementById('login-overlay')?.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Error saat inisialisasi aplikasi:', err);
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
