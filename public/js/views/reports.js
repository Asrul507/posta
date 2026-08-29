import { formatRupiah } from '../state.js';
import { API } from '../api.js';

function parseDate(dStr) {
  if (!dStr) return '-';
  const isoStr = dStr.includes('T') ? dStr : dStr.replace(' ', 'T') + 'Z';
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? dStr : d.toLocaleString('id-ID');
}

export async function fetchTransactions() {
  const tbody = document.getElementById('transactions-tbody');
  tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i> Memuat riwayat...</td></tr>`;

  try {
    const result = await API.getTransactions();
    if (result.success && result.data.length > 0) {
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
  tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i> Memuat riwayat...</td></tr>`;

  try {
    const result = await API.getPOHistory();
    if (result.success && result.data.length > 0) {
      tbody.innerHTML = result.data.map(p => `
        <tr class="hover:bg-slate-50">
          <td class="py-2.5 px-3 text-slate-500 font-medium">${parseDate(p.created_at)}</td>
          <td class="py-2.5 px-3 font-mono font-bold text-slate-800">${p.po_number}</td>
          <td class="py-2.5 px-3 font-semibold text-slate-700">${p.supplier_name || '-'}</td>
          <td class="py-2.5 px-3 text-slate-500">${p.notes || '-'}</td>
          <td class="py-2.5 px-3 text-center font-bold text-emerald-600">${p.total_items} Jenis Item</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400">Belum ada riwayat barang masuk.</td></tr>`;
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-rose-500">Gagal mengambil data barang masuk.</td></tr>`;
  }
}
