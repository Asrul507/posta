// public/js/loader.js

const COMPONENTS = [
  { id: 'header-root', file: 'header.html' },
  { id: 'sidebar-root', file: 'sidebar.html' },
  { id: 'view-pos', file: 'view-pos.html' },
  { id: 'view-products', file: 'view-products.html' },
  { id: 'view-history', file: 'view-history.html' },
  { id: 'view-reports', file: 'view-reports.html' },
  { id: 'view-admin', file: 'view-admin.html' },
  { id: 'modals-root', file: 'modals.html' },
  { id: 'login-root', file: 'login.html' }
];

export async function loadComponents() {
  const promises = COMPONENTS.map(async (comp) => {
    let el = document.getElementById(comp.id);
    
    // Jika container belum ada, buat langsung dan masukkan ke body
    if (!el) {
      el = document.createElement('div');
      el.id = comp.id;
      if (comp.id.startsWith('view-')) {
        el.className = 'app-view hidden';
      }
      document.body.appendChild(el);
    }

    try {
      const res = await fetch(`/components/${comp.file}`);
      if (res.ok) {
        el.innerHTML = await res.text();
      } else {
        console.warn(`Gagal memuat /components/${comp.file} (HTTP ${res.status})`);
      }
    } catch (e) {
      console.error(`Error fetch komponen ${comp.file}:`, e);
    }
  });

  await Promise.all(promises);
}

export default loadComponents;
