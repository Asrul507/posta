import { adjustStock, getStockHistory, api } from '../api.js';
import { state } from '../state.js';

export async function initAdminView() {
  console.log('Memuat Dashboard Admin / Developer...');
  await loadAdminDashboardData();
}

export async function loadAdminDashboardData() {
  try {
    const isSuperAdmin = window.location.hostname === 'posta.gpro.my.id' || window.location.hostname === 'localhost' || state.user?.role === 'SUPERADMIN';

    const superadminPanel = document.getElementById('panel-developer-superadmin');
    const storeAdminPanel = document.getElementById('panel-store-admin');

    if (superadminPanel) superadminPanel.style.display = isSuperAdmin ? 'block' : 'none';
    if (storeAdminPanel) storeAdminPanel.style.display = isSuperAdmin ? 'none' : 'block';

    if (isSuperAdmin) {
      await loadTenantsList();
      await loadAdminUsersList();
    } else {
      await loadAdminProducts();
    }
  } catch (err) {
    console.error('Gagal load dashboard admin:', err);
  }
}

// -------------------------------------------------------------------------
// SUPERADMIN: DAFTAR TOKO & USER
// -------------------------------------------------------------------------
export async function loadTenantsList() {
  try {
    const res = await api('/api/admin/tenants', 'GET');
    const tenants = res.data || [];
    const tbody = document.getElementById('tenants-table-body');
    if (!tbody) return;

    if (tenants.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada toko terdaftar.</td></tr>';
      return;
    }

    tbody.innerHTML = tenants.map(t => `
      <tr>
        <td><strong>${t.name}</strong></td>
        <td><a href="https://${t.subdomain}.gpro.my.id" target="_blank" style="color: #2563eb; text-decoration: underline;">${t.subdomain}.gpro.my.id</a></td>
        <td>${t.total_products || 0} Produk</td>
        <td>${t.total_transactions || 0} Transaksi</td>
        <td class="text-right">
          <button class="btn btn-sm btn-primary" onclick="window.impersonateTenant('${t.subdomain}')">
            Buka Toko ↗
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Gagal memuat tenant:', err);
  }
}

export async function loadAdminUsersList() {
  try {
    const res = await api('/api/admin/users', 'GET');
    const users = res.data || [];
    const tbody = document.getElementById('admin-users-table-body');
    if (!tbody) return;

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center">Belum ada user terdaftar.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr>
        <td><strong>${u.name}</strong> <span style="color: #94a3b8; font-size: 0.8rem;">(${u.username})</span></td>
        <td><span class="badge badge-info">${u.role}</span></td>
        <td>${u.tenant_name || 'PUSAT'}</td>
        <td>${u.is_active ? '✅ Aktif' : '❌ Nonaktif'}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Gagal memuat users:', err);
  }
}

// Form Handler Tambah Toko
window.handleTenantSubmit = async function(event) {
  if (event) event.preventDefault();
  const name = document.getElementById('tenant-name')?.value;
  const subdomain = document.getElementById('tenant-subdomain')?.value;
  const address = document.getElementById('tenant-address')?.value;
  const phone = document.getElementById('tenant-phone')?.value;

  try {
    const res = await api('/api/admin/tenants', 'POST', { name, subdomain, address, phone });
    if (res.success) {
      alert(`Toko '${name}' berhasil dibuat!`);
      if (window.closeModal) {
        window.closeModal('modal-tenant');
        window.closeModal('modal-create-tenant');
      }
      await loadTenantsList();
    } else {
      alert(res.error || 'Gagal membuat toko');
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan.');
  }
};
window.handleCreateTenant = window.handleTenantSubmit;

// Form Handler Tambah User
window.handleUserSubmit = async function(event) {
  if (event) event.preventDefault();
  const name = document.getElementById('user-name')?.value;
  const username = document.getElementById('user-username')?.value;
  const password = document.getElementById('user-password')?.value;
  const role = document.getElementById('user-role')?.value;
  const tenant_id = document.getElementById('user-tenant-id')?.value;

  try {
    const res = await api('/api/admin/users', 'POST', { name, username, password, role, tenant_id });
    if (res.success) {
      alert(`User '${name}' (${role}) berhasil dibuat!`);
      if (window.closeModal) {
        window.closeModal('modal-user');
        window.closeModal('modal-create-user');
      }
      await loadAdminUsersList();
    } else {
      alert(res.error || 'Gagal membuat user');
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan.');
  }
};
window.handleCreateUser = window.handleUserSubmit;

window.impersonateTenant = async function(subdomain) {
  try {
    const res = await api(`/api/admin/impersonate?subdomain=${subdomain}`, 'GET');
    if (res.success && res.target_url) {
      window.location.href = res.target_url;
    } else {
      window.location.href = `https://${subdomain}.gpro.my.id`;
    }
  } catch (err) {
    window.location.href = `https://${subdomain}.gpro.my.id`;
  }
};

// -------------------------------------------------------------------------
// PRODUK & STOK OPNAME
// -------------------------------------------------------------------------
export async function loadAdminProducts() {
  try {
    const res = await api('/api/products', 'GET');
    const products = Array.isArray(res) ? res : (res.data || []);
    state.products = products;
    renderAdminProductsTable(products);
  } catch (err) {
    console.error('Gagal load produk admin:', err);
  }
}

export function renderAdminProductsTable(products) {
  const tbody = document.getElementById('product-table-body') || document.getElementById('admin-products-table-body');
  if (!tbody) return;

  if (!products || products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Belum ada barang terdaftar di toko ini.</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td style="font-family: monospace;">${p.sku || '-'}</td>
      <td><strong>${p.name}</strong></td>
      <td>Rp ${(Number(p.cost_price || 0)).toLocaleString('id-ID')}</td>
      <td>Rp ${(Number(p.price || 0)).toLocaleString('id-ID')}</td>
      <td>
        <span class="badge ${p.stock <= 5 ? 'badge-danger' : 'badge-success'}">
          ${p.stock || 0}
        </span>
      </td>
      <td class="text-right">
        <button class="btn btn-sm btn-outline" onclick="window.openStockAdjustModal('${p.id}')">⚖️ Opname</button>
        <button class="btn btn-sm btn-outline" onclick="window.openStockHistoryModal('${p.id}')">📋 Log</button>
      </td>
    </tr>
  `).join('');
}

window.openStockAdjustModal = function(productId) {
  const product = (state.products || []).find(p => String(p.id) === String(productId));
  if (!product) return;

  const idInput = document.getElementById('adjust-product-id');
  const titleEl = document.getElementById('adjust-modal-title');
  const stockInput = document.getElementById('adjust-current-stock');
  const qtyInput = document.getElementById('adjust-qty');
  const reasonInput = document.getElementById('adjust-reason');
  const typeSelect = document.getElementById('adjust-type');

  if (idInput) idInput.value = product.id;
  if (titleEl) titleEl.textContent = `Sesuaikan Stok: ${product.name}`;
  if (stockInput) stockInput.value = product.stock || 0;
  if (qtyInput) qtyInput.value = '';
  if (reasonInput) reasonInput.value = '';
  if (typeSelect) typeSelect.value = 'ADD';

  if (window.openModal) window.openModal('modal-stock-adjust');
};

window.handleStockAdjustSubmit = async function(event) {
  if (event) event.preventDefault();

  const productId = document.getElementById('adjust-product-id')?.value;
  const currentStock = Number(document.getElementById('adjust-current-stock')?.value || 0);
  const type = document.getElementById('adjust-type')?.value || 'ADD';
  const inputQty = Number(document.getElementById('adjust-qty')?.value || 0);
  const reason = document.getElementById('adjust-reason')?.value || '';

  let diffQty = 0;
  if (type === 'ADD') diffQty = inputQty;
  else if (type === 'SUBTRACT') diffQty = -inputQty;
  else if (type === 'SET') diffQty = inputQty - currentStock;

  if (diffQty === 0) {
    alert('Tidak ada perubahan kuantitas stok.');
    return;
  }

  try {
    const res = await adjustStock(productId, diffQty, reason);
    if (res.success) {
      alert('Stok berhasil diperbarui!');
      if (window.closeModal) window.closeModal('modal-stock-adjust');
      await loadAdminProducts();
    } else {
      alert(res.error || 'Gagal mengubah stok');
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan.');
  }
};

window.openStockHistoryModal = async function(productId) {
  const product = (state.products || []).find(p => String(p.id) === String(productId));
  const titleEl = document.getElementById('history-modal-title');
  if (titleEl) titleEl.textContent = `Riwayat Stok: ${product ? product.name : ''}`;

  const tbody = document.getElementById('stock-history-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center">Memuat riwayat...</td></tr>';

  if (window.openModal) window.openModal('modal-stock-history');

  try {
    const res = await getStockHistory(productId);
    if (!res.success || !res.data || res.data.length === 0) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada riwayat mutasi stok.</td></tr>';
      return;
    }

    if (tbody) {
      tbody.innerHTML = res.data.map(log => {
        const isPositive = log.qty_change > 0;
        const formattedChange = isPositive ? `+${log.qty_change}` : log.qty_change;
        const dateStr = new Date(log.created_at).toLocaleString('id-ID');

        return `
          <tr>
            <td style="font-size: 0.8rem; color: #64748b;">${dateStr}</td>
            <td><span class="badge badge-info">${log.type}</span></td>
            <td style="font-weight: bold; color: ${isPositive ? '#16a34a' : '#dc2626'}">${formattedChange}</td>
            <td style="font-weight: 600;">${log.current_stock}</td>
            <td style="font-size: 0.85rem;">${log.notes || '-'}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Gagal memuat riwayat.</td></tr>';
  }
};

window.renderProductTable = loadAdminProducts;
window.renderAdminProducts = loadAdminProducts;
