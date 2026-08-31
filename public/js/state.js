export const state = {
  tenantId: 'berkah',
  currentUser: null,
  currentShift: null,
  products: [],
  cart: [],
  poItems: [],
  selectedCategory: 'ALL',
};

export function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast show ${type}`;
  window.setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}
