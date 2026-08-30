// public/js/loader.js
const COMPONENTS = [
    { containerId: 'auth-container', file: 'components/login.html' },
    { containerId: 'header-container', file: 'components/header.html' },
    { containerId: 'sidebar-container', file: 'components/sidebar.html' },
    { containerId: 'modals-container', file: 'components/modals.html' },
    
    // View Halaman Utama
    { containerId: 'content-container', file: 'components/view-pos.html', isView: true, viewId: 'view-pos' },
    { containerId: 'content-container', file: 'components/view-admin.html', isView: true, viewId: 'view-admin' },
    { containerId: 'content-container', file: 'components/view-products.html', isView: true, viewId: 'view-products' },
    { containerId: 'content-container', file: 'components/view-reports.html', isView: true, viewId: 'view-reports' },
    { containerId: 'content-container', file: 'components/view-history.html', isView: true, viewId: 'view-history' }
];

export async function loadComponents() {
    for (const comp of COMPONENTS) {
        try {
            const response = await fetch(comp.file);
            if (!response.ok) {
                console.warn(`Gagal memuat: ${comp.file} (${response.status})`);
                continue;
            }
            const html = await response.text();

            if (comp.isView) {
                let viewWrapper = document.getElementById(comp.viewId);
                if (!viewWrapper) {
                    viewWrapper = document.createElement('div');
                    viewWrapper.id = comp.viewId;
                    viewWrapper.className = 'app-view hidden';
                    
                    const contentContainer = document.getElementById(comp.containerId);
                    if (contentContainer) {
                        contentContainer.appendChild(viewWrapper);
                    }
                }
                viewWrapper.innerHTML = html;
            } else {
                const target = document.getElementById(comp.containerId);
                if (target) {
                    target.innerHTML = html;
                }
            }
        } catch (err) {
            console.error(`Error loading component ${comp.file}:`, err);
        }
    }
}

export const loadViews = loadComponents;
export const initLoader = loadComponents;
export const loadAllComponents = loadComponents;
export default loadComponents;
