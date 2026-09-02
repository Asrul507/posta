import { state, showToast } from '../state.js';
import { api } from '../api.js';
import { loadProducts } from './pos.js';

let productModalContext = 'MASTER'; // 'MASTER' | 'PO'
let editingProductId = null;

export function openAddProductModal(context = 'MASTER', prefillBarcode = '') {
  productModalContext = context;
  editingProductId = null;

  document.getElementById('product-modal-title').innerText = 'Tambah Produk Baru';
  document.getElementById('product-barcode-input').value = prefillBarcode || '';
  document.getElementById('product-name-input').value = '';
  document.getElementById('product-category-input').value = '';
  document.getElementById('product-cost-input').value = '';
  document.getElementById('product-price-input').value = '';
  document.getElementById('product-stock-input').value = '0';
  document.getElementById('product-unit-input').value = 'pcs';
  document.getElementById('product-delete-btn')?.classList.add('hidden');

  document.getElementById('product-modal')?.classList.remove('hidden');

  if (context === 'PO') {
    showToast('Barcode belum terdaftar. Lengkapi data produk baru di bawah ini.', 'error');
    document.getElementById('product-name-input')?.focus();
  }
}

export function openEditProductModal(id) {
  const p = (state.products || []).find((x) => x.id === id);
  if (!p) return;

  productModalContext = 'MASTER';
  editingProductId = id;

  document.getElementById('product-modal-title').innerText = 'Ubah Data Produk';
  document.getElementById('product-barcode-input').value = p.barcode || '';
  document.getElementById('product-name-input').value = p.name || '';
  document.getElementById('product-category-input').value = p.category_name || p.category || '';
  document.getElementById('product-cost-input').value = p.cost_price || 0;
  document.getElementById('product-price-input').value = p.price ?? p.selling_price ?? 0;
  document.getElementById('product-stock-input').value = p.stock || 0;
  document.getElementById('product-unit-input').value = p.unit || 'pcs';
  document.getElementById('product-delete-btn')?.classList.remove('hidden');

  document.getElementById('product-modal')?.classList.remove('hidden');
}

export function closeProductModal() {
  document.getElementById('product-modal')?.classList.add('hidden');
  productModalContext = 'MASTER';
  editingProductId = null;
}

export async function submitProductForm() {
  const name = document.getElementById('product-name-input').value.trim();
  const barcode = document.getElementById('product-barcode-input').value.trim();
  const category = document.getElementById('product-category-input').value.trim();
  const cost_price = parseFloat(document.getElementById('product-cost-input').value) || 0;
  const selling_price = parseFloat(document.getElementById('product-price-input').value) || 0;
  const stock = parseFloat(document.getElementById('product-stock-input').value) || 0;
  const unit = document.getElementById('product-unit-input').value.trim() || 'pcs';

  if (!name) {
    showToast('Nama produk wajib diisi!', 'error');
    return;
  }

  const btn = document.getElementById('btn-save-product');
  if (btn) btn.disabled = true;

  const wasPOContext = productModalContext === 'PO';

  try {
    const payload = {
      name,
      barcode: barcode || null,
      category: category || null,
      cost_price,
      selling_price,
      stock,
      unit,
    };

    let result;
    if (editingProductId) {
      result = await api.put(`/api/products/${editingProductId}`, payload);
    } else {
      result = await api.post('/api/products', payload);
    }

    if (result.success) {
      showToast(result.message || 'Produk berhasil disimpan.');
      const newProductId = result.data?.id;
      closeProductModal();
      await loadProducts();

      // Jika produk baru ditambahkan lewat form barang masuk, langsung masukkan ke keranjang PO.
      if (wasPOContext && newProductId && typeof window.addPOItem === 'function') {
        const fresh = (state.products || []).find((p) => p.id === newProductId);
        if (fresh) window.addPOItem(fresh);
      }
    } else {
      showToast(result.error || 'Gagal menyimpan produk.', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Terjadi kesalahan jaringan.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

export async function deleteProduct() {
  if (!editingProductId) return;
  const p = (state.products || []).find((x) => x.id === editingProductId);
  if (!p) return;

  if (!window.confirm(`Hapus produk "${p.name}" dari master data?`)) return;

  try {
    const result = await api.delete(`/api/products/${editingProductId}`);
    if (result.success) {
      showToast('Produk berhasil dihapus.');
      closeProductModal();
      loadProducts();
    } else {
      showToast(result.error || 'Gagal menghapus produk.', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Terjadi kesalahan jaringan.', 'error');
  }
}
