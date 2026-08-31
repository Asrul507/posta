import { loadComponents } from './loader.js';
import { initAuth } from './views/auth.js';
import { initNavigation } from './navigation.js';
import { initPosEvents } from './views/pos.js';
import { initCheckoutEvents } from './views/checkout.js';
import { initShifts } from './views/shifts.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadComponents();

    initAuth();
    initNavigation();
    initPosEvents();
    initCheckoutEvents();
    if (typeof initShifts === 'function') {
      initShifts();
    }

    console.log('Posta POS App initialized successfully.');
  } catch (error) {
    console.error('Inisialisasi aplikasi gagal:', error);
  }
});
