import { state, formatRupiah, showToast } from '../state.js';
import { api } from '../api.js';
import { loadProducts } from './pos.js';

let poCart = [];

// =========================================================================
// 1. MODAL KONTROL PO (BARANG MASUK)
// =========================================================================
export function openPOModal() {
  const modal = document.getElementById('po-modal');
  if (modal) {
    modal.classList.remove('hidden');
    // Generate nomor PO otomatis
    const autoNumber = 'PO-' + Date.now().toString().slice(-6);
    const inputNo = document.getElementById('po-number-input');
    if (inputNo) inputNo.value = autoNumber;

    poCart = [];
    renderPOTable();
  }
}

export function closePOModal() {
  const modal = document.getElementById('po-modal');
  if (modal) modal.classList.add('hidden');
  poCart = [];
}

// =========================================================================
// 2. SEARCH & TAMBAH BARANG KE PO (Termasuk Handler Barcode)
// =========================================================================
export function handlePOSearch() {
  const input = document.getElementById('po-search-input');
  if (!input) return;

  const query = input.value.trim().toLowerCase();
  if (!query) {
    showToast('Ketik nama atau barcode barang!', 'error');
    return;
  }

  const product = state.products.find(p =>
    (p.barcode && p.barcode.toLowerCase() === query) ||
    p.name.toLowerCase().includes(query) ||
    p.id === query
  );

  if (product) {
    addPOItem(product);
    input.value = '';
    input.focus();
  } else {
    showToast(`Barang '${query}' tidak ditemukan di master produk!`, 'error');
  }
}

// Dipanggil dari scanner.js saat barcode terdeteksi kamera
export function handleAddPOByBarcode(barcode) {
  if (!barcode) return;
  const product = state.products.find(p => p.barcode === barcode || String(p.id) === barcode);

  if (product) {
    addPOItem(product);
    showToast(`PO: +1 ${product.name}`);

    const lastItemEl = document.getElementById('scanner-last-item');
    if (lastItemEl) {
      lastItemEl.innerHTML = `<span class="text-emerald-400 font-bold">${product.name}</span> (Masuk PO)`;
    }
  } else {
    showToast(`Barcode ${barcode} tidak ada di database master!`, 'error');
  }
}

export function addPOItem(product) {
  const existing = poCart.find(item => item.id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    poCart.push({
      id: product.id,
      barcode: product.barcode || '-',
      name: product.name,
      cost_price: product.cost_price || 0,
      price: product.price || 0,
      qty: 1,
      is_new: false
    });
  }
  renderPOTable();
}

// =========================================================================
// 3. RENDER TABEL BARANG MASUK DI MODAL
// =========================================================================
export function renderPOTable() {
  const tbody = document.getElementById('po-items-table');
  const summaryEl = document.getElementById('po-total-summary');
  if (!tbody) return;

  if (poCart.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-slate-400 text-xs">Belum ada barang di daftar masuk.</td></tr>`;
    if (summaryEl) summaryEl.innerText = '0 Jenis (0 Pcs)';
    return;
  }

  let totalPcs = 0;

  tbody.innerHTML = poCart.map((item, index) => {
    totalPcs += item.qty;
    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="py-2.5 px-1">
          <div class="font-bold text-slate-800 text-xs">${item.name}</div>
          <div class="text-[10px] text-slate-400 font-mono">${item.barcode}</div>
        </td>
        <td class="py-2.5 px-1">
          <input 
            type="number" 
            min="0" 
            value="${item.cost_price}" 
            onchange="window.updatePOCostPrice(${index}, this.value)"
            class="w-24 p-1 text-xs border border-slate-300 rounded font-semibold text-right"
          />
        </td>
        <td class="py-2.5 px-1 text-center">
          <input 
            type="number" 
            min="1" 
            value="${item.qty}" 
            onchange="window.updatePOQty(${index}, this.value)"
            class="w-16 p-1 text-xs border border-slate-300 rounded font-bold text-center"
          />
        </td>
        <td class="py-2.5 px-1 text-center">
          <button onclick="window.removePOItem(${index})" class="text-rose-500 hover:text-rose-700 text-xs p-1">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (summaryEl) {
    summaryEl.innerText = `${poCart.length} Jenis (${totalPcs} Pcs)`;
  }
}

export function updatePOCostPrice(index, val) {
  if (poCart[index]) {
    poCart[index].cost_price = parseFloat(val) || 0;
  }
}

export function updatePOQty(index, val) {
  if (poCart[index]) {
    poCart[index].qty = Math.max(1, parseInt(val) || 1);
    renderPOTable();
  }
}

export function removePOItem(index) {
  poCart.splice(index, 1);
  renderPOTable();
}

// =========================================================================
// 4. SUBMIT PO KE BACKEND
// =========================================================================
export async function submitPurchaseOrder() {
  if (poCart.length === 0) {
    showToast('Daftar barang masuk masih kosong!', 'error');
    return;
  }

  const poNumber = (document.getElementById('po-number-input')?.value || '').trim();
  const supplier = (document.getElementById('po-supplier-input')?.value || '').trim();
  const notes = (document.getElementById('po-notes-input')?.value || '').trim();

  if (!poNumber) {
    showToast('Nomor dokumen PO wajib diisi!', 'error');
    return;
  }

  const btn = document.getElementById('btn-save-po');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
  }

  try {
    const payload = {
      tenant_id: state.tenantId,
      po_number: poNumber,
      supplier_name: supplier || 'Supplier Umum',
      notes: notes,
      items: poCart
    };

    const result = await api('/api/po/submit', 'POST', payload);

    if (result && result.success) {
      showToast('Barang masuk berhasil disimpan & stok diperbarui!');
      closePOModal();
      loadProducts();
    } else {
      showToast('Gagal: ' + (result?.error || 'Terjadi kesalahan'), 'error');
    }
  } catch (err) {
    console.error('Gagal submit PO:', err);
    showToast('Gagal menyimpan PO (masalah jaringan).', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> <span>Simpan & Update Stok</span>';
    }
  }
}

window.openPOModal = openPOModal;
window.closePOModal = closePOModal;
window.handlePOSearch = handlePOSearch;
window.updatePOCostPrice = updatePOCostPrice;
window.updatePOQty = updatePOQty;
window.removePOItem = removePOItem;
window.submitPurchaseOrder = submitPurchaseOrder;
