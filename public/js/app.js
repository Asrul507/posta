import { loadComponents } from './loader.js';
import { initAuth } from './views/auth.js';
import { initNavigation } from './navigation.js';
import { initPosEvents } from './views/pos.js';
import { initCheckoutEvents } from './views/checkout.js';
import { initShiftsEvents } from './views/shifts.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Muat komponen HTML secara aman
    await loadComponents();

    // 2. Inisialisasi modul UI & Autentikasi
    initAuth();
    initNavigation();
    initPosEvents();
    initCheckoutEvents();
    initShiftsEvents();

    console.log('Posta POS App initialized successfully.');
  } catch (error) {
    console.error('Inisialisasi aplikasi gagal:', error);
    // Tampilkan pesan error ramah jika terjadi kendala loading
    const appContainer = document.getElementById('app') || document.body;
    const errorBox = document.createElement('div');
    errorBox.style.cssText = 'padding: 20px; color: #ef4444; font-family: sans-serif; text-align: center;';
    errorBox.innerHTML = `
      <h3>Gagal memuat aplikasi</h3>
      <p style="color: #64748b; font-size: 13px;">${error.message}</p>
      <button onclick="localStorage.clear(); location.reload();" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">
        Bersihkan Cache & Refresh
      </button>
    `;
    appContainer.appendChild(errorBox);
  }
});
