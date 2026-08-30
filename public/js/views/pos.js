import { api } from '../api.js';
import { state } from '../state.js';

let cart = [];
let currentCategory = 'all';

export async function initPOSView() {
  console.log('Inisialisasi POS View...');
  cart = [];
  renderCart();
  await loadPOSProducts();
  setupPOSEvents();
}

export async function loadPOSProducts() {
  const container = document.getElementById('pos-product-grid') || document.getElementById('product-grid') || document.querySelector('.product-grid');
  
  try {
    const res = await api('/api/products', 'GET');
    const products = Array.isArray(res) ? res : (res.data || []);
    state.products = products;

    if (!container) {
      // Jika grid belum ketemu, coba cari kontainer dengan teks loading
      const loadingEl = Array.from(document.querySelectorAll('div, p')).find(el => el.textContent.includes('Memuat katalog barang'));
      if (loadingEl && loadingEl.parentElement) {
        renderProductsToElement(loadingEl.parentElement, products);
      }
      return;
    }

    renderProductsToElement(container, products);
  } catch (err) {
    console.error('Gagal memuat produk POS:', err);
    if (container) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:#ef4444;">Gagal memuat katalog barang. Silakan refresh.</div>';
    }
  }
}

function renderProductsToElement(container, products) {
  if (!products || products.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:2rem; color:#6b7280;">Belum ada barang di katalog toko ini.</div>';
    return;
  }

  const filtered = currentCategory === 'all' 
    ? products 
    : products.filter(p => (p.category || 'Umum') === currentCategory);

  container.innerHTML = filtered.map(p => `
    <div class="product-card" onclick="window.addToCart('${p.id}')" style="cursor: pointer;">
      <div class="product-info">
        <h4 class="product-name">${p.name}</h4>
        <div class="product-price">Rp ${(Number(p.price || 0)).toLocaleString('id-ID')}</div>
        <small class="product-stock" style="color: ${p.stock <= 0 ? '#ef4444' : '#10b981'}">
          Stok: ${p.stock || 0}
        </small>
      </div>
    </div>
  `).join('');
}

// -------------------------------------------------------------------------
// CART & TRANSAKSI KASIR
// -------------------------------------------------------------------------
window.addToCart = function(productId) {
  const product = (state.products || []).find(p => String(p.id) === String(productId));
  if (!product) return;

  const existing = cart.find(item => String(item.id) === String(productId));
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
  renderCart();
};

window.updateCartQty = function(productId, delta) {
  const item = cart.find(item => String(item.id) === String(productId));
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(i => String(i.id) !== String(productId));
  }
  renderCart();
};

function renderCart() {
  const cartContainer = document.getElementById('cart-items') || document.getElementById('pos-cart-items');
  const totalEl = document.getElementById('cart-total-amount') || document.getElementById('pos-total');
  const payBtn = document.getElementById('btn-pay') || document.getElementById('btn-checkout');

  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  if (totalEl) {
    totalEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;
  }

  if (payBtn) {
    payBtn.disabled = cart.length === 0;
  }

  if (!cartContainer) return;

  if (cart.length === 0) {
    cartContainer.innerHTML = '<div style="text-align:center; padding:1.5rem; color:#9ca3af;">Keranjang kosong</div>';
    return;
  }

  cartContainer.innerHTML = cart.map(item => `
    <div class="cart-item" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <div>
        <div style="font-weight: 600;">${item.name}</div>
        <small>Rp ${item.price.toLocaleString('id-ID')} x ${item.qty}</small>
      </div>
      <div style="display: flex; gap: 6px; align-items: center;">
        <button class="btn btn-sm" onclick="window.updateCartQty('${item.id}', -1)">-</button>
        <span>${item.qty}</span>
        <button class="btn btn-sm" onclick="window.updateCartQty('${item.id}', 1)">+</button>
      </div>
    </div>
  `).join('');
}

// -------------------------------------------------------------------------
// PROSES PEMBAYARAN KASIR
// -------------------------------------------------------------------------
window.handleCheckoutPOS = async function() {
  if (cart.length === 0) {
    alert('Keranjang belanja masih kosong!');
    return;
  }

  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const paymentMethod = document.getElementById('payment-method')?.value || 'CASH';

  try {
    const payload = {
      items: cart.map(i => ({ productId: i.id, quantity: i.qty, price: i.price })),
      totalAmount: total,
      paymentMethod: paymentMethod
    };

    const res = await api('/api/checkout', 'POST', payload);
    if (res.success) {
      alert('Pembayaran berhasil!');
      cart = [];
      renderCart();
      await loadPOSProducts();
      if (window.closeModal) window.closeModal('modal-checkout');
    } else {
      alert(res.error || 'Pembayaran gagal');
    }
  } catch (err) {
    console.error(err);
    alert('Gagal memproses pembayaran ke server.');
  }
};

function setupPOSEvents() {
  const searchInput = document.getElementById('search-product') || document.querySelector('input[type="search"]');
  if (searchInput) {
    searchInput.oninput = (e) => {
      const q = e.target.value.toLowerCase();
      const matched = (state.products || []).filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) || 
        (p.sku && p.sku.toLowerCase().includes(q))
      );
      const container = document.getElementById('pos-product-grid') || document.getElementById('product-grid') || document.querySelector('.product-grid');
      if (container) renderProductsToElement(container, matched);
    };
  }
}

// Window bindings
window.initPOSView = initPOSView;
window.loadPOSProducts = loadPOSProducts;
window.handleCheckoutPOS = handleCheckoutPOS;
