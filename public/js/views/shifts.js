import { state, formatRupiah, showToast } from '../state.js';

export function updateHeaderShiftStatus() {
  const badge = document.getElementById('header-shift-badge');
  const userInfo = document.getElementById('header-user-info');
  const storeName = document.getElementById('header-store-name');

  if (storeName && state.tenantInfo?.name) {
    storeName.innerText = state.tenantInfo.name;
  }

  if (userInfo && state.currentUser) {
    userInfo.innerText = `${state.currentUser.full_name || state.currentUser.name || state.currentUser.username} (${state.currentUser.role})`;
  }

  if (badge) {
    if (state.currentShift && state.currentShift.status === 'OPEN') {
      badge.className = 'px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]';
      badge.innerText = `Shift ${state.currentShift.shift_name || 'Pagi'} (Aktif)`;
    } else {
      badge.className = 'px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]';
      badge.innerText = 'Shift Belum Buka';
    }
  }
}

export async function checkActiveShift() {
  if (['SUPERADMIN', 'DEVELOPER'].includes(state.currentUser?.role)) return true;

  const tenantId = state.tenantId || state.currentUser?.tenant_id;
  const userId = state.currentUser?.id;

  if (!tenantId || !userId) return false;

  try {
    const res = await fetch(`/api/shifts/current?tenant_id=${tenantId}&user_id=${userId}`);
    const result = await res.json();

    if (result.success && result.active_shift) {
      state.currentShift = result.active_shift;
      updateHeaderShiftStatus();
      return true;
    } else {
      state.currentShift = null;
      updateHeaderShiftStatus();
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
  const shiftName = document.getElementById('open-shift-name-select')?.value || 'Pagi';
  const inputCash = document.getElementById('open-shift-cash-input');
  const startCash = parseFloat(inputCash?.value) || 0;

  const btn = document.getElementById('btn-submit-open-shift');
  if (btn) btn.disabled = true;

  const tenantId = state.tenantId || state.currentUser?.tenant_id;

  try {
    const res = await fetch('/api/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenantId,
        user_id: state.currentUser.id,
        cashier_name: state.currentUser.name,
        shift_name: shiftName,
        starting_cash: startCash
      })
    });

    const result = await res.json();
    if (result.success) {
      state.currentShift = result.shift;
      updateHeaderShiftStatus();
      showToast(`Shift ${shiftName} dimulai! Modal: ${formatRupiah(startCash)}`);
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
  const cashInput = document.getElementById('close-shift-actual-cash');
  const notesInput = document.getElementById('close-shift-notes');
  if (cashInput) cashInput.value = '';
  if (notesInput) notesInput.value = '';
  
  const modal = document.getElementById('close-shift-modal');
  if (modal) modal.classList.remove('hidden');
}

export async function submitCloseShift() {
  const actualCashInput = document.getElementById('close-shift-actual-cash');
  const actualCash = parseFloat(actualCashInput?.value);
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
      const closeMod = document.getElementById('close-shift-modal');
      if (closeMod) closeMod.classList.add('hidden');
      
      state.currentShift = null;
      updateHeaderShiftStatus();
      renderShiftSummaryModal(result.summary);
    } else {
      showToast(result.error || 'Gagal menutup shift', 'error');
    }
  } catch (err) {
    showToast('Gagal memproses tutup shift.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderShiftSummaryModal(s) {
  if (!s) return;
  const storeEl = document.getElementById('xrep-store');
  const shiftEl = document.getElementById('xrep-shift-info');
  const timeEl = document.getElementById('xrep-time');
  const totalTxEl = document.getElementById('xrep-total-tx');
  const grandSalesEl = document.getElementById('xrep-grand-sales');
  const cashSalesEl = document.getElementById('xrep-cash-sales');
  const nonCashSalesEl = document.getElementById('xrep-noncash-sales');
  const startEl = document.getElementById('xrep-starting');
  const expEl = document.getElementById('xrep-expected');
  const actEl = document.getElementById('xrep-actual');
  const diffEl = document.getElementById('xrep-difference');

  if (storeEl) storeEl.innerText = state.tenantInfo?.name || 'POSTA POS';
  if (shiftEl) shiftEl.innerText = `Shift ${s.shift_name || 'Pagi'} - ${s.cashier_name}`;
  if (timeEl) timeEl.innerText = new Date(s.end_time || Date.now()).toLocaleString('id-ID');
  if (totalTxEl) totalTxEl.innerText = `${s.total_transactions || 0} Nota`;
  if (grandSalesEl) grandSalesEl.innerText = formatRupiah(s.grand_total_sales || 0);
  if (cashSalesEl) cashSalesEl.innerText = `${formatRupiah(s.total_cash || 0)} (${s.count_cash || 0} Tx)`;
  if (nonCashSalesEl) nonCashSalesEl.innerText = `${formatRupiah(s.total_non_cash || 0)} (${s.count_non_cash || 0} Tx)`;
  
  if (startEl) startEl.innerText = formatRupiah(s.starting_cash || 0);
  if (expEl) expEl.innerText = formatRupiah(s.expected_cash || 0);
  if (actEl) actEl.innerText = formatRupiah(s.actual_cash || 0);

  if (diffEl) {
    if (s.difference === 0) {
      diffEl.innerHTML = `<span class="text-emerald-600 font-bold">PAS (Rp 0)</span>`;
    } else if (s.difference > 0) {
      diffEl.innerHTML = `<span class="text-blue-600 font-bold">+${formatRupiah(s.difference)} (LEBIH)</span>`;
    } else {
      diffEl.innerHTML = `<span class="text-rose-600 font-bold">${formatRupiah(s.difference)} (KURANG)</span>`;
    }
  }

  const sumModal = document.getElementById('shift-summary-modal');
  if (sumModal) sumModal.classList.remove('hidden');
}

export function finishShiftAndLogout() {
  localStorage.removeItem('posta_token');
  localStorage.removeItem('posta_user');
  location.reload();
}
