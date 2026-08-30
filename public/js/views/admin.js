import { adjustStock, getStockHistory, api } from '../api.js';
import { state } from '../state.js';

export async function initAdminView() {
  console.log('Memuat Admin & Developer Dashboard...');
  await loadAdminDashboardData();
}

export async function loadAdminDashboardData() {
  try {
    const isSuperAdmin = state.user?.role === 'SUPERADMIN' || window.location.hostname === 'posta.gpro.my.id' || window.location.hostname === 'localhost';

    // 1. Kontrol Tampilan Panel Superadmin vs Panel Toko
    const superadminPanel = document.getElementById('panel-developer-superadmin');
    const storeAdminPanel = document.getElementById('panel-store-admin');

    if (superadminPanel) {
      superadminPanel.style.display = isSuperAdmin ? 'block' : 'none';
    }
    if (storeAdminPanel) {
      storeAdminPanel.style.display = isSuperAdmin ? 'none' : 'block';
    }

    // 2. Load data sesuai tipe dashboard
    if (isSuperAdmin) {
      await loadTenantsList();
      await loadAdminUsersList();
    } else {
      await loadAdminProducts();
    }
  } catch (err) {
    console.error('Gagal inisialisasi dashboard admin:', err);
  }
}

// =========================================================================
// DEVELOPER / SUPERADMIN: MANAJEMEN TOKO (TENANTS) & USER
// =========================================================================
export async function loadTenantsList() {
  try {
    const res = await api('/api/admin/tenants', 'GET');
    const tenants = res.data || [];
    const tbody = document.getElementById('tenants-table-body');
    if (!tbody) return;

    if (tenants.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada data toko.</td></tr>';
      return;
    }

    tbody.innerHTML = tenants.map(t => `
      <tr>
        <td><strong>${t.name}</strong></td>
        <td><a href="https://${t.subdomain}.gpro.my.id" target="_blank" class="text-blue-500">${t.subdomain}.gpro.my.id</a></td>
        <td>${t.total_products || 0} Item</td>
        <td>${t.total_transactions || 0} Transaksi</td>
        <td class="text-right">
          <button class="btn btn-sm btn-primary" onclick="window.impersonateTenant('${t.subdomain}')">Buka Toko ↗</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

export async function loadAdminUsersList() {
  try {
    const res = await api('/api/admin/users', 'GET');
    const users = res.data || [];
    const tbody = document.getElementById('admin-users-table-body');
    if (!tbody) return;

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center">Belum ada user.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr>
        <td><strong>${u.name}</strong> (${u.username})</td>
        <td><span class="badge badge-info">${u.role}</span></td>
        <td>${u.tenant_name || 'PUSAT'}</td>
        <td>${u.is_active ? '✅ Aktif' : '❌ Nonaktif'}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

// Buat Toko / Subdomain Baru
window.handleCreateTenant = async function(event) {
  if (event) event.preventDefault();
  const name = document.getElementById('tenant-name')?.value;
  const subdomain = document.getElementById('tenant-subdomain')?.value;
  const address = document.getElementById('tenant-address')?.value;
  const phone = document.getElementById('tenant-phone')?.value;

  try {
    const res = await api('/api/admin/tenants', 'POST', { name, subdomain, address, phone });
    if (res.success) {
      alert(`Toko ${name} berhasil dibuat!`);
      if (window.closeModal) window.closeModal('modal-create-tenant');
      await loadTenantsList();
    } else {
      alert(res.error || 'Gagal membuat toko');
    }
  } catch (err) {
    alert('Gagal menghubungi server.');
  }
};

// Buat User Baru
window.handleCreateUser = async function(event) {
  if (event) event.preventDefault();
  const name = document.getElementById('user-name')?.value;
  const username = document.getElementById('user-username')?.value;
  const password = document.getElementById('user-password')?.value;
  const role = document.getElementById('user-role')?.value;
  const tenant_id = document.getElementById('user-tenant-id')?.value;

  try {
    const res = await api('/api/admin/users', 'POST', { name, username, password, role, tenant_id });
    if (res.success) {
      alert(`User ${name} berhasil ditambahkan!`);
      if (window.closeModal) window.closeModal('modal-create-user');
      await loadAdminUsersList();
    } else {
      alert(res.error || 'Gagal membuat user');
    }
  } catch (err) {
    alert('Gagal menghubungi server.');
  }
};

export async function impersonateTenant(subdomain) {
  try {
    const res = await api(`/api/admin/impersonate?subdomain=${subdomain}`, 'GET');
    if (res.success && res.target_url) {
      window.location.href = res.target_url;
    } else {
      alert(res.error || 'Gagal membuka toko');
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan.');
  }
}

// =========================================================================
// PRODUK & STOK OPNAME (STORE LEVEL)
// =========================================================================
export async function loadAdminProducts() {
  try {
    const res = await api('/api/products', 'GET');
    const products = Array.isArray(res) ? res : (res.data || []);
    state.products = products;
    renderAdminProductsTable(products);
  } catch (err) {
    console.error('Gagal mengambil list produk toko:', err);
  }
}

export function renderAdminProductsTable(products) {
  const tbody = document.getElementById('product-table-body') || document.getElementById('admin-products-table-body');
  if (!tbody) return;

  if (!products || products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Belum ada data produk di toko ini.</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td>${p.sku || '-'}</td>
      <td><strong>${p.name}</strong></td>
      <td>Rp ${(Number(p.cost_price || 0)).toLocaleString('id-ID')}</td>
      <td>Rp ${(Number(p.price || 0)).toLocaleString('id-ID')}</td>
      <td><span class="badge ${p.stock <= 5 ? 'badge-danger' : 'badge-success'}">${p.stock || 0}</span></td>
      <td class="text-right">
        <button class="btn btn-sm btn-outline" onclick="window.openStockAdjustModal('${p.id}')">Opname</button>
        <button class="btn btn-sm btn-outline" onclick="window.openStockHistoryModal('${p.id}')">Log</button>
      </td>
    </tr>
  `).join('');
}

// Global Bindings
window.impersonateTenant = impersonateTenant;
window.renderProductTable = loadAdminProducts;
window.renderAdminProducts = loadAdminProducts;
