import { checkAuthSession } from './auth.js';

export async function initTenantSession() {
  try {
    const res = await fetch('/api/tenant/info');
    const result = await res.json();

    if (!result.success) {
      showToast(result.error || 'Toko tidak terdaftar', 'error');
      document.body.innerHTML = `
        <div class="h-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center font-sans text-slate-100">
          <div class="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center text-2xl mb-4 font-bold border border-rose-500/30">!</div>
          <h1 class="text-xl font-black mb-1">Toko Tidak Ditemukan</h1>
          <p class="text-xs text-slate-400 max-w-sm mb-4">${result.error}</p>
          <a href="https://posta.gpro.my.id" class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg">Kembali ke Portal Hub</a>
        </div>
      `;
      return false;
    }

    state.tenantId = result.is_admin ? 'admin' : result.data.id;
    state.tenantInfo = result.is_admin ? { id: 'admin', is_admin: true } : { ...result.data, is_admin: false };

    // Cek Autentikasi / Tampilkan Form Login jika belum masuk
    const isAuthed = await checkAuthSession(state.tenantInfo);
    if (!isAuthed) return false;

    // Jika Superadmin
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
