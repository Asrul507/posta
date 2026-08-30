import { adjustStock, getStockHistory, api } from '../api.js';
import { state } from '../state.js';

// =========================================================================
// INISIALISASI VIEW ADMIN (DIPANGGIL OLEH NAVIGATION.JS)
// =========================================================================
export async function initAdminView() {
  console.log('Inisialisasi Admin View...');
  
  // 1. Cek hak akses jika perlu
  if (state.user && state.user.role === 'KASIR') {
    alert('Akses dibatasi. Hanya untuk Admin/Owner.');
    if (window.navigateTo) window.navigateTo('pos');
    return;
  }

  // 2. Muat data tenant jika superadmin
  if (state.user && state.user.role === 'SUPERADMIN') {
    await loadTenantsList();
  }

  // 3. Muat produk
  await loadAdminProducts();
}

// =========================================================================
// PRODUK & MANAJEMEN STOK
// =========================================================================
export async function loadAdminProducts() {
  try {
    const res = await api('/api/products', 'GET');
    const products = Array.isArray(res) ? res : (res.data || []);
    state.products = products;
    renderAdminProductsTable(products);
  } catch (err) {
    console.error('Gagal memuat produk admin:', err);
  }
}

function renderAdminProductsTable(products) {
  const tbody = document.getElementById('product-table-body') || document.getElementById('admin-products-table-body');
  if (!tbody) return;

  if (!products || products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Belum ada data produk.</td></tr>';
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
        <button class="btn btn-sm btn-outline" onclick="window.openStockAdjustModal('${p.id}')" title="Opname Stok">
          ⚖️ Opname
        </button>
        <button class="btn btn-sm btn-outline" onclick="window.openStockHistoryModal('${p.id}')" title="Log Stok">
          📋 Riwayat
        </button>
      </td>
    </tr>
  `).join('');
}

// =========================================================================
// MODAL STOK OPNAME / ADJUSTMENT
// =========================================================================
window.openStockAdjustModal = function(productId) {
  const productList = state.products || [];
  const product = productList.find(p => String(p.id) === String(productId));
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

  if (typeof window.openModal === 'function') {
    window.openModal('modal-stock-adjust');
  }
};

window.handleStockAdjustSubmit = async function(event) {
  if (event) event.preventDefault();

  const productId = document.getElementById('adjust-product-id')?.value;
  const currentStock = Number(document.getElementById('adjust-current-stock')?.value || 0);
  const type = document.getElementById('adjust-type')?.value || 'ADD';
  const inputQty = Number(document.getElementById('adjust-qty')?.value || 0);
  const reason = document.getElementById('adjust-reason')?.value || '';

  let diffQty = 0;
  if (type === 'ADD') {
    diffQty = inputQty;
  } else if (type === 'SUBTRACT') {
    diffQty = -inputQty;
  } else if (type === 'SET') {
    diffQty = inputQty - currentStock;
  }

  if (diffQty === 0) {
    alert('Tidak ada perubahan kuantitas stok.');
    return;
  }

  try {
    const res = await adjustStock(productId, diffQty, reason);
    if (res.success) {
      alert('Stok berhasil diperbarui!');
      if (typeof window.closeModal === 'function') {
        window.closeModal('modal-stock-adjust');
      }
      await loadAdminProducts();
    } else {
      alert(res.error || 'Gagal mengubah stok');
    }
  } catch (err) {
    console.error(err);
    alert('Terjadi kesalahan jaringan.');
  }
};

// =========================================================================
// MODAL RIWAYAT MUTASI KARTU STOK
// =========================================================================
window.openStockHistoryModal = async function(productId) {
  const productList = state.products || [];
  const product = productList.find(p => String(p.id) === String(productId));

  const titleEl = document.getElementById('history-modal-title');
  if (titleEl) titleEl.textContent = `Riwayat Stok: ${product ? product.name : ''}`;

  const tbody = document.getElementById('stock-history-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center">Memuat riwayat...</td></tr>';

  if (typeof window.openModal === 'function') {
    window.openModal('modal-stock-history');
  }

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
            <td>${dateStr}</td>
            <td><span class="badge badge-info">${log.type}</span></td>
            <td style="font-weight: bold; color: ${isPositive ? '#10b981' : '#ef4444'}">${formattedChange}</td>
            <td>${log.current_stock}</td>
            <td>${log.notes || '-'}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error(err);
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Gagal memuat log stok.</td></tr>';
  }
};

// =========================================================================
// MANAJEMEN TENANT & USER (SUPERADMIN)
// =========================================================================
async function loadTenantsList() {
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
        <td>${t.subdomain}.gpro.my.id</td>
        <td>${t.total_products || 0} Produk</td>
        <td>${t.total_transactions || 0} Trx</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="window.impersonateTenant('${t.subdomain}')">Masuk Toko</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Gagal mengambil daftar tenant:', err);
  }
}

window.impersonateTenant = async function(subdomain) {
  try {
    const res = await api(`/api/admin/impersonate?subdomain=${subdomain}`, 'GET');
    if (res.success && res.target_url) {
      window.location.href = res.target_url;
    } else {
      alert(res.error || 'Gagal impersonate tenant');
    }
  } catch (err) {
    alert('Gagal membuka toko tujuan.');
  }
};

// Aliases untuk kompatibilitas global
window.renderProductTable = loadAdminProducts;
window.renderAdminProducts = loadAdminProducts;
