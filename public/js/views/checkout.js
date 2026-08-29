import { state, formatRupiah, showToast } from '../state.js';
import { API } from '../api.js';
import { clearCart, loadProducts } from './pos.js';

export function openCheckoutModal() {
  const totalPrice = state.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  document.getElementById('modal-total-tagihan').innerText = formatRupiah(totalPrice);
  document.getElementById('cash-input').value = '';
  document.getElementById('modal-change-amount').innerText = 'Rp 0';
  document.getElementById('btn-confirm-pay').disabled = true;
  document.getElementById('checkout-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('cash-input').focus(), 150);
}

export function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.add('hidden');
}

export function setCashAmount(val) {
  const totalPrice = state.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const input = document.getElementById('cash-input');
  input.value = val === 'PAS' ? totalPrice : val;
  calculateChange();
}

export function calculateChange() {
  const totalPrice = state.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const cash = parseFloat(document.getElementById('cash-input').value) || 0;
  const change = cash - totalPrice;

  const changeEl = document.getElementById('modal-change-amount');
  const btnPay = document.getElementById('btn-confirm-pay');

  if (change >= 0 && cash > 0) {
    changeEl.innerText = formatRupiah(change);
    changeEl.className = 'text-base font-bold text-emerald-600';
    btnPay.disabled = false;
  } else {
    changeEl.innerText = 'Uang Kurang';
    changeEl.className = 'text-base font-bold text-rose-500';
    btnPay.disabled = true;
  }
}

export async function submitTransaction() {
  const totalPrice = state.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const cash = parseFloat(document.getElementById('cash-input').value) || 0;
  const change = cash - totalPrice;

  const payload = {
    tenant_id: state.tenantId,
    user_id: 'user_kasir_01',
    invoice_number: 'INV/' + Date.now(),
    total_amount: totalPrice,
    paid_amount: cash,
    change_amount: change,
    payment_method: 'CASH',
    items: state.cart
  };

  const btnPay = document.getElementById('btn-confirm-pay');
  btnPay.disabled = true;
  btnPay.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';

  try {
    const result = await API.checkout(payload);
    if (result.success) {
      showToast('Transaksi Berhasil Disimpan!');
      closeCheckoutModal();
      window.toggleMobileCartDrawer(false);
      clearCart();
      loadProducts();
    } else {
      showToast('Gagal: ' + result.error, 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  } finally {
    btnPay.disabled = false;
    btnPay.innerHTML = '<i class="fa-solid fa-check"></i> <span>Selesaikan Transaksi</span>';
  }
}
