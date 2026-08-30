import { adjustStock, getStockHistory, api } from '../api.js';
import { state } from '../state.js';

// =========================================================================
// STOCK ADJUSTMENT (OPNAME)
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

      // Refresh data produk terbaru
      const updatedProducts = await api('/api/products', 'GET');
      if (Array.isArray(updatedProducts)) {
        state.products = updatedProducts;
      } else if (updatedProducts.data) {
        state.products = updatedProducts.data;
      }

      // Render ulang tampilan jika fungsinya tersedia
      if (typeof window.renderProductTable === 'function') window.renderProductTable();
      if (typeof window.renderAdminProducts === 'function') window.renderAdminProducts();
    } else {
      alert(res.error || 'Gagal mengubah stok');
    }
  } catch (err) {
    console.error(err);
    alert('Terjadi kesalahan jaringan.');
  }
};

// =========================================================================
// STOCK LOG HISTORY (KARTU STOK)
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
