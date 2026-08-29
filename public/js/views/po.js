import { state, showToast } from '../state.js';
import { API } from '../api.js';
import { loadProducts, setupPODatalist } from './pos.js';

export function openPOModal() {
  state.poItems = [];
  document.getElementById('po-number-input').value = 'IN-' + new Date().toISOString().slice(2,10).replace(/-/g,'') + '-' + Math.floor(100+Math.random()*900);
  document.getElementById('po-supplier-input').value = '';
  document.getElementById('po-notes-input').value = '';
  document.getElementById('po-search-input').value = '';
  setupPODatalist();
  renderPOTable();
  document.getElementById('po-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('po-search-input').focus(), 150);
}

export function closePOModal() {
  document.getElementById('po-modal').classList.add('hidden');
}

export function handlePOSearch() {
  const inputEl = document.getElementById('po-search-input');
  const keyword = inputEl.value.trim();
  if (!keyword) return;

  window.processBarcodeScanned(keyword, 'PO', 'DROPDOWN');
  inputEl.value = '';
}

export function renderPOTable() {
  const tbody = document.getElementById('po-items-table');
  if (state.poItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-slate-400 text-xs">Belum ada barang di daftar masuk. Pilih dropdown atau scan barcode di atas.</td></tr>`;
  } else {
    tbody.innerHTML = state.poItems.map((item, idx) => `
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="py-2 px-1">
          <div class="font-bold text-slate-800">${item.name}</div>
          <div class="text-[10px] text-slate-400 font-mono">${item.barcode || 'Tanpa Barcode'} ${item.is_new ? '<span class="text-emerald-600 font-bold bg-emerald-50 px-1 rounded">[Baru]</span>' : ''}</div>
        </td>
        <td class="py-2 px-1">
          <input type="number" value="${item.cost_price}" onchange="window.updatePOCost(${idx}, this.value)" class="w-20 p-1 text-xs border border-slate-200 rounded text-right font-medium" />
        </td>
        <td class="py-2 px-1 text-center">
          <input type="number" min="1" value="${item.qty}" onchange="window.updatePOQty(${idx}, this.value)" class="w-16 p-1 text-xs border border-slate-300 rounded text-center font-bold text-emerald-700 bg-white" />
        </td>
        <td class="py-2 px-1 text-center">
          <button onclick="window.removePOItem(${idx})" class="text-rose-500 hover:text-rose-700 font-bold text-sm">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  const totalKinds = state.poItems.length;
  const totalPcs = state.poItems.reduce((acc, item) => acc + item.qty, 0);
  document.getElementById('po-total-summary').innerText = `${totalKinds} Jenis (${totalPcs} Pcs)`;
}

export function updatePOQty(idx, val) {
  state.poItems[idx].qty = Math.max(1, parseInt(val) || 1);
  renderPOTable();
}

export function updatePOCost(idx, val) {
  state.poItems[idx].cost_price = parseFloat(val) || 0;
}

export function removePOItem(idx) {
  state.poItems.splice(idx, 1);
  renderPOTable();
}

export function openNewItemModal(barcodeOrName) {
  document.getElementById('new-prod-barcode').value = barcodeOrName;
  document.getElementById('new-prod-name').value = '';
  document.getElementById('new-prod-cost').value = '';
  document.getElementById('new-prod-price').value = '';
  document.getElementById('new-prod-qty').value = '1';
  document.getElementById('new-item-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('new-prod-name').focus(), 150);
}

export function closeNewItemModal() {
  document.getElementById('new-item-modal').classList.add('hidden');
}

export function addNewProductToPOList() {
  const name = document.getElementById('new-prod-name').value.trim();
  const barcode = document.getElementById('new-prod-barcode').value.trim();
  const cost_price = parseFloat(document.getElementById('new-prod-cost').value) || 0;
  const price = parseFloat(document.getElementById('new-prod-price').value) || 0;
  const unit = document.getElementById('new-prod-unit').value.trim() || 'pcs';
  const qty = parseInt(document.getElementById('new-prod-qty').value) || 1;

  if (!name) {
    showToast('Nama produk wajib diisi!', 'error');
    return;
  }

  state.poItems.push({
    id: null,
    name: name,
    barcode: barcode,
    cost_price: cost_price,
    price: price,
    unit: unit,
    qty: qty,
    is_new: true
  });

  closeNewItemModal();
  document.getElementById('po-search-input').value = '';
  renderPOTable();
  showToast(`${name} berhasil ditambahkan`);
}

export async function submitPurchaseOrder() {
  if (state.poItems.length === 0) {
    showToast('Daftar barang masuk masih kosong!', 'error');
    return;
  }

  const payload = {
    tenant_id: state.tenantId,
    po_number: document.getElementById('po-number-input').value.trim(),
    supplier_name: document.getElementById('po-supplier-input').value.trim(),
    notes: document.getElementById('po-notes-input').value.trim(),
    items: state.poItems
  };

  const btn = document.getElementById('btn-save-po');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

  try {
    const result = await API.submitPO(payload);
    if (result.success) {
      showToast('Barang Masuk Berhasil Disimpan!');
      closePOModal();
      loadProducts();
    } else {
      showToast('Gagal: ' + result.error, 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> <span>Simpan & Update Stok</span>';
  }
}
