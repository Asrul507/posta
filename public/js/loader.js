export async function loadComponents() {
  const components = [
    { id: 'auth-container', url: 'components/login.html' },
    { id: 'header-container', url: 'components/header.html' },
    { id: 'sidebar-container', url: 'components/sidebar.html' },
    { id: 'view-pos', url: 'components/view-pos.html' },
    { id: 'view-products', url: 'components/view-products.html' },
    { id: 'view-po', url: 'components/view-history.html' },
    { id: 'view-reports', url: 'components/view-reports.html' },
    { id: 'view-admin', url: 'components/view-admin.html' },
    { id: 'modals-container', url: 'components/modals.html' }
  ];

  for (const comp of components) {
    try {
      const res = await fetch(comp.url);
      if (res.ok) {
        const html = await res.text();
        const el = document.getElementById(comp.id);
        if (el) el.innerHTML = html;
      }
    } catch (err) {
      console.error(`Gagal memuat ${comp.url}:`, err);
    }
  }
}
