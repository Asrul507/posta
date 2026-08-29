import { state, formatRupiah, showToast } from '../state.js';
import { API } from '../api.js';
import { checkAuthSession } from './auth.js';

// =========================================================================
// 1. INISIALISASI SESI TOKO & LOGIN
// =========================================================================
export async function initTenantSession() {
  try {
    const res = await fetch('/api/tenant/info');
    const result = await res.json();

    if (!result.success) {
      showToast(result.error || 'Toko tidak terdaftar', 'error');
      document.body.innerHTML = `
        <div class="h-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center font-sans text-slate-100">
          <div class="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center text-2xl mb-4 font-bold border border-rose-500/30">!</div>
          <h1 class="text-xl font-black mb-1">Toko Tidak Ditemukan</h1>
          <p class="text-xs text-slate-400 max-w-sm mb-4">${result.error}</p>
          <a href="https://posta.gpro.my.id" class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg">Kembali ke Portal Hub</a>
        </div>
      `;
      return false;
    }

    state.tenantId = result.is_admin ? 'admin' : result.data.id;
    state.tenantInfo = result.is_admin ? { id: 'admin', is_admin: true } : { ...result.data, is_admin: false };

    // Cek Autentikasi / Sesi Login User
    const isAuthed = await checkAuthSession(state.tenantInfo);
    if (!isAuthed) return false;

    // Jika yang diakses adalah portal Superadmin (posta.gpro.my.id)
    if (result.is_admin) {
      const viewPos = document.getElementById('view-pos');
      const bottomNav = document.querySelector('nav');
      const header = document.querySelector('header');
      const mobileBar = document.getElementById('mobile-checkout-bar');
      const adminView = document.getElementById('view-admin-portal');

      if (viewPos) viewPos.classList.add('hidden');
      if (bottomNav) bottomNav.classList.add('hidden');
      if (header) header.classList.add('hidden');
      if (mobileBar) mobileBar.classList.add('hidden');

      if (adminView) {
        adminView.classList.remove('hidden');
        if (typeof window.loadAdminTenants === 'function') {
          window.loadAdminTenants();
        }
      }
      return false;
    }

    // Update label nama toko di header dan sidebar
    const storeSubtitles = document.querySelectorAll('#page-title + span, #sidebar-drawer .font-bold.text-slate-800');
    storeSubtitles.forEach(el => {
      el.innerText = result.data.name;
    });

    return true;
  } catch (err) {
    showToast('Gagal memuat sesi toko.', 'error');
    return false;
  }
}

// =========================================================================
// 2. MUAT PRODUK TOKO
// =========================================================================
export async function loadProducts() {
  if (!state.tenantId) {
    const ok = await initTenantSession();
    if (!ok) return;
  }

  const grid = document.getElementById('product-grid');
  try {
    const result = await API.getProducts();
    if (result.success && result.data && result.data.length > 0) {
      state.products = result.data;
      renderCategories();
      renderProductGrid();
      renderProductTable();
      setupPODatalist();
    } else {
      if (grid) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 text-sm">Belum ada produk aktif di toko ini.</div>`;
      }
    }
  } catch (err) {
    if (grid) {
      grid.innerHTML = `<div class="col-span-full py-12 text-center text-rose-500 text-sm font-medium">Gagal memuat katalog barang.</div>`;
    }
  }
}

// =========================================================================
// 3. KATEGORI PRODUK
// =========================================================================
export function renderCategories() {
  const container = document.getElementById('category-container');
  if (!container) return;

  const categories = ['ALL', ...new Set(state.products.map(p => p.category_name).filter(Boolean))];
  container.innerHTML = categories.map(cat => `
    <button onclick="window.filterCategory('${cat}')" 
      class="cat-btn px-3 py-1.5 rounded-lg text-xs font-semibold ${state.selectedCategory === cat ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} shrink-0">
      ${cat === 'ALL' ? 'Semua' : cat}
    </button>
  `).join('');
}

export function filterCategory(cat) {
  state.selectedCategory = cat;
  renderCategories();
  renderProductGrid();
}

// =========================================================================
// 4. GRID KATALOG KASIR
// =========================================================================
export function renderProductGrid() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  const keyword = (document.getElementById('search-input')?.value || '').toLowerCase();
  const filtered = state.products.filter(p => {
    const matchCat = state.selectedCategory === 'ALL' || p.category_name === state.selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(keyword) || (p.barcode && String(p.barcode).toLowerCase().includes(keyword));
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400 text-xs">Produk tidak ditemukan</div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div onclick="window.addToCart('${p.id}')" class="p-3 bg-white rounded-xl border border-slate-200 hover:border-emerald-500 transition-all flex flex-col justify-between shadow-sm cursor-pointer active:scale-95">
      <div>
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">${p.category_name || 'Umum'}</span>
        <h4 class="font-semibold text-xs text-slate-800 line-clamp-2 mt-0.5">${p.name}</h4>
      </div>
      <div class="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
        <span class="font-bold text-xs text-emerald-600 block">${formatRupiah(p.price)}</span>
        <span class="text-[10px] font-medium text-slate-500">Stok: <b class="${p.stock <= 3 ? 'text-rose-500' : 'text-slate-700'}">${p.stock}</b></span>
      </div>
    </div>
  `).join('');
}

// =========================================================================
// 5. TABEL MASTER PRODUK (Dibutuhkan oleh navigation.js)
// =========================================================================
export function renderProductTable() {
  const tbody = document.getElementById('master-products-tbody');
  if (!tbody) return;

  const keyword = (document.getElementById('prod-table-search')?.value || '').toLowerCase();
  const filtered = state.products.filter(p => 
    p.name.toLowerCase().includes(keyword) || 
    (p.barcode && String(p.barcode).toLowerCase().includes(keyword)) ||
    (p.category_name && p.category_name.toLowerCase().includes(keyword))
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400">Tidak ada produk yang cocok.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => `
    <tr class="hover:bg-slate-50">
      <td class="py-2.5 px-3 font-mono text-slate-500 font-bold">${p.barcode || '-'}</td>
      <td class="py-2.5 px-3 font-bold text-slate-800">${p.name}</td>
      <td class="py-2.5 px-3 text-slate-600"><span class="bg-slate-100 px-2 py-0.5 rounded-md">${p.category_name || 'Umum'}</span></td>
      <td class="py-2.5 px-3 text-right text-slate-600">${formatRupiah(p.cost_price || 0)}</td>
      <td class="py-2.5 px-3 text-right font-bold text-emerald-600">${formatRupiah(p.price)}</td>
      <td class="py-2.5 px-3 text-center">
        <span class="px-2 py-0.5 rounded-full font-bold ${p.stock <= 3 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}">
          ${p.stock} ${p.unit || 'pcs'}
        </span>
      </td>
    </tr>
  `).join('');
}

// =========================================================================
// 6. SETUP DATALIST PO
// =========================================================================
export function setupPODatalist() {
  const datalist = document.getElementById('master-products-datalist');
  if (!datalist) return;
  datalist.innerHTML = state.products.map(p => `
    <option value="${p.barcode || p.name}">[${p.barcode || 'NO-BARCODE'}] ${p.name} - Stok: ${p.stock}</option>
  `).join('');
}

// =========================================================================
// 7. KERANJANG BELANJA KASIR
// =========================================================================
export function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product || product.stock <= 0) {
    showToast("Stok produk habis!", "error");
    return;
  }

  const existing = state.cart.find(c => c.id === productId);
  if (existing) {
    if (existing.qty < product.stock) {
      existing.qty += 1;
    } else {
      showToast(`Stok ${product.name} hanya ada ${product.stock}`, "error");
    }
  } else {
    state.cart.push({ ...product, qty: 1 });
  }
  updateCartUI();
}

export function updateCartUI() {
  const listDesktop = document.getElementById('cart-list');
  const listMobile = document.getElementById('mobile-cart-items-list');
  const totalQty = state.cart.reduce((acc, item) => acc + item.qty, 0);
  const totalPrice = state.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  const renderItemHtml = (item) => `
    <div class="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50 gap-2">
      <div class="flex-1 min-w-0">
        <h5 class="text-xs font-semibold text-slate-800 truncate">${item.name}</h5>
        <span class="text-xs text-emerald-600 font-bold">${formatRupiah(item.price)}</span>
      </div>
      <div class="flex items-center gap-1">
        <button onclick="window.updateQty('${item.id}', -1)" class="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 text-xs font-bold">-</button>
        <input type="number" min="1" value="${item.qty}" onchange="window.setDirectCartQty('${item.id}', this.value)" class="w-10 text-center text-xs font-bold bg-white border border-slate-300 rounded p-0.5" />
        <button onclick="window.updateQty('${item.id}', 1)" class="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 text-xs font-bold">+</button>
        <button onclick="window.removeCartItem('${item.id}')" class="text-rose-500 hover:text-rose-700 ml-1 text-xs">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `;

  if (listDesktop) {
    listDesktop.innerHTML = state.cart.length === 0 
      ? `<div class="text-center py-12 text-slate-400 text-xs">Keranjang masih kosong</div>` 
      : state.cart.map(renderItemHtml).join('');
  }

  if (listMobile) {
    listMobile.innerHTML = state.cart.length === 0 
      ? `<div class="text-center py-4 text-slate-400 text-xs">Belum ada barang dipilih</div>` 
      : state.cart.map(renderItemHtml).join('');
  }

  const elTotalQty = document.getElementById('cart-total-qty');
  if (elTotalQty) elTotalQty.innerText = totalQty;

  const elTotalPrice = document.getElementById('cart-total-price');
  if (elTotalPrice) elTotalPrice.innerText = formatRupiah(totalPrice);

  const elBottomBadge = document.getElementById('bottom-cart-badge');
  if (elBottomBadge) elBottomBadge.innerText = totalQty;

  const elMobBadge = document.getElementById('mobile-cart-badge');
  if (elMobBadge) elMobBadge.innerText = `${totalQty} item`;

  const elMobTotal = document.getElementById('mobile-cart-total');
  if (elMobTotal) elMobTotal.innerText = formatRupiah(totalPrice);

  const hasItems = state.cart.length > 0;
  const btnCheckout = document.getElementById('btn-checkout');
  if (btnCheckout) btnCheckout.disabled = !hasItems;

  const mobBtn = document.getElementById('mobile-btn-checkout');
  if (mobBtn) mobBtn.disabled = !hasItems;
}

export function updateQty(productId, delta) {
  const item = state.cart.find(c => c.id === productId);
  const product = state.products.find(p => p.id === productId);
  if (!item || !product) return;
  const targetQty = item.qty + delta;
  if (targetQty > product.stock) {
    showToast(`Stok ${product.name} sisa ${product.stock}`, 'error');
    return;
  }
  if (targetQty <= 0) {
    state.cart = state.cart.filter(c => c.id !== productId);
  } else {
    item.qty = targetQty;
  }
  updateCartUI();
}

export function setDirectCartQty(productId, newQty) {
  const item = state.cart.find(c => c.id === productId);
  const product = state.products.find(p => p.id === productId);
  if (!item || !product) return;

  let qty = parseInt(newQty) || 1;
  if (qty > product.stock) {
    qty = product.stock;
    showToast(`Maksimum stok ${product.name} adalah ${product.stock}`, 'error');
  }
  if (qty <= 0) {
    state.cart = state.cart.filter(c => c.id !== productId);
  } else {
    item.qty = qty;
  }
  updateCartUI();
}

export function removeCartItem(productId) {
  state.cart = state.cart.filter(c => c.id !== productId);
  updateCartUI();
}

export function clearCart() {
  state.cart = [];
  updateCartUI();
}
