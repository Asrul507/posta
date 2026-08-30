// public/js/loader.js

const COMPONENTS = [
  { id: 'header-container', file: 'header.html' },
  { id: 'sidebar-container', file: 'sidebar.html' },
  { id: 'view-admin', file: 'view-admin.html', isView: true },
  { id: 'view-pos', file: 'view-pos.html', isView: true },
  { id: 'view-products', file: 'view-products.html', isView: true },
  { id: 'view-history', file: 'view-history.html', isView: true },
  { id: 'view-reports', file: 'view-reports.html', isView: true },
  { id: 'modals-container', file: 'modals.html' },
  { id: 'login-container', file: 'login.html' }
];

export async function loadComponents() {
  const app = document.getElementById('app');
  if (!app) return;

  // Pastikan kerangka layout dasar ada di dalam #app
  if (!document.getElementById('header-container')) {
    app.innerHTML = `
      <div id="header-container" class="w-full z-20"></div>
      <div class="app-layout flex flex-1 overflow-hidden relative">
        <div id="sidebar-container" class="z-30"></div>
        <main id="main-content" class="main-content flex-1 overflow-y-auto p-4 md:p-6 relative bg-gray-50">
          <div id="view-admin" class="app-view hidden"></div>
          <div id="view-pos" class="app-view hidden"></div>
          <div id="view-products" class="app-view hidden"></div>
          <div id="view-history" class="app-view hidden"></div>
          <div id="view-reports" class="app-view hidden"></div>
        </main>
      </div>
      <div id="modals-container" style="pointer-events: none;"></div>
      <div id="login-container" style="pointer-events: none;"></div>
    `;
  }

  const promises = COMPONENTS.map(async (comp) => {
    let el = document.getElementById(comp.id);
    if (!el) return;

    try {
      const res = await fetch(`/components/${comp.file}`);
      if (res.ok) {
        el.innerHTML = await res.text();
      }
    } catch (e) {
      console.error(`Gagal memuat ${comp.file}:`, e);
    }
  });

  await Promise.all(promises);

  // Kunci perbaikan: Pastikan semua modal dan backdrop dalam status tersembunyi
  document.querySelectorAll('.modal-backdrop, [id^="modal-"], .login-backdrop, #login-modal').forEach(m => {
    m.classList.add('hidden');
    m.style.display = 'none';
  });
}

export default loadComponents;
