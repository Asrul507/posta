import { state } from './state.js';
import { loadAdminDashboardData } from './views/admin.js';
import { initReports } from './views/reports.js';
import { checkAndRestoreShift } from './views/shifts.js';

export function navigateTo(viewName) {
    const content = document.getElementById('content-container');
    if (!content) return;

    // Sembunyikan semua container subview atau muat HTML view yang sesuai
    document.querySelectorAll('.app-view').forEach(el => el.classList.add('hidden'));

    const target = document.getElementById(`view-${viewName}`);
    if (target) {
        target.classList.remove('hidden');
    }

    // Eksekusi data loader berdasarkan view yang dipilih
    if (viewName === 'admin') {
        loadAdminDashboardData();
    } else if (viewName === 'reports-daily' || viewName === 'reports-monthly') {
        initReports();
    } else if (viewName === 'pos') {
        checkAndRestoreShift();
    }
}

export function openUserManagementModal() {
    const modal = document.getElementById('modal-user-management');
    if (modal) modal.classList.remove('hidden');
}

window.postaNav = {
    navigateTo,
    openUserManagementModal
};
