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
      // Buka modal jika kasir memang belum buka shift
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
  setupShiftModalEvents();
}

function setupShiftModalEvents() {
  // Tombol Buka Shift dari Modal
  const btnSubmitOpen = document.getElementById('btn-submit-open-shift');
  if (btnSubmitOpen && !btnSubmitOpen.dataset.bound) {
    btnSubmitOpen.dataset.bound = 'true';
    btnSubmitOpen.addEventListener('click', async () => {
      const shiftName = document.getElementById('input-shift-name')?.value || 'Pagi';
      const startingCash = Number(document.getElementById('input-starting-cash')?.value) || 0;

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
          alert('Shift berhasil dibuka!');
        } else {
          alert(res?.error || 'Gagal membuka shift');
        }
      } catch (err) {
        console.error('Error open shift:', err);
        alert('Terjadi kesalahan saat membuka shift');
      }
    });
  }

  // Tombol Submit Closing Shift (Blind Closing)
  const btnSubmitClose = document.getElementById('btn-submit-close-shift');
  if (btnSubmitClose && !btnSubmitClose.dataset.bound) {
    btnSubmitClose.dataset.bound = 'true';
    btnSubmitClose.addEventListener('click', async () => {
      const actualCash = Number(document.getElementById('input-actual-cash')?.value) || 0;
      const notes = document.getElementById('input-closing-notes')?.value || '';

      if (!confirm('Apakah Anda yakin ingin menutup shift ini?')) return;

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
          
          // Tampilkan ringkasan X-Report
          alert(`Shift Berhasil Ditutup!\nModal Awal: Rp ${Number(res.summary.starting_cash).toLocaleString('id-ID')}\nFisik Kas: Rp ${Number(res.summary.actual_cash).toLocaleString('id-ID')}\nSelisih: Rp ${Number(res.summary.difference).toLocaleString('id-ID')}`);
        } else {
          alert(res?.error || 'Gagal menutup shift');
        }
      } catch (err) {
        console.error('Error closing shift:', err);
        alert('Terjadi kesalahan saat menutup shift');
      }
    });
  }
}

export function openModalOpenShift() {
  const modal = document.getElementById('modal-open-shift');
  if (modal) modal.classList.remove('hidden');
}

export function closeModalOpenShift() {
  const modal = document.getElementById('modal-open-shift');
  if (modal) modal.classList.add('hidden');
}

export function openModalCloseShift() {
  const modal = document.getElementById('modal-close-shift');
  if (modal) modal.classList.remove('hidden');
}

export function closeModalCloseShift() {
  const modal = document.getElementById('modal-close-shift');
  if (modal) modal.classList.add('hidden');
}

window.postaShifts = {
  checkAndRestoreShift,
  updateHeaderShiftStatus,
  openModalOpenShift,
  closeModalOpenShift,
  openModalCloseShift,
  closeModalCloseShift
};
