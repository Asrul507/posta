import { api } from '../api.js';
import { state, formatRupiah } from '../state.js';

export async function fetchTransactions() {
  const tbody = document.getElementById('transactions-tbody');
  if (!tbody) return;

  if (!state.tenantId) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400">Sesi toko tidak ditemukan, silakan login ulang.</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400">Memuat riwayat transaksi...</td></tr>`;

  try {
    const res = await api(`/api/reports/transactions?tenant_id=${encodeURIComponent(state.tenantId)}`, 'GET');
    const list = (res && res.success && res.data) ? res.data : [];

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400">Belum ada transaksi tersimpan.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(tx => `
      <tr class="hover:bg-slate-50">
        <td class="py-2.5 px-3 text-slate-500">${tx.created_at ? new Date(tx.created_at).toLocaleString('id-ID') : '-'}</td>
        <td class="py-2.5 px-3 font-mono font-bold text-slate-700">${tx.invoice_number || '-'}</td>
        <td class="py-2.5 px-3 text-slate-600">${tx.cashier_name || '-'}</td>
        <td class="py-2.5 px-3 text-right font-bold text-slate-800">${formatRupiah(tx.total_amount)}</td>
        <td class="py-2.5 px-3 text-right text-slate-600">${formatRupiah(tx.paid_amount)}</td>
        <td class="py-2.5 px-3 text-right text-slate-600">${formatRupiah(tx.change_amount)}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Gagal memuat riwayat transaksi:', err);
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-rose-500">Gagal memuat riwayat transaksi.</td></tr>`;
  }
}

export async function fetchPOHistory() {
  const tbody = document.getElementById('pohist-tbody');
  if (!tbody) return;

  if (!state.tenantId) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400">Sesi toko tidak ditemukan, silakan login ulang.</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400">Memuat riwayat barang masuk...</td></tr>`;

  try {
    const res = await api(`/api/reports/po?tenant_id=${encodeURIComponent(state.tenantId)}`, 'GET');
    const list = (res && res.success && res.data) ? res.data : [];

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400">Belum ada dokumen barang masuk.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(po => `
      <tr class="hover:bg-slate-50">
        <td class="py-2.5 px-3 text-slate-500">${po.created_at ? new Date(po.created_at).toLocaleString('id-ID') : '-'}</td>
        <td class="py-2.5 px-3 font-mono font-bold text-slate-700">${po.po_number || '-'}</td>
        <td class="py-2.5 px-3 text-slate-600">${po.supplier_name || '-'}</td>
        <td class="py-2.5 px-3 text-slate-500">${po.notes || '-'}</td>
        <td class="py-2.5 px-3 text-center font-bold text-slate-800">${po.total_qty || 0} pcs</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Gagal memuat riwayat PO:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-rose-500">Gagal memuat riwayat barang masuk.</td></tr>`;
  }
}

window.fetchTransactions = fetchTransactions;
window.fetchPOHistory = fetchPOHistory;
