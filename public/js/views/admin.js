import { showToast } from '../state.js';

export async function loadAdminTenants() {
  const grid = document.getElementById('admin-tenants-grid');
  if (!grid) return;

  grid.innerHTML = `<div class="col-span-full py-16 text-center text-slate-500 text-sm"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2 block"></i>Memuat daftar toko...</div>`;

  try {
    const res = await fetch('/api/admin/tenants');
    const result = await res.json();

    if (result.success && result.data && result.data.length > 0) {
      grid.innerHTML = result.data.map(t => {
        const tenantUrl = `https://${t.subdomain}.gpro.my.id`;
        return `
          <div class="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-indigo-500/50 transition-all shadow-md">
            <div>
              <div class="flex items-center justify-between gap-2 mb-2">
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-400 font-bold border border-indigo-900">${t.subdomain}.gpro.my.id</span>
                <span class="w-2.5 h-2.5 rounded-full ${t.is_active ? 'bg-emerald-500' : 'bg-slate-600'}"></span>
              </div>
              <h3 class="font-extrabold text-base text-white truncate">${t.name}</h3>
              <p class="text-xs text-slate-400 truncate mt-0.5">${t.address || 'Alamat belum diatur'}</p>

              <div class="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-900 text-xs">
                <div class="bg-slate-900/60 p-2 rounded-xl text-center">
                  <span class="text-[10px] text-slate-500 block uppercase font-bold">Produk</span>
                  <span class="font-bold text-slate-200">${t.total_products || 0}</span>
                </div>
                <div class="bg-slate-900/60 p-2 rounded-xl text-center">
                  <span class="text-[10px] text-slate-500 block uppercase font-bold">Transaksi</span>
                  <span class="font-bold text-slate-200">${t.total_transactions || 0}</span>
                </div>
              </div>
            </div>

            <div class="mt-4 pt-3">
              <a href="${tenantUrl}" target="_blank" class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs text-center flex items-center justify-center gap-1.5 shadow transition">
                <i class="fa-solid fa-arrow-up-right-from-square text-[11px]"></i>
                <span>Buka Mesin Kasir</span>
              </a>
            </div>
          </div>
        `;
      }).join('');
    } else {
      grid.innerHTML = `<div class="col-span-full py-16 text-center text-slate-500 text-sm">Belum ada toko yang terdaftar. Klik tombol Tambah Toko Baru di atas.</div>`;
    }
  } catch (err) {
    grid.innerHTML = `<div class="col-span-full py-16 text-center text-rose-500 text-sm">Gagal memuat data toko.</div>`;
  }
}

export function openCreateTenantModal() {
  document.getElementById('new-tenant-subdomain').value = '';
  document.getElementById('new-tenant-name').value = '';
  document.getElementById('new-tenant-address').value = '';
  document.getElementById('create-tenant-modal').classList.remove('hidden');
}

export function closeCreateTenantModal() {
  document.getElementById('create-tenant-modal').classList.add('hidden');
}

export async function submitCreateTenant() {
  const subdomain = document.getElementById('new-tenant-subdomain').value.trim();
  const name = document.getElementById('new-tenant-name').value.trim();
  const address = document.getElementById('new-tenant-address').value.trim();

  if (!subdomain || !name) {
    showToast('Subdomain dan Nama Toko wajib diisi!', 'error');
    return;
  }

  const btn = document.getElementById('btn-save-tenant');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

  try {
    const res = await fetch('/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain, name, address })
    });
    const result = await res.json();

    if (result.success) {
      showToast(result.message);
      closeCreateTenantModal();
      loadAdminTenants();
    } else {
      showToast('Gagal: ' + result.error, 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> <span>Buat Toko Sekarang</span>';
  }
}
