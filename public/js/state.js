export const state = {
  tenantId: null,
  tenantInfo: null,
  currentUser: null,
  currentShift: null, // Menyimpan sesi shift aktif
  products: [],
  cart: [],
  selectedCategory: 'ALL'
};

export const formatRupiah = (val) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(val || 0);

export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const isSuccess = type === 'success';
  const bgClass = isSuccess ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white';
  const icon = isSuccess ? 'fa-circle-check' : 'fa-circle-exclamation';

  toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl ${bgClass} text-xs font-bold transition-all duration-300 transform translate-y-2 opacity-0`;
  toast.innerHTML = `<i class="fa-solid ${icon} text-sm"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 50);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-x-4');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
