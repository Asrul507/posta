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
  const appRoot = document.getElementById('app') || document.body;

  const promises = COMPONENTS.map(async (comp) => {
    let el = document.getElementById(comp.id);
    
    if (!el) {
      el = document.createElement('div');
      el.id = comp.id;
      if (comp.isView) {
        el.className = 'app-view hidden';
        el.style.display = 'none';
      }
      appRoot.appendChild(el);
    }

    try {
      const res = await fetch(`/components/${comp.file}`);
      if (res.ok) {
        el.innerHTML = await res.text();
      }
    } catch (e) {
      console.error(`Error loading /components/${comp.file}:`, e);
    }
  });

  await Promise.all(promises);

  // Pastikan semua modal dalam kondisi tertutup total agar tidak memblokir klik layar
  document.querySelectorAll('.modal-backdrop, [id^="modal-"]').forEach(m => {
    m.classList.add('hidden');
    m.style.display = 'none';
  });
}

export default loadComponents;
