import { state, formatRupiah, showToast } from '../state.js';
import { API } from '../api.js';

function parseDate(dStr) {
  if (!dStr) return '-';
  const isoStr = dStr.includes('T') ? dStr : dStr.replace(' ', 'T') + 'Z';
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? dStr : d.toLocaleString('id-ID');
}

function getActiveTenantId() {
  return state.tenantId || state.currentUser?.tenant_id || (state.tenantInfo?.id !== 'admin' ? state.tenantInfo?.id : null);
}

// -------------------------------------------------------------------------
// 1. RIWAYAT TRANSAKSI & PO
// -------------------------------------------------------------------------
export async function fetchTransactions() {
  const tbody = document.getElementById('transactions-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i> Memuat riwayat...</td></tr>`;

  try {
    const result = await API.getTransactions();
    if (result.success && result.data && result.data.length > 0) {
      tbody.innerHTML = result.data.map(t => `
        <tr class="hover:bg-slate-50">
          <td class="py-2.5 px-3 text-slate-500 font-medium">${parseDate(t.created_at)}</td>
          <td class="py-2.5 px-3 font-mono font-bold text-slate-800">${t.invoice_number}</td>
          <td class="py-2.5 px-3"><span class="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded">${t.payment_method}</span></td>
          <td class="py-2.5 px-3 text-right font-bold text-slate-800">${formatRupiah(t.total_amount)}</td>
          <td class="py-2.5 px-3 text-right text-slate-600">${formatRupiah(t.paid_amount)}</td>
          <td class="py-2.5 px-3 text-right font-medium text-emerald-600">${formatRupiah(t.change_amount)}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400">Belum ada data transaksi.</td></tr>`;
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-rose-500">Gagal mengambil data riwayat transaksi.</td></tr>`;
  }
}

export async function fetchPOHistory() {
  const tbody = document.getElementById('pohist-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i> Memuat riwayat...</td></tr>`;

  try {
    const result = await API.getPOHistory();
    if (result.success && result.data && result.data.length > 0) {
      tbody.innerHTML = result.data.map(p => `
        <tr class="hover:bg-slate-50">
          <td class="py-2.5 px-3 text-slate-500 font-medium">${parseDate(p.created_at)}</td>
          <td class="py-2.5 px-3 font-mono font-bold text-slate-800">${p.po_number}</td>
          <td class="py-2.5 px-3 font-semibold text-slate-700">${p.supplier_name || '-'}</td>
          <td class="py-2.5 px-3 text-slate-500">${p.notes || '-'}</td>
          <td class="py-2.5 px-3 text-center font-bold text-emerald-600">${p.total_qty || p.total_items || 0} Pcs</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400">Belum ada riwayat barang masuk.</td></tr>`;
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-rose-500">Gagal mengambil data barang masuk.</td></tr>`;
  }
}

// -------------------------------------------------------------------------
// 2. LAPORAN HARIAN (Z-REPORT & REKAP SHIFT)
// -------------------------------------------------------------------------
export async function loadDailyReport() {
  const tenantId = getActiveTenantId();
  const dateInput = document.getElementById('daily-report-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  const selectedDate = dateInput?.value || new Date().toISOString().split('T')[0];

  if (!tenantId) {
    console.warn("Tenant ID tidak ditemukan untuk laporan harian.");
    return;
  }

  try {
    const res = await fetch(`/api/reports/daily?tenant_id=${tenantId}&date=${selectedDate}`);
    const result = await res.json();

    if (result.success) {
      const sum = result.summary || {};
      const elSales = document.getElementById('daily-total-sales');
      const elTx = document.getElementById('daily-tx-count');
      const elProfit = document.getElementById('daily-gross-profit');
      const elMargin = document.getElementById('daily-margin-pct');
      const elCogs = document.getElementById('daily-total-cogs');

      if (elSales) elSales.innerText = formatRupiah(sum.total_sales || 0);
      if (elTx) elTx.innerText = `${sum.total_transactions || 0} Transaksi Selesai`;
      if (elProfit) elProfit.innerText = formatRupiah(sum.gross_profit || 0);
      if (elMargin) elMargin.innerText = `Margin: ${sum.profit_margin_pct || 0}%`;
      if (elCogs) elCogs.innerText = formatRupiah(sum.total_cogs || 0);

      // Hitung tunai vs non-tunai
      let totalCash = 0;
      (result.shifts || []).forEach(s => {
        totalCash += Math.max(0, (s.expected_cash || 0) - (s.starting_cash || 0));
      });
      const elCash = document.getElementById('daily-cash-sales');
      const elNonCash = document.getElementById('daily-noncash-sales');
      if (elCash) elCash.innerText = formatRupiah(totalCash);
      if (elNonCash) elNonCash.innerText = formatRupiah(Math.max(0, (sum.total_sales || 0) - totalCash));

      renderDailyShiftsTable(result.shifts || []);
    } else {
      showToast(result.error || 'Gagal memuat laporan', 'error');
    }
  } catch (err) {
    console.error("Error daily report:", err);
    showToast('Gagal memuat laporan harian', 'error');
  }
}

function renderDailyShiftsTable(shifts) {
  const tbody = document.getElementById('daily-shifts-table-tbody');
  if (!tbody) return;

  if (shifts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-slate-400">Tidak ada shift tercatat pada tanggal ini.</td></tr>';
    return;
  }

  tbody.innerHTML = shifts.map(s => {
    const startTime = new Date(s.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const endTime = s.end_time ? new Date(s.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Aktif';
    const cashSales = Math.max(0, (s.expected_cash || 0) - (s.starting_cash || 0));

    let diffBadge = `<span class="text-slate-400">-</span>`;
    if (s.status === 'CLOSED') {
      if (s.difference === 0) {
        diffBadge = `<span class="text-emerald-600 font-bold">Pas</span>`;
      } else if (s.difference > 0) {
        diffBadge = `<span class="text-blue-600 font-bold">+${formatRupiah(s.difference)}</span>`;
      } else {
        diffBadge = `<span class="text-rose-600 font-bold">${formatRupiah(s.difference)}</span>`;
      }
    }

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="py-2.5 px-3">
          <div class="font-bold text-slate-800">Shift ${s.shift_name || 'Pagi'}</div>
          <div class="text-[10px] text-slate-500">${s.cashier_name}</div>
        </td>
        <td class="py-2.5 px-3 text-[11px] font-mono text-slate-600">${startTime} - ${endTime}</td>
        <td class="py-2.5 px-3 text-right font-mono">${formatRupiah(s.starting_cash)}</td>
        <td class="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">${formatRupiah(cashSales)}</td>
        <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-800">${formatRupiah(s.expected_cash || 0)}</td>
        <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-900">${s.status === 'CLOSED' ? formatRupiah(s.actual_cash) : '-'}</td>
        <td class="py-2.5 px-3 text-center text-xs font-mono">${diffBadge}</td>
        <td class="py-2.5 px-3 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${s.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}">
            ${s.status}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// -------------------------------------------------------------------------
// 3. LAPORAN BULANAN
// -------------------------------------------------------------------------
export async function loadMonthlyReport() {
  const tenantId = getActiveTenantId();
  const monthInput = document.getElementById('monthly-report-month');
  if (monthInput && !monthInput.value) {
    monthInput.value = new Date().toISOString().slice(0, 7);
  }
  const selectedMonth = monthInput?.value || new Date().toISOString().slice(0, 7);

  if (!tenantId) {
    console.warn("Tenant ID tidak ditemukan untuk laporan bulanan.");
    return;
  }

  try {
    const res = await fetch(`/api/reports/monthly?tenant_id=${tenantId}&month=${selectedMonth}`);
    const result = await res.json();

    if (result.success) {
      const sum = result.summary || {};
      const elSales = document.getElementById('monthly-total-sales');
      const elTx = document.getElementById('monthly-tx-count');
      const elCogs = document.getElementById('monthly-total-cogs');
      const elProfit = document.getElementById('monthly-gross-profit');
      const elMargin = document.getElementById('monthly-margin-pct');

      if (elSales) elSales.innerText = formatRupiah(sum.total_sales || 0);
      if (elTx) elTx.innerText = `${sum.total_transactions || 0} Transaksi Selesai`;
      if (elCogs) elCogs.innerText = formatRupiah(sum.total_cogs || 0);
      if (elProfit) elProfit.innerText = formatRupiah(sum.gross_profit || 0);
      if (elMargin) elMargin.innerText = `Margin Rata-rata: ${sum.profit_margin_pct || 0}%`;

      renderMonthlyTrendsTable(result.daily_trends || []);
    } else {
      showToast(result.error || 'Gagal memuat laporan bulanan', 'error');
    }
  } catch (err) {
    console.error("Error monthly report:", err);
    showToast('Gagal memuat laporan bulanan', 'error');
  }
}

function renderMonthlyTrendsTable(trends) {
  const tbody = document.getElementById('monthly-trends-table-tbody');
  if (!tbody) return;

  if (trends.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center py-6 text-slate-400">Belum ada transaksi di bulan ini.</td></tr>';
    return;
  }

  tbody.innerHTML = trends.map(t => `
    <tr class="hover:bg-slate-50 transition">
      <td class="py-2 px-3 font-mono font-bold text-slate-800">${t.sale_date}</td>
      <td class="py-2 px-3 text-center text-slate-600">${t.daily_tx} Transaksi</td>
      <td class="py-2 px-3 text-right font-mono font-bold text-emerald-600">${formatRupiah(t.daily_sales)}</td>
    </tr>
  `).join('');
}
