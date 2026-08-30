import { apiFetch } from '../api.js';

let chartInstance = null;

export function initReports() {
    const today = new Date().toISOString().split('T')[0];
    const curMonth = today.substring(0, 7);

    const dInput = document.getElementById('daily-report-date');
    if (dInput) dInput.value = today;

    const mInput = document.getElementById('monthly-report-period');
    if (mInput) mInput.value = curMonth;

    loadDailyReport();
}

export function switchReportTab(tab) {
    const paneDaily = document.getElementById('report-pane-daily');
    const paneMonthly = document.getElementById('report-pane-monthly');
    const btnDaily = document.getElementById('tab-btn-daily');
    const btnMonthly = document.getElementById('tab-btn-monthly');

    if (tab === 'daily') {
        paneDaily.classList.remove('hidden');
        paneMonthly.classList.add('hidden');
        btnDaily.className = "px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm transition";
        btnMonthly.className = "px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg text-sm font-semibold transition";
        loadDailyReport();
    } else {
        paneDaily.classList.add('hidden');
        paneMonthly.classList.remove('hidden');
        btnMonthly.className = "px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm transition";
        btnDaily.className = "px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg text-sm font-semibold transition";
        loadMonthlyReport();
    }
}

export async function loadDailyReport() {
    const date = document.getElementById('daily-report-date')?.value;
    if (!date) return;

    try {
        const res = await apiFetch(`/api/reports/daily?date=${date}`);
        if (!res || !res.success) return;

        const sum = res.summary || {};
        const cardsEl = document.getElementById('daily-summary-cards');
        if (cardsEl) {
            cardsEl.innerHTML = `
                <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <span class="text-xs uppercase text-gray-400 font-semibold">Total Omzet</span>
                    <div class="text-2xl font-bold text-gray-900 mt-1">Rp ${Number(sum.total_sales || 0).toLocaleString('id-ID')}</div>
                </div>
                <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <span class="text-xs uppercase text-gray-400 font-semibold">Beban Pokok (HPP)</span>
                    <div class="text-2xl font-bold text-gray-600 mt-1">Rp ${Number(sum.total_cogs || 0).toLocaleString('id-ID')}</div>
                </div>
                <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <span class="text-xs uppercase text-gray-400 font-semibold">Estimasi Laba Kotor</span>
                    <div class="text-2xl font-bold text-emerald-600 mt-1">Rp ${Number(sum.gross_profit || 0).toLocaleString('id-ID')}</div>
                </div>
            `;
        }
    } catch (err) {
        console.error('Gagal load laporan harian:', err);
    }
}

export async function loadMonthlyReport() {
    const period = document.getElementById('monthly-report-period')?.value;
    if (!period) return;

    try {
        const res = await apiFetch(`/api/reports/monthly?period=${period}`);
        if (!res || !res.success) return;

        const list = res.data || [];
        renderMonthlyTable(list);
        renderMonthlyChart(list);
    } catch (err) {
        console.error('Gagal load laporan bulanan:', err);
    }
}

function renderMonthlyTable(data) {
    const tbody = document.getElementById('monthly-report-table');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400">Tidak ada transaksi pada bulan ini.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(row => `
        <tr class="hover:bg-gray-50">
            <td class="px-4 py-3 font-medium text-gray-800">${row.date}</td>
            <td class="px-4 py-3">${row.total_transactions || 0}</td>
            <td class="px-4 py-3 font-semibold text-gray-900">Rp ${Number(row.total_sales || 0).toLocaleString('id-ID')}</td>
            <td class="px-4 py-3 text-gray-500">Rp ${Number(row.total_cogs || 0).toLocaleString('id-ID')}</td>
            <td class="px-4 py-3 font-semibold text-emerald-600">Rp ${Number((row.total_sales || 0) - (row.total_cogs || 0)).toLocaleString('id-ID')}</td>
        </tr>
    `).join('');
}

function renderMonthlyChart(data) {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;

    if (chartInstance) {
        chartInstance.destroy();
    }

    const labels = data.map(item => item.date);
    const sales = data.map(item => item.total_sales || 0);
    const profits = data.map(item => (item.total_sales || 0) - (item.total_cogs || 0));

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Omzet Penjualan (Rp)',
                    data: sales,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Laba Kotor (Rp)',
                    data: profits,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (v) => 'Rp ' + Number(v).toLocaleString('id-ID')
                    }
                }
            }
        }
    });
}

window.postaReports = {
    initReports,
    switchReportTab,
    loadDailyReport,
    loadMonthlyReport
};
