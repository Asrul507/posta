import { state } from './state.js';
import { loadComponents } from './loader.js';
import { initAuth } from './views/auth.js';
import { navigateTo, initNavigation } from './navigation.js';
import { initShifts, checkAndRestoreShift, updateHeaderShiftStatus } from './views/shifts.js';

// Load semua views agar event-nya terpasang ke DOM
import './views/pos.js';
import './views/products.js';
import './views/po.js';
import './views/checkout.js';
import './views/reports.js';
import './views/admin.js';

async function bootstrap() {
  try {
    // 1. Muat template komponen HTML
    await loadComponents();

    // 2. Inisialisasi Auth, Navigasi & Event Shift
    initAuth();
    initNavigation();
    initShifts();

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

      // Sembunyikan item sidebar menu admin jika role kasir
      const adminNavs = document.querySelectorAll('.nav-admin-only');
      if (state.user.role === 'CASHIER') {
        adminNavs.forEach(el => el.classList.add('hidden'));
        navigateTo('view-pos');
        await checkAndRestoreShift();
      } else {
        adminNavs.forEach(el => el.classList.remove('hidden'));
        // Admin, Owner, Superadmin langsung ke Dashboard Admin
        navigateTo('view-admin');
        updateHeaderShiftStatus(null);
      }
    } else {
      document.getElementById('auth-container')?.classList.remove('hidden');
      document.getElementById('main-layout')?.classList.add('hidden');
    }
  } catch (err) {
    console.error('Error saat inisialisasi aplikasi:', err);
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
