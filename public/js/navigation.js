export function toggleSidebar(show) {
  const sidebar = document.getElementById('sidebar-drawer');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar || !backdrop) return;

  if (show === undefined) {
    sidebar.classList.toggle('-translate-x-full');
    backdrop.classList.toggle('hidden');
  } else if (show) {
    sidebar.classList.remove('-translate-x-full');
    backdrop.classList.remove('hidden');
  } else {
    sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
  }
}

export function toggleMobileCartDrawer(show) {
  const drawer = document.getElementById('mobile-cart-drawer');
  if (!drawer) return;
  if (show === undefined) {
    drawer.classList.toggle('hidden');
  } else if (show) {
    drawer.classList.remove('hidden');
  } else {
    drawer.classList.add('hidden');
  }
}

export function switchView(viewName) {
  const views = [
    'view-pos',
    'view-products',
    'view-history',
    'view-po-history',
    'view-daily-report',
    'view-monthly-report'
  ];

  // Sembunyikan semua section view
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  // Tampilkan view target dan panggil fungsinya
  if (viewName === 'POS') {
    document.getElementById('view-pos')?.classList.remove('hidden');
  } else if (viewName === 'PRODUCTS') {
    document.getElementById('view-products')?.classList.remove('hidden');
    if (typeof window.loadMasterProducts === 'function') window.loadMasterProducts();
  } else if (viewName === 'HISTORY') {
    document.getElementById('view-history')?.classList.remove('hidden');
    if (typeof window.fetchTransactions === 'function') window.fetchTransactions();
  } else if (viewName === 'PO_HISTORY') {
    document.getElementById('view-po-history')?.classList.remove('hidden');
    if (typeof window.fetchPOHistory === 'function') window.fetchPOHistory();
  } else if (viewName === 'DAILY_REPORT') {
    document.getElementById('view-daily-report')?.classList.remove('hidden');
    if (typeof window.loadDailyReport === 'function') window.loadDailyReport();
  } else if (viewName === 'MONTHLY_REPORT') {
    document.getElementById('view-monthly-report')?.classList.remove('hidden');
    if (typeof window.loadMonthlyReport === 'function') window.loadMonthlyReport();
  }
}
