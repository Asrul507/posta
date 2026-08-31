import { state } from '../state.js';
import { api } from '../api.js';
import { playSuccessSound, playErrorSound } from '../audio.js';
import { saveOfflineTransaction, syncOfflineTransactions } from '../db.js';

let selectedPaymentMethod = 'cash';
let currentReceiptData = null;

window.addEventListener('online', () => {
  syncOfflineTransactions(api, (msg, type) => {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = msg;
      toast.className = `toast show ${type || ''}`;
      setTimeout(() => (toast.className = 'toast'), 3000);
    }
  });
});

export function initCheckoutEvents() {
  const btnCheckout = document.getElementById('btn-checkout');
  const btnProcessPayment = document.getElementById('btn-process-payment');
  const btnCancelCheckout = document.getElementById('btn-cancel-checkout');
  const btnCloseReceipt = document.getElementById('btn-close-receipt');
  const btnPrintReceipt = document.getElementById('btn-print-receipt');
  const quickPayButtons = document.querySelectorAll('.quick-pay-btn');
  const paymentMethodRadios = document.querySelectorAll('input[name="payment-method"]');
  const cashInput = document.getElementById('cash-input');

  if (btnCheckout) {
    btnCheckout.addEventListener('click', openCheckoutModal);
  }

  if (btnCancelCheckout) {
    btnCancelCheckout.addEventListener('click', closeCheckoutModal);
  }

  if (btnCloseReceipt) {
    btnCloseReceipt.addEventListener('click', closeReceiptModal);
  }

  if (btnPrintReceipt) {
    btnPrintReceipt.addEventListener('click', printThermalReceipt);
  }

  paymentMethodRadios.forEach((radio) => {
    radio.addEventListener('change', (e) => {
      selectedPaymentMethod = e.target.value;
      const cashSection = document.getElementById('cash-payment-section');
      const qrisSection = document.getElementById('qris-payment-section');

      if (selectedPaymentMethod === 'cash') {
        if (cashSection) cashSection.style.display = 'block';
        if (qrisSection) qrisSection.style.display = 'none';
      } else if (selectedPaymentMethod === 'qris') {
        if (cashSection) cashSection.style.display = 'none';
        if (qrisSection) qrisSection.style.display = 'block';
      } else {
        if (cashSection) cashSection.style.display = 'none';
        if (qrisSection) qrisSection.style.display = 'none';
      }
      calculateChange();
    });
  });

  quickPayButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.getAttribute('data-value'), 10);
      if (cashInput) {
        cashInput.value = val;
        calculateChange();
      }
    });
  });

  if (cashInput) {
    cashInput.addEventListener('input', calculateChange);
  }

  if (btnProcessPayment) {
    btnProcessPayment.addEventListener('click', processCheckout);
  }
}

function calculateTotal() {
  return state.cart.reduce((sum, item) => sum + item.subtotal, 0);
}

function calculateChange() {
  const total = calculateTotal();
  const cashInput = document.getElementById('cash-input');
  const changeDisplay = document.getElementById('change-display');
  const btnProcessPayment = document.getElementById('btn-process-payment');

  if (!cashInput || !changeDisplay) return;

  if (selectedPaymentMethod === 'cash') {
    const cash = parseFloat(cashInput.value) || 0;
    const change = cash - total;
    changeDisplay.textContent = `Kembalian: Rp ${Math.max(0, change).toLocaleString('id-ID')}`;

    if (btnProcessPayment) {
      btnProcessPayment.disabled = cash < total;
    }
  } else {
    changeDisplay.textContent = 'Kembalian: Rp 0';
    if (btnProcessPayment) {
      btnProcessPayment.disabled = false;
    }
  }
}

function openCheckoutModal() {
  if (state.cart.length === 0) {
    alert('Keranjang belanja masih kosong!');
    return;
  }

  const modal = document.getElementById('modal-checkout');
  const total = calculateTotal();
  const totalDisplay = document.getElementById('checkout-total-display');
  const cashInput = document.getElementById('cash-input');

  if (totalDisplay) {
    totalDisplay.textContent = `Rp ${total.toLocaleString('id-ID')}`;
  }

  if (cashInput) {
    cashInput.value = total;
  }

  calculateChange();
  if (modal) modal.style.display = 'flex';
}

function closeCheckoutModal() {
  const modal = document.getElementById('modal-checkout');
  if (modal) modal.style.display = 'none';
}

function closeReceiptModal() {
  const modal = document.getElementById('modal-receipt');
  if (modal) modal.style.display = 'none';
}

async function processCheckout() {
  const total = calculateTotal();
  const cashInput = document.getElementById('cash-input');
  const cashAmount = selectedPaymentMethod === 'cash' ? parseFloat(cashInput?.value || total) : total;
  const changeAmount = selectedPaymentMethod === 'cash' ? Math.max(0, cashAmount - total) : 0;

  const payload = {
    tenant_id: state.currentUser?.tenant_id || 'berkah',
    cashier_id: state.currentUser?.id || 'cashier',
    cashier_name: state.currentUser?.full_name || state.currentUser?.username || 'Kasir',
    shift_id: state.currentShift ? state.currentShift.id : null,
    items: [...state.cart],
    payment_method: selectedPaymentMethod,
    cash_amount: cashAmount,
    change_amount: changeAmount,
    discount_amount: 0,
    customer_name: 'Pelanggan Umum',
  };

  const btnProcessPayment = document.getElementById('btn-process-payment');
  if (btnProcessPayment) {
    btnProcessPayment.disabled = true;
    btnProcessPayment.textContent = 'Memproses...';
  }

  try {
    let result;
    if (navigator.onLine) {
      try {
        result = await api.post('/api/checkout', payload);
      } catch (networkErr) {
        console.warn('Network API fail, fallback to IndexedDB:', networkErr);
        await saveOfflineTransaction(payload);
        result = {
          success: true,
          invoice_number: 'OFFLINE-' + Date.now().toString().slice(-6),
          final_amount: total,
          change_amount: changeAmount,
          is_offline: true,
        };
      }
    } else {
      await saveOfflineTransaction(payload);
      result = {
        success: true,
        invoice_number: 'OFFLINE-' + Date.now().toString().slice(-6),
        final_amount: total,
        change_amount: changeAmount,
        is_offline: true,
      };
    }

    if (result && result.success) {
      playSuccessSound();
      currentReceiptData = {
        invoice: result.invoice_number,
        date: new Date().toLocaleString('id-ID'),
        cashier: payload.cashier_name,
        customer: payload.customer_name,
        items: payload.items,
        total: result.final_amount,
        payment_method: payload.payment_method,
        cash: payload.cash_amount,
        change: result.change_amount,
        is_offline: result.is_offline || false,
      };

      closeCheckoutModal();
      state.clearCart();
      showReceiptModal(currentReceiptData);
    }
  } catch (err) {
    playErrorSound();
    alert('Gagal memproses pembayaran: ' + err.message);
  } finally {
    if (btnProcessPayment) {
      btnProcessPayment.disabled = false;
      btnProcessPayment.textContent = 'Selesaikan Pembayaran';
    }
  }
}

function showReceiptModal(data) {
  const modal = document.getElementById('modal-receipt');
  const receiptContainer = document.getElementById('receipt-print-area');

  if (receiptContainer) {
    const itemsHtml = data.items
      .map(
        (item) => `
      <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 3px;">
        <span>${item.name} x${item.quantity}</span>
        <span>Rp ${item.subtotal.toLocaleString('id-ID')}</span>
      </div>
    `
      )
      .join('');

    receiptContainer.innerHTML = `
      <div style="text-align: center; margin-bottom: 8px;">
        <h3 style="margin: 0; font-size: 16px;">POSTA POS</h3>
        <p style="margin: 2px 0; font-size: 11px;">${data.date}</p>
        <p style="margin: 2px 0; font-size: 11px;">No: ${data.invoice} ${data.is_offline ? '<b style="color:orange;">(OFFLINE)</b>' : ''}</p>
        <p style="margin: 2px 0; font-size: 11px;">Kasir: ${data.cashier}</p>
      </div>
      <hr style="border-top: 1px dashed #bbb; margin: 6px 0;">
      <div>${itemsHtml}</div>
      <hr style="border-top: 1px dashed #bbb; margin: 6px 0;">
      <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold;">
        <span>TOTAL:</span>
        <span>Rp ${data.total.toLocaleString('id-ID')}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 4px;">
        <span>Metode:</span>
        <span>${data.payment_method.toUpperCase()}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12px;">
        <span>Bayar:</span>
        <span>Rp ${data.cash.toLocaleString('id-ID')}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12px;">
        <span>Kembalian:</span>
        <span>Rp ${data.change.toLocaleString('id-ID')}</span>
      </div>
      <hr style="border-top: 1px dashed #bbb; margin: 8px 0;">
      <p style="text-align: center; font-size: 11px; margin: 0;">Terima kasih atas kunjungan Anda!</p>
    `;
  }

  if (modal) modal.style.display = 'flex';
}

function printThermalReceipt() {
  const receiptArea = document.getElementById('receipt-print-area');
  if (!receiptArea) return;

  const printWindow = window.open('', '_blank', 'width=350,height=600');
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>Struk Pembayaran</title>
          <style>
            @page { margin: 0; size: 58mm auto; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              font-size: 12px; 
              width: 58mm; 
              margin: 0; 
              padding: 6px; 
              color: #000;
            }
            @media print {
              body { width: 58mm; }
            }
          </style>
        </head>
        <body>
          ${receiptArea.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }
}
