// public/js/loader.js
export async function loadComponents() {
  const components = [
    { id: 'header-container', path: '/components/header.html' },
    { id: 'sidebar-container', path: '/components/sidebar.html' },
    { id: 'view-pos-container', path: '/components/view-pos.html' },
    { id: 'view-admin-container', path: '/components/view-admin.html' },
    { id: 'view-history-container', path: '/components/view-history.html' },
    { id: 'view-reports-container', path: '/components/view-reports.html' },
    { id: 'view-products-container', path: '/components/view-products.html' },
    { id: 'modals-container', path: '/components/modals.html' },
    { id: 'login-container', path: '/components/login.html' }
  ];

  for (const comp of components) {
    try {
      const res = await fetch(comp.path);
      if (res.ok) {
        const html = await res.text();
        let target = document.getElementById(comp.id);
        
        if (!target) {
          // Buat container otomatis jika belum ada di index.html
          target = document.createElement('div');
          target.id = comp.id;
          document.getElementById('app')?.appendChild(target);
        }
        
        target.innerHTML = html;
      }
    } catch (err) {
      console.warn(`Gagal memuat komponen ${comp.path}:`, err);
    }
  }
}

export default loadComponents;
