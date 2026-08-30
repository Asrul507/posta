import { api } from '../api.js';
import { state } from '../state.js';

export async function checkAndRestoreShift() {
    try {
        const res = await api('/api/shifts/current', 'GET');
        if (res && res.shift && res.shift.status === 'OPEN') {
            state.activeShift = res.shift;
            
            // Perbarui label shift di header
            const shiftBadge = document.getElementById('header-shift-badge');
            if (shiftBadge) shiftBadge.textContent = res.shift.shift_name;
            return true;
        } else {
            state.activeShift = null;
            // Munculkan modal buka shift jika shift kasir belum ada yang terbuka
            const openModal = document.getElementById('modal-open-shift');
            if (openModal) openModal.classList.remove('hidden');
            return false;
        }
    } catch (err) {
        console.error('Error saat restore shift:', err);
    }
}

export async function submitOpenShift(shiftName, startingCash) {
    try {
        const res = await api('/api/shifts/open', 'POST', {
            shift_name: shiftName,
            starting_cash: startingCash
        });
        if (res && res.success) {
            state.activeShift = res.shift;
            const openModal = document.getElementById('modal-open-shift');
            if (openModal) openModal.classList.add('hidden');
            
            const shiftBadge = document.getElementById('header-shift-badge');
            if (shiftBadge) shiftBadge.textContent = res.shift.shift_name;
            return true;
        } else {
            alert(res?.error || 'Gagal membuka shift.');
            return false;
        }
    } catch (err) {
        console.error('Gagal open shift:', err);
        return false;
    }
}

export async function submitCloseShift(actualCash, notes) {
    try {
        const res = await api('/api/shifts/close', 'POST', {
            actual_cash: actualCash,
            notes: notes
        });
        if (res && res.success) {
            state.activeShift = null;
            return res.summary;
        } else {
            alert(res?.error || 'Gagal menutup shift.');
            return null;
        }
    } catch (err) {
        console.error('Gagal close shift:', err);
        return null;
    }
}

window.postaShifts = {
    checkAndRestoreShift,
    submitOpenShift,
    submitCloseShift
};
