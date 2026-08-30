import { api } from '../api.js';
import { state } from '../state.js';

export async function initAdminView() {
    const superView = document.getElementById('admin-superadmin-view');
    const tenantView = document.getElementById('admin-tenant-view');

    if (state.user && state.user.role === 'SUPERADMIN') {
        if (superView) superView.classList.remove('hidden');
        if (tenantView) tenantView.classList.add('hidden');
        loadSuperadminTenants();
    } else {
        if (superView) superView.classList.add('hidden');
        if (tenantView) tenantView.classList.remove('hidden');
        loadAdminDashboardData();
    }
}

// 1. Fungsi Superadmin / Developer
export async function loadSuperadminTenants() {
    try {
        const res = await api('/api/admin/tenants', 'GET');
        const tbody = document.getElementById('superadmin-tenants-table');
        if (!tbody || !res) return;

        const tenantList = res.data || res.tenants || [];
        if (tenantList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-center text-gray-400">Belum ada tenant terdaftar.</td></tr>`;
            return;
        }

        tbody.innerHTML = tenantList.map(t => `
            <tr class="hover:bg-gray-50 border-b">
                <td class="px-4 py-3 font-medium text-gray-800">${t.name}</td>
                <td class="px-4 py-3 text-blue-600">${t.subdomain}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-0.5 text-xs rounded-full ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                        ${t.is_active ? 'Aktif' : 'Non-Aktif'}
                    </span>
                </td>
                <td class="px-4 py-3">
                    <button onclick="window.postaAdmin?.impersonateTenant('${t.subdomain}')" class="px-3 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 transition">
                        Masuk (SSO)
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Gagal load tenants superadmin:', err);
    }
}

export async function impersonateTenant(subdomain) {
    try {
        const res = await api(`/api/admin/impersonate?subdomain=${subdomain}`, 'GET');
        if (res && res.success && res.target_url) {
            window.location.href = res.target_url;
        } else {
            alert(res?.error || 'Gagal melakukan SSO Impersonate.');
        }
    } catch (err) {
        console.error('Error saat impersonate:', err);
    }
}

// 2. Fungsi Dashboard Ringkasan Toko (Admin / Owner)
export async function loadAdminDashboardData() {
    try {
        const res = await api('/api/shifts/summary-today', 'GET');
        if (!res || !res.success) return;

        // Render Shift Terakhir
        const latest = res.latest_shift;
        const badge = document.getElementById('dash-latest-shift-badge');
        const sales = document.getElementById('dash-latest-shift-sales');
        const cashier = document.getElementById('dash-latest-shift-cashier');
        const timeEl = document.getElementById('dash-latest-shift-time');

        if (latest) {
            if (badge) badge.textContent = latest.shift_name || 'Shift';
            if (sales) sales.textContent = 'Rp ' + Number(latest.total_sales || 0).toLocaleString('id-ID');
            if (cashier) cashier.textContent = latest.cashier_name || '-';
            if (timeEl) {
                timeEl.textContent = latest.start_time ? new Date(latest.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
            }
        } else {
            if (badge) badge.textContent = 'Belum Ada';
            if (sales) sales.textContent = 'Rp 0';
            if (cashier) cashier.textContent = '-';
            if (timeEl) timeEl.textContent = '-';
        }

        // Render Kasir Aktif (OPEN)
        const activeList = res.active_shifts || [];
        const countEl = document.getElementById('dash-active-shift-count');
        if (countEl) countEl.textContent = `${activeList.length} Akun`;

        const tbody = document.getElementById('dash-active-shifts-table');
        if (!tbody) return;

        if (activeList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400">Belum ada kasir yang membuka shift hari ini.</td></tr>`;
            return;
        }

        tbody.innerHTML = activeList.map(s => `
            <tr class="hover:bg-gray-50 border-b">
                <td class="px-4 py-3 font-medium text-gray-800">${s.cashier_name}</td>
                <td class="px-4 py-3"><span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">${s.shift_name}</span></td>
                <td class="px-4 py-3 text-xs text-gray-500">${new Date(s.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                <td class="px-4 py-3 font-medium text-gray-700">Rp ${Number(s.starting_cash).toLocaleString('id-ID')}</td>
                <td class="px-4 py-3"><span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-semibold rounded-full text-xs">OPEN</span></td>
            </tr>
        `).join('');

    } catch (err) {
        console.error('Gagal memuat dashboard admin:', err);
    }
}

window.postaAdmin = {
    initAdminView,
    loadSuperadminTenants,
    impersonateTenant,
    loadAdminDashboardData
};
