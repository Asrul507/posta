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
      } else {
        console.warn(`Gagal memuat /components/${comp.file} (Status: ${res.status})`);
      }
    } catch (e) {
      console.error(`Gagal load ${comp.file}:`, e);
    }
  });

  await Promise.all(promises);

  // KUNCI: Sembunyikan semua modal & login backdrop dan nonaktifkan pointerEvents bawaan
  document.querySelectorAll('.modal-backdrop, .login-backdrop, [id^="modal-"], #login-modal, #modal-container').forEach(m => {
    m.classList.add('hidden');
    m.style.pointerEvents = 'none';
  });
}

export default loadComponents;
