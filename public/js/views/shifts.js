import { state, formatRupiah, showToast } from '../state.js';

let lastClosedShiftSummary = null;

export async function checkActiveShift() {
  if (state.currentUser?.role === 'SUPERADMIN') return true;

  try {
    const res = await fetch(`/api/shifts/current?tenant_id=${state.tenantId}&user_id=${state.currentUser.id}`);
    const result = await res.json();

    if (result.success && result.active_shift) {
      state.currentShift = result.active_shift;
      return true;
    } else {
      // Kunci kasir dan buka modal start shift
      state.currentShift = null;
      const openModal = document.getElementById('open-shift-modal');
      if (openModal) openModal.classList.remove('hidden');
      return false;
    }
  } catch (err) {
    console.error("Gagal memeriksa shift:", err);
    return true;
  }
}

export async function submitOpenShift() {
  const inputCash = document.getElementById('open-shift-cash-input');
  const startCash = parseFloat(inputCash?.value) || 0;

  const btn = document.getElementById('btn-submit-open-shift');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: state.tenantId,
        user_id: state.currentUser.id,
        cashier_name: state.currentUser.name,
        starting_cash: startCash
      })
    });

    const result = await res.json();
    if (result.success) {
      state.currentShift = result.shift;
      showToast(`Shift dibuka! Modal awal: ${formatRupiah(startCash)}`);
      document.getElementById('open-shift-modal').classList.add('hidden');
    } else {
      showToast(result.error || 'Gagal membuka shift', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

export function openCloseShiftModal() {
  if (!state.currentShift) {
    showToast('Tidak ada shift aktif yang berjalan.', 'error');
    return;
  }
  document.getElementById('close-shift-actual-cash').value = '';
  document.getElementById('close-shift-notes').value = '';
  document.getElementById('close-shift-modal').classList.remove('hidden');
}

export async function submitCloseShift() {
  const actualCash = parseFloat(document.getElementById('close-shift-actual-cash')?.value);
  const notes = document.getElementById('close-shift-notes')?.value || '';

  if (isNaN(actualCash)) {
    showToast('Harap masukkan nominal uang fisik di laci!', 'error');
    return;
  }

  const btn = document.getElementById('btn-submit-close-shift');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shift_id: state.currentShift.id,
        actual_cash: actualCash,
        notes: notes
      })
    });

    const result = await res.json();
    if (result.success) {
      document.getElementById('close-shift-modal').classList.add('hidden');
      lastClosedShiftSummary = result.summary;
      state.currentShift = null;
      showShiftSummary(result.summary);
    } else {
      showToast(result.error || 'Gagal menutup shift', 'error');
    }
  } catch (err) {
    showToast('Gagal memproses tutup shift.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function showShiftSummary(s) {
  document.getElementById('xrep-cashier').innerText = `Kasir: ${s.cashier_name}`;
  document.getElementById('xrep-time').innerText = new Date(s.end_time).toLocaleString('id-ID');
  document.getElementById('xrep-starting').innerText = formatRupiah(s.starting_cash);
  document.getElementById('xrep-sales').innerText = formatRupiah(s.total_cash_sales);
  document.getElementById('xrep-expected').innerText = formatRupiah(s.expected_cash);
  document.getElementById('xrep-actual').innerText = formatRupiah(s.actual_cash);

  const diffEl = document.getElementById('xrep-difference');
  if (s.difference === 0) {
    diffEl.innerHTML = `<span class="text-emerald-600">PAS (Rp 0)</span>`;
  } else if (s.difference > 0) {
    diffEl.innerHTML = `<span class="text-blue-600">+${formatRupiah(s.difference)} (Lebih)</span>`;
  } else {
    diffEl.innerHTML = `<span class="text-rose-600">${formatRupiah(s.difference)} (KURANG)</span>`;
  }

  document.getElementById('shift-summary-modal').classList.remove('hidden');
}

export function printShiftReport() {
  window.print();
}

export function finishShiftAndLogout() {
  localStorage.removeItem('posta_token');
  localStorage.removeItem('posta_user');
  location.reload();
}
