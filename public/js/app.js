import { state } from './state.js';
import { loadComponents } from './loader.js';
import { initAuth } from './views/auth.js';
import { navigateTo, initNavigation } from './navigation.js';
import { checkAndRestoreShift, updateHeaderShiftStatus } from './views/shifts.js';

async function bootstrap() {
  try {
    // 1. Muat template komponen HTML
    await loadComponents();

    // 2. Inisialisasi autentikasi & event listener navigasi
    initAuth();
    if (typeof initNavigation === 'function') {
      initNavigation();
    }

    // 3. Periksa token tersimpan di LocalStorage
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

      // Arahkan ke halaman sesuai Role
      if (state.user.role === 'CASHIER') {
        navigateTo('pos');
        await checkAndRestoreShift();
      } else {
        // ADMIN, OWNER, SUPERADMIN langsung ke Dashboard Admin
        navigateTo('admin');
        updateHeaderShiftStatus(null);
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
