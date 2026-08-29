import { renderProductTable } from './views/pos.js';
import { fetchTransactions, fetchPOHistory } from './views/reports.js';

export function toggleSidebar(open = true) {
  const drawer = document.getElementById('sidebar-drawer');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (open) {
    backdrop.classList.remove('hidden');
    drawer.classList.remove('-translate-x-full');
  } else {
    drawer.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
  }
}

export function toggleMobileCartDrawer(forceState = null) {
  const drawer = document.getElementById('mobile-cart-drawer');
  if (forceState === false) {
    drawer.classList.add('hidden');
    return;
  }
  drawer.classList.toggle('hidden');
}

export function switchView(viewName) {
  document.getElementById('view-pos').classList.add('hidden');
  document.getElementById('view-products').classList.add('hidden');
  document.getElementById('view-history').classList.add('hidden');
  document.getElementById('view-po-history').classList.add('hidden');

  const pageTitle = document.getElementById('page-title');
  const backPosBtn = document.getElementById('header-back-pos-btn');
  const bottomPosNav = document.getElementById('bottom-nav-pos');
  const mobileCheckoutBar = document.getElementById('mobile-checkout-bar');

  if (viewName === 'POS') {
    document.getElementById('view-pos').classList.remove('hidden');
    if (mobileCheckoutBar) mobileCheckoutBar.classList.remove('hidden');
    pageTitle.innerText = "Posta POS";
    backPosBtn.classList.add('hidden');
    bottomPosNav.className = "flex flex-col items-center gap-1 text-emerald-400 transition flex-1";
  } else {
    if (mobileCheckoutBar) mobileCheckoutBar.classList.add('hidden');
    backPosBtn.classList.remove('hidden');
    bottomPosNav.className = "flex flex-col items-center gap-1 text-slate-400 hover:text-emerald-400 transition flex-1";

    if (viewName === 'PRODUCTS') {
      document.getElementById('view-products').classList.remove('hidden');
      pageTitle.innerText = "Master Produk";
      renderProductTable();
    } else if (viewName === 'HISTORY') {
      document.getElementById('view-history').classList.remove('hidden');
      pageTitle.innerText = "Riwayat Transaksi Kasir";
      fetchTransactions();
    } else if (viewName === 'PO_HISTORY') {
      document.getElementById('view-po-history').classList.remove('hidden');
      pageTitle.innerText = "Riwayat Barang Masuk";
      fetchPOHistory();
    }
  }
}
