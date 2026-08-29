export async function submitTransaction() {
  if (state.cart.length === 0) {
    showToast("Keranjang kosong!", "error");
    return;
  }

  const cashInput = document.getElementById('cash-input');
  const paidAmount = parseFloat(cashInput?.value) || 0;
  const totalBill = state.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  if (paidAmount < totalBill) {
    showToast("Nominal uang yang diterima kurang!", "error");
    return;
  }

  const btnConfirm = document.getElementById('btn-confirm-pay');
  if (btnConfirm) {
    btnConfirm.disabled = true;
    btnConfirm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
  }

  try {
    const payload = {
      tenant_id: state.tenantId, // Pastikan tenant_id aktif dikirim
      items: state.cart,
      paid_amount: paidAmount,
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
      showToast("Transaksi Berhasil!");
      closeCheckoutModal();
      clearCart();
      
      // Refresh katalog produk (karena stok berkurang)
      if (typeof window.loadProducts === 'function') {
        window.loadProducts();
      }
    } else {
      showToast("Gagal: " + result.error, "error");
    }
  } catch (err) {
    showToast("Terjadi kesalahan koneksi saat checkout.", "error");
  } finally {
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.innerHTML = '<i class="fa-solid fa-check"></i> <span>Selesaikan Transaksi</span>';
    }
  }
}
