export async function loadComponents() {
  const components = [
    { id: 'header-container', url: '/components/header.html' },
    { id: 'sidebar-container', url: '/components/sidebar.html' },
    { id: 'login-container', url: '/components/login.html' },
    { id: 'modals-container', url: '/components/modals.html' },
    { id: 'view-pos-container', url: '/components/view-pos.html' },
    { id: 'view-products-container', url: '/components/view-products.html' },
    { id: 'view-reports-container', url: '/components/view-reports.html' },
    { id: 'view-admin-container', url: '/components/view-admin.html' }
  ];

  await Promise.allSettled(
    components.map(async (comp) => {
      const container = document.getElementById(comp.id);
      if (!container) return;

      try {
        const response = await fetch(comp.url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        container.innerHTML = html;
      } catch (err) {
        console.warn(`Gagal memuat komponen ${comp.url}:`, err);
      }
    })
  );
}
