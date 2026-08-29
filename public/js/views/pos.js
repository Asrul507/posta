import { state, formatRupiah, showToast } from '../state.js';
import { API } from '../api.js';

export async function initTenantSession() {
  try {
    const res = await fetch('/api/tenant/info');
    const result = await res.json();

    if (!result.success) {
      showToast(result.error || 'Toko tidak terdaftar', 'error');
      document.body.innerHTML = `
        <div class="h-screen flex flex-col items-center justify-center bg-slate-100 p-6 text-center font-sans">
          <div class="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center text-2xl mb-4 font-bold">!</div>
          <h1 class="text-xl font-black text-slate-800 mb-1">Toko Tidak Ditemukan</h1>
          <p class="text-sm text-slate-500 max-w-sm mb-4">${result.error}</p>
          <a href="https://posta.gpro.my.id" class="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold">Kembali ke Portal Hub</a>
        </div>
      `;
      return false;
    }

    // Jika yang diakses adalah domain developer: posta.gpro.my.id
    if (result.is_admin) {
      const viewPos = document.getElementById('view-pos');
      const bottomNav = document.querySelector('nav');
      const header = document.querySelector('header');
      const mobileBar = document.getElementById('mobile-checkout-bar');
      const adminView = document.getElementById('view-admin-portal');

      if (viewPos) viewPos.classList.add('hidden');
      if (bottomNav) bottomNav.classList.add('hidden');
      if (header) header.classList.add('hidden');
      if (mobileBar) mobileBar.classList.add('hidden');

      if (adminView) {
        adminView.classList.remove('hidden');
        if (typeof window.loadAdminTenants === 'function') {
          window.loadAdminTenants();
        }
      }
      return false;
    }

    state.tenantId = result.data.id;
    state.tenantInfo = result.data;

    const storeSubtitles = document.querySelectorAll('#page-title + span, #sidebar-drawer .font-bold.text-slate-800');
    storeSubtitles.forEach(el => {
      el.innerText = result.data.name;
    });

    return true;
  } catch (err) {
    showToast('Gagal memuat sesi toko.', 'error');
    return false;
  }
}

export async function loadProducts() {
  if (!state.tenantId) {
    const ok = await initTenantSession();
    if (!ok) return;
  }

  const grid = document.getElementById('product-grid');
  try {
    const result = await API.getProducts();
    if (result.success && result.data && result.data.length > 0) {
      state.products = result.data;
      renderCategories();
      renderProductGrid();
      renderProductTable();
      setupPODatalist();
    } else {
      if (grid) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 text-sm">Belum ada produk aktif di toko ini.</div>`;
      }
    }
  } catch (err) {
    if (grid) {
      grid.innerHTML = `<div class="col-span-full py-12 text-center text-rose-500 text-sm font-medium">Gagal memuat katalog barang.</div>`;
    }
  }
}
