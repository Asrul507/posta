import { api } from '../api.js';
import { state } from '../state.js';
import { playSuccessSound, playAlertSound } from '../audio.js';

export function updateHeaderShiftStatus(shift) {
  const badge = document.getElementById('header-shift-badge');
  const openBtn = document.getElementById('btn-open-shift-header');
  const closeBtn = document.getElementById('btn-close-shift-header');

  if (shift && shift.status === 'OPEN') {
    if (badge) {
      badge.textContent = `${shift.shift_name} (OPEN)`;
      badge.className = 'px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300';
    }
    if (openBtn) openBtn.classList.add('hidden');
    if (closeBtn) closeBtn.classList.remove('hidden');
  } else {
    if (badge) {
      badge.textContent = 'Shift Tutup';
      badge.className = 'px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 border border-rose-300';
    }
    if (openBtn) openBtn.classList.remove('hidden');
    if (closeBtn) closeBtn.classList.add('hidden');
  }
}

export async function checkAndRestoreShift() {
  try {
    const res = await api('/api/shifts/current', 'GET');
    if (res && res.shift && res.shift.status === 'OPEN') {
      state.activeShift = res.shift;
      updateHeaderShiftStatus(res.shift);
      return true;
    } else {
      state.activeShift = null;
      updateHeaderShiftStatus(null);
      if (state.user && state.user.role === 'CASHIER') {
        openModalOpenShift();
      }
      return false;
    }
  } catch (err) {
    console.error('Gagal restore shift:', err);
    updateHeaderShiftStatus(null);
    return false;
  }
}

export async function initShifts() {
  await checkAndRestoreShift();
}

export function openModalOpenShift() {
  document.getElementById('open-shift-modal')?.classList.remove('hidden');
}

export function closeModalOpenShift() {
  document.getElementById('open-shift-modal')?.classList.add('hidden');
}

export function openModalCloseShift() {
  document.getElementById('close-shift-modal')?.classList.remove('hidden');
}

export function closeModalCloseShift() {
  document.getElementById('close-shift-modal')?.classList.add('hidden');
}

export async function submitOpenShift() {
  const shiftName = document.getElementById('open-shift-name-select')?.value || 'Pagi';
  const startingCash = Number(document.getElementById('open-shift-cash-input')?.value) || 0;
  const btn = document.getElementById('btn-submit-open-shift');

  if (btn) btn.disabled = true;
  try {
    const res = await api('/api/shifts/open', 'POST', {
      shift_name: shiftName,
      starting_cash: startingCash
    });

    if (res && res.success) {
      state.activeShift = res.shift;
      updateHeaderShiftStatus(res.shift);
      closeModalOpenShift();
      playSuccessSound();
    } else {
      playAlertSound();
      alert(res?.error || 'Gagal membuka shift');
    }
  } catch (err) {
    console.error('Error open shift:', err);
    playAlertSound();
    alert('Terjadi kesalahan saat membuka shift');
  } finally {
    if (btn) btn.disabled = false;
  }
}

export async function submitCloseShift() {
  const actualCash = Number(document.getElementById('close-shift-actual-cash')?.value) || 0;
  const notes = document.getElementById('close-shift-notes')?.value || '';

  if (!confirm('Apakah Anda yakin ingin menutup shift ini?')) return;

  const btn = document.getElementById('btn-submit-close-shift');
  if (btn) btn.disabled = true;

  try {
    const res = await api('/api/shifts/close', 'POST', {
      actual_cash: actualCash,
      notes: notes
    });

    if (res && res.success) {
      state.activeShift = null;
      updateHeaderShiftStatus(null);
      closeModalCloseShift();
      playSuccessSound();
      showShiftSummary(res.summary);
    } else {
      playAlertSound();
      alert(res?.error || 'Gagal menutup shift');
    }
  } catch (err) {
    console.error('Error closing shift:', err);
    playAlertSound();
    alert('Terjadi kesalahan saat menutup shift');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function showShiftSummary(summary) {
  if (!summary) return;

  const startingCash = Number(summary.starting_cash || 0);
  const expectedCash = Number(summary.expected_cash || 0);
  const actualCash = Number(summary.actual_cash || 0);
  const difference = Number(summary.difference || 0);
  const cashSales = Math.max(0, expectedCash - startingCash);

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

  setText('xrep-store', state.tenantInfo?.name || 'Posta POS');
  setText('xrep-shift-info', `${summary.shift_name || '-'} - ${summary.cashier_name || state.user?.name || '-'}`);
  setText('xrep-time', summary.end_time ? new Date(summary.end_time).toLocaleString('id-ID') : new Date().toLocaleString('id-ID'));
  setText('xrep-total-tx', '-'); // Tidak tersedia dari endpoint tutup shift
  setText('xrep-grand-sales', rupiah(cashSales));
  setText('xrep-cash-sales', rupiah(cashSales));
  setText('xrep-noncash-sales', '-'); // Tidak tersedia dari endpoint tutup shift
  setText('xrep-starting', rupiah(startingCash));
  setText('xrep-expected', rupiah(expectedCash));
  setText('xrep-actual', rupiah(actualCash));
  setText('xrep-difference', rupiah(difference));

  document.getElementById('shift-summary-modal')?.classList.remove('hidden');
}

export function finishShiftAndLogout() {
  document.getElementById('shift-summary-modal')?.classList.add('hidden');
  window.logout?.();
}

window.postaShifts = {
  checkAndRestoreShift,
  updateHeaderShiftStatus,
  openModalOpenShift,
  closeModalOpenShift,
  openModalCloseShift,
  closeModalCloseShift,
  submitOpenShift,
  submitCloseShift,
  finishShiftAndLogout
};

window.openCloseShiftModal = openModalCloseShift;
window.submitOpenShift = submitOpenShift;
window.submitCloseShift = submitCloseShift;
window.finishShiftAndLogout = finishShiftAndLogout;
