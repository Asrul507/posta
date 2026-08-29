import { state, formatRupiah, showToast } from '../state.js';
import { clearCart, loadProducts } from './pos.js';

let lastCompletedTransaction = null;

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

  const cashierName = state.currentUser?.name || 'Kasir';
  const cartSnapshot = [...state.cart];

  try {
    const payload = {
      tenant_id: state.tenantId,
      items: cartSnapshot,
      paid_amount: cash,
      payment_method: 'CASH',
      cashier_name: cashierName
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

      // Simpan data untuk render struk
      lastCompletedTransaction = {
        invoice_number: result.invoice_number || ('INV-' + Date.now().toString().slice(-6)),
        date: new Date().toLocaleString('id-ID'),
        items: cartSnapshot,
        total_amount: total,
        paid_amount: cash,
        change_amount: cash - total,
        cashier_name: cashierName,
        tenant_info: state.tenantInfo || {}
      };

      // Bersihkan keranjang & perbarui stok
      clearCart();
      loadProducts();

      // Tampilkan Modal Struk Otomatis
      renderAndShowReceipt(lastCompletedTransaction);
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

// =========================================================================
// LOGIKA STRUK KASIR (RENDER & CETAK)
// =========================================================================
export function renderAndShowReceipt(data) {
  if (!data) return;

  const tInfo = data.tenant_info;
  const elStoreName = document.getElementById('rec-store-name');
  const elStoreAddress = document.getElementById('rec-store-address');
  const elStorePhone = document.getElementById('rec-store-phone');
  const elInvoice = document.getElementById('rec-invoice');
  const elDate = document.getElementById('rec-date');
  const elCashier = document.getElementById('rec-cashier');
  const elList = document.getElementById('rec-items-list');
  const elSubtotal = document.getElementById('rec-subtotal');
  const elPaid = document.getElementById('rec-paid');
  const elChange = document.getElementById('rec-change');

  if (elStoreName) elStoreName.innerText = tInfo.name || 'POSTA POS';
  if (elStoreAddress) elStoreAddress.innerText = tInfo.address || 'Alamat Toko';
  if (elStorePhone) elStorePhone.innerText = tInfo.phone ? `Telp: ${tInfo.phone}` : '';
  if (elInvoice) elInvoice.innerText = data.invoice_number;
  if (elDate) elDate.innerText = data.date;
  if (elCashier) elCashier.innerText = data.cashier_name;

  if (elList) {
    elList.innerHTML = data.items.map(item => `
      <div class="grid grid-cols-12 gap-1 items-start">
        <div class="col-span-6 truncate font-medium">${item.name}</div>
        <div class="col-span-2 text-center font-bold">${item.qty}</div>
        <div class="col-span-4 text-right">${formatRupiah(item.price * item.qty)}</div>
      </div>
    `).join('');
  }

  if (elSubtotal) elSubtotal.innerText = formatRupiah(data.total_amount);
  if (elPaid) elPaid.innerText = formatRupiah(data.paid_amount);
  if (elChange) elChange.innerText = formatRupiah(data.change_amount);

  const receiptModal = document.getElementById('receipt-modal');
  if (receiptModal) receiptModal.classList.remove('hidden');
}

export function closeReceiptModal() {
  const receiptModal = document.getElementById('receipt-modal');
  if (receiptModal) receiptModal.classList.add('hidden');
}

export function printReceipt() {
  window.print();
}
