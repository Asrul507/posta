import { apiFetch } from '../api.js';
import { state } from '../state.js';

export async function checkAndRestoreShift() {
    try {
        const res = await apiFetch('/api/shifts/current');
        if (res && res.shift && res.shift.status === 'OPEN') {
            state.activeShift = res.shift;
            // Update badge info kasir di header tanpa memunculkan modal buka shift
            const shiftBadge = document.getElementById('header-shift-badge');
            if (shiftBadge) shiftBadge.textContent = res.shift.shift_name;
            return true;
        } else {
            state.activeShift = null;
            // Buka modal input modal awal jika memang kasir belum open shift
            const openModal = document.getElementById('modal-open-shift');
            if (openModal) openModal.classList.remove('hidden');
            return false;
        }
    } catch (err) {
        console.error('Error saat restore shift:', err);
    }
}
