// public/js/loader.js

const COMPONENTS = [
  { targetId: 'header-root', file: 'header.html' },
  { targetId: 'sidebar-root', file: 'sidebar.html' },
  { targetId: 'view-admin', file: 'view-admin.html' },
  { targetId: 'view-pos', file: 'view-pos.html' },
  { targetId: 'view-products', file: 'view-products.html' },
  { targetId: 'view-history', file: 'view-history.html' },
  { targetId: 'view-reports', file: 'view-reports.html' },
  { targetId: 'modals-root', file: 'modals.html' },
  { targetId: 'login-root', file: 'login.html' }
];

export async function loadComponents() {
  const promises = COMPONENTS.map(async (comp) => {
    let el = document.getElementById(comp.targetId);
    if (!el) {
      el = document.createElement('div');
      el.id = comp.targetId;
      if (comp.targetId.startsWith('view-')) {
        el.className = 'app-view hidden';
      }
      document.getElementById('main-content')?.appendChild(el) || document.body.appendChild(el);
    }

    try {
      const res = await fetch(`/components/${comp.file}`);
      if (res.ok) {
        el.innerHTML = await res.text();
      }
    } catch (e) {
      console.error(`Gagal load ${comp.file}:`, e);
    }
  });

  await Promise.all(promises);

  // Pastikan seluruh modal memiliki class hidden agar tidak memblokir layar
  document.querySelectorAll('.modal-backdrop, [id^="modal-"]').forEach(m => {
    m.classList.add('hidden');
  });
}

export default loadComponents;
