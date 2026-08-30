// public/js/navigation.js
import { state } from './state.js';
import { initAdminView } from './views/admin.js';
import { initReports } from './views/reports.js';
import { checkAndRestoreShift } from './views/shifts.js';

export function navigateTo(viewName) {
    const mainContainer = document.getElementById('content-container');
    if (!mainContainer) return;

    // Sembunyikan semua subview
    document.querySelectorAll('.app-view').forEach(el => el.classList.add('hidden'));

    // Tampilkan view target
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
        target.classList.remove('hidden');
    }

    // Update status menu aktif di sidebar
    document.querySelectorAll('.sidebar-link').forEach(link => {
        if (link.dataset.view === viewName) {
            link.classList.add('bg-blue-50', 'text-blue-600', 'font-semibold');
            link.classList.remove('text-gray-600', 'hover:bg-gray-50');
        } else {
            link.classList.remove('bg-blue-50', 'text-blue-600', 'font-semibold');
            link.classList.add('text-gray-600', 'hover:bg-gray-50');
        }
    });

    // Jalankan inisialisasi view yang sesuai
    if (viewName === 'admin') {
        if (typeof initAdminView === 'function') initAdminView();
    } else if (viewName === 'reports' || viewName === 'reports-daily' || viewName === 'reports-monthly') {
        if (typeof initReports === 'function') initReports();
    } else if (viewName === 'pos') {
        if (typeof checkAndRestoreShift === 'function') checkAndRestoreShift();
    }
}

export function initNavigation() {
    document.querySelectorAll('[data-view]').forEach(btn => {
        if (!btn.dataset.navBound) {
            btn.dataset.navBound = 'true';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const view = btn.dataset.view;
                if (view) {
                    navigateTo(view);
                }
            });
        }
    });
}

export function openUserManagementModal() {
    const modal = document.getElementById('modal-user-management');
    if (modal) modal.classList.remove('hidden');
}

export const setupNavigation = initNavigation;

window.postaNav = {
    navigateTo,
    initNavigation,
    openUserManagementModal
};
