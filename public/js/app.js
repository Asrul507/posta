import { state } from './state.js';
import { loadComponents } from './loader.js';
import { initAuth } from './views/auth.js';
import { navigateTo, initNavigation } from './navigation.js';
import { checkAndRestoreShift, updateHeaderShiftStatus } from './views/shifts.js';

// Muat modul view agar event listener masing-masing aktif
import './views/pos.js';
import './views/products.js';
import './views/po.js';
import './views/checkout.js';
import './views/reports.js';
import './views/admin.js';

async function bootstrap() {
  try {
    // 1. Muat template HTML komponen
    await loadComponents();

    // 2. Inisialisasi Auth & Navigasi
    if (typeof initAuth === 'function') initAuth();
    if (typeof initNavigation === 'function') initNavigation();

    // 3. Cek sesi login tersimpan
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

      // Logika Routing Role
      const adminNavItems = document.querySelectorAll('.nav-admin-only');
      if (state.user.role === 'CASHIER') {
        adminNavItems.forEach(el => el.classList.add('hidden'));
        navigateTo('pos');
        await checkAndRestoreShift();
      } else {
        adminNavItems.forEach(el => el.classList.remove('hidden'));
        // Admin / Owner / Superadmin langsung ke Dashboard Admin (tanpa modal shift)
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
    console.error('Bootstrap error:', err);
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
