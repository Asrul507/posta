import { api } from '../api.js';
import { state } from '../state.js';

let cart = [];

export async function initPOSView() {
  console.log('Inisialisasi Kasir POS Dinamis...');
  renderPOSCart();
  await loadPOSProducts();
  setupPOSEvents();
}

export async function loadPOSProducts() {
  const container = document.getElementById('pos-product-grid');
  if (!container) return;

  try {
    const res = await api('/api/products', 'GET');
    const products = Array.isArray(res) ? res : (res.data || []);
    state.products = products;
    renderPOSGrid(products);
  } catch (err) {
    console.error('Gagal mengambil produk kasir:', err);
    container.innerHTML = '<div class="text-center" style="grid-column: 1/-1; padding: 2rem; color: #ef4444;">Gagal memuat barang. Silakan refresh.</div>';
  }
}

function renderPOSGrid(products) {
  const container = document.getElementById('pos-product-grid');
  if (!container) return;

  if (!products || products.length === 0) {
    container.innerHTML = '<div class="text-center" style="grid-column: 1/-1; padding: 2rem; color: #94a3b8;">Belum ada produk di toko ini.</div>';
    return;
  }

  container.innerHTML = products.map(p => `
    <div class="product-card" onclick="window.addToPOSCart('${p.id}')">
      <div>
        <h4 style="font-size: 0.95rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">${p.name}</h4>
        <div style="color: #2563eb; font-weight: 700; font-size: 0.9rem;">Rp ${(Number(p.price || 0)).toLocaleString('id-ID')}</div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 0.75rem;">
        <span style="color: ${p.stock <= 0 ? '#ef4444' : '#16a34a'}; font-weight: 600;">Stok: ${p.stock || 0}</span>
        <button type="button" class="btn btn-sm btn-outline" style="padding: 2px 8px;">+ Tambah</button>
      </div>
    </div>
  `).join('');
}

window.addToPOSCart = function(productId) {
  const product = (state.products || []).find(p => String(p.id) === String(productId));
  if (!product) return;

  const existing = cart.find(i => String(i.id) === String(productId));
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price || 0),
      qty: 1
    });
  }
  renderPOSCart();
};

window.updatePOSQty = function(productId, delta) {
  const item = cart.find(i => String(i.id) === String(productId));
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(i => String(i.id) !== String(productId));
  }
  renderPOSCart();
};

window.clearPOSCart = function() {
  cart = [];
  renderPOSCart();
};

function renderPOSCart() {
  const container = document.getElementById('pos-cart-items');
  const totalEl = document.getElementById('pos-total-amount');
  const payBtn = document.getElementById('btn-checkout-pos');

  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  if (totalEl) totalEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;
  if (payBtn) payBtn.disabled = cart.length === 0;

  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = '<div class="text-center" style="padding: 2rem; color: #94a3b8;">Keranjang kosong</div>';
    return;
  }

  container.innerHTML = cart.map(item => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
      <div>
        <div style="font-weight: 600; font-size: 0.85rem; color: #1e293b;">${item.name}</div>
        <div style="font-size: 0.75rem; color: #64748b;">Rp ${item.price.toLocaleString('id-ID')} x ${item.qty}</div>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <button type="button" class="btn btn-sm btn-secondary" onclick="window.updatePOSQty('${item.id}', -1)">-</button>
        <span style="font-weight: 700; font-size: 0.85rem;">${item.qty}</span>
        <button type="button" class="btn btn-sm btn-secondary" onclick="window.updatePOSQty('${item.id}', 1)">+</button>
      </div>
    </div>
  `).join('');
}

window.handleCheckoutPOS = async function() {
  if (cart.length === 0) return;

  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const paymentMethod = document.getElementById('pos-payment-method')?.value || 'CASH';

  try {
    const payload = {
      items: cart.map(i => ({ productId: i.id, quantity: i.qty, price: i.price })),
      totalAmount: total,
      paymentMethod
    };

    const res = await api('/api/checkout', 'POST', payload);
    if (res.success) {
      alert(`Transaksi Sukses! Total: Rp ${total.toLocaleString('id-ID')}`);
      window.clearPOSCart();
      await loadPOSProducts();
    } else {
      alert(res.error || 'Gagal memproses transaksi');
    }
  } catch (err) {
    alert('Terjadi kesalahan koneksi.');
  }
};

function setupPOSEvents() {
  const searchInput = document.getElementById('pos-search-input');
  if (searchInput) {
    searchInput.oninput = (e) => {
      const q = e.target.value.toLowerCase();
      const matched = (state.products || []).filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) || 
        (p.sku && p.sku.toLowerCase().includes(q))
      );
      renderPOSGrid(matched);
    };
  }
}

window.initPOSView = initPOSView;
window.loadPOSProducts = loadPOSProducts;
