import { state, formatRupiah, showToast } from '../state.js';
import { clearCart, loadProducts } from './pos.js';

export function openCheckoutModal() {
  if (!state.cart || state.cart.length === 0) {
    showToast('Keranjang masih kosong!', 'error');
    return;
  }

  const modal = document.getElementById('checkout-modal');
  const modalTotal = document.getElementById('modal-total-tagihan');
  const cashInput = document.getElementById('cash-input');
  const changeAmount = document.getElementById('modal-change-amount');
  const btnPay = document.getElementById('btn-confirm-pay');

  const total = state.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  if (modalTotal) modalTotal.innerText = formatRupiah(total);
  if (cashInput) cashInput.value = '';
  if (changeAmount) changeAmount.innerText = formatRupiah(0);
  if (btnPay) btnPay.disabled = true;

  if (modal) modal.classList.remove('hidden');
}

export function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  if (modal) modal.classList.add('hidden');
}

export function setCashAmount(val) {
  const total = state.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const cashInput = document.getElementById('cash-input');
  if (!cashInput) return;

  if (val === 'PAS') {
    cashInput.value = total;
  } else {
    cashInput.value = val;
  }
  calculateChange();
}

export function calculateChange() {
  const total = state.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const cashInput = document.getElementById('cash-input');
  const changeEl = document.getElementById('modal-change-amount');
  const btnPay = document.getElementById('btn-confirm-pay');

  const cash = parseFloat(cashInput?.value) || 0;
  const change = cash - total;

  if (changeEl) {
    changeEl.innerText = formatRupiah(Math.max(0, change));
  }

  if (btnPay) {
    btnPay.disabled = cash < total;
  }
}

export async function submitTransaction() {
  const total = state.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const cashInput = document.getElementById('cash-input');
  const cash = parseFloat(cashInput?.value) || 0;

  if (cash < total) {
    showToast('Nominal pembayaran kurang!', 'error');
    return;
  }

  const btnPay = document.getElementById('btn-confirm-pay');
  if (btnPay) {
    btnPay.disabled = true;
    btnPay.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
  }

  try {
    const payload = {
      tenant_id: state.tenantId,
      items: state.cart,
      paid_amount: cash,
      payment_method: 'CASH',
      cashier_name: state.currentUser?.name || 'Kasir'
    };

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (result.success) {
      showToast('Transaksi Berhasil Disimpan!');
      closeCheckoutModal();
      clearCart();
      loadProducts();
    } else {
      showToast('Gagal: ' + (result.error || 'Terjadi kesalahan'), 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  } finally {
    if (btnPay) {
      btnPay.disabled = false;
      btnPay.innerHTML = '<i class="fa-solid fa-check"></i> <span>Selesaikan Transaksi</span>';
    }
  }
}
