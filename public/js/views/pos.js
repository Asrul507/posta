import { api } from '../api.js';
import { state } from '../state.js';

let cart = [];

export async function initPOSView() {
  console.log('Inisialisasi POS Kasir...');
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

    if (!container) return;
    renderProductsToGrid(container, products);
  } catch (err) {
    console.error('Gagal memuat produk POS:', err);
    if (container) {
      container.innerHTML = '<div class="col-span-full text-center p-6 text-red-500">Gagal memuat katalog barang.</div>';
    }
  }
}

function renderProductsToGrid(container, products) {
  if (!products || products.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center p-8 text-gray-400">Belum ada produk di toko ini.</div>';
    return;
  }

  container.innerHTML = products.map(p => `
    <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between" onclick="window.addToCart('${p.id}')">
      <div>
        <h4 class="font-bold text-gray-800 line-clamp-2">${p.name}</h4>
        <div class="text-blue-600 font-bold mt-1">Rp ${(Number(p.price || 0)).toLocaleString('id-ID')}</div>
      </div>
      <div class="mt-3 flex justify-between items-center text-xs">
        <span class="${p.stock <= 0 ? 'text-red-500' : 'text-green-600'} font-semibold">
          Stok: ${p.stock || 0}
        </span>
        <button class="px-2 py-1 bg-blue-50 text-blue-600 rounded font-bold hover:bg-blue-600 hover:text-white transition">+</button>
      </div>
    </div>
  `).join('');
}

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

  if (totalEl) totalEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;
  if (payBtn) payBtn.disabled = cart.length === 0;

  if (!cartContainer) return;

  if (cart.length === 0) {
    cartContainer.innerHTML = '<div class="text-center p-6 text-gray-400">Keranjang kosong</div>';
    return;
  }

  cartContainer.innerHTML = cart.map(item => `
    <div class="flex justify-between items-center p-2 border-b border-gray-100">
      <div>
        <div class="font-semibold text-sm text-gray-800">${item.name}</div>
        <div class="text-xs text-gray-500">Rp ${item.price.toLocaleString('id-ID')} x ${item.qty}</div>
      </div>
      <div class="flex items-center space-x-2">
        <button class="w-6 h-6 bg-gray-100 rounded text-gray-700 hover:bg-gray-200" onclick="window.updateCartQty('${item.id}', -1)">-</button>
        <span class="text-sm font-bold">${item.qty}</span>
        <button class="w-6 h-6 bg-gray-100 rounded text-gray-700 hover:bg-gray-200" onclick="window.updateCartQty('${item.id}', 1)">+</button>
      </div>
    </div>
  `).join('');
}

window.handleCheckoutPOS = async function() {
  if (cart.length === 0) {
    alert('Keranjang belanja kosong!');
    return;
  }

  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const paymentMethod = document.getElementById('payment-method')?.value || 'CASH';

  try {
    const payload = {
      items: cart.map(i => ({ productId: i.id, quantity: i.qty, price: i.price })),
      totalAmount: total,
      paymentMethod
    };

    const res = await api('/api/checkout', 'POST', payload);
    if (res.success) {
      alert('Transaksi berhasil disimpan!');
      cart = [];
      renderCart();
      await loadPOSProducts();
      if (window.closeModal) window.closeModal('modal-checkout');
    } else {
      alert(res.error || 'Checkout gagal');
    }
  } catch (err) {
    alert('Gagal memproses transaksi.');
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
      if (container) renderProductsToGrid(container, matched);
    };
  }
}

window.initPOSView = initPOSView;
window.loadPOSProducts = loadPOSProducts;
window.handleCheckoutPOS = handleCheckoutPOS;
