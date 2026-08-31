import { state, showToast } from '../state.js';
import { api } from '../api.js';

const ROLE_LABELS = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  CASHIER: 'Kasir',
};

const ROLE_RANK = { CASHIER: 1, ADMIN: 2, OWNER: 3 };

let employeesCache = [];

function myRank() {
  const role = state.currentUser?.role;
  if (role === 'SUPERADMIN' || role === 'DEVELOPER') return 99;
  return ROLE_RANK[role] || 0;
}

function isFullAccess() {
  const role = state.currentUser?.role;
  return role === 'OWNER' || role === 'SUPERADMIN' || role === 'DEVELOPER';
}

export async function loadEmployees() {
  const tbody = document.getElementById('employees-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data karyawan...</td></tr>`;

  try {
    const result = await api.get('/api/employees');
    if (result.success && result.data && result.data.length > 0) {
      employeesCache = result.data;
      const currentRank = myRank();

      tbody.innerHTML = result.data
        .map((u) => {
          const targetRank = ROLE_RANK[u.role] || 0;
          const canEdit = isFullAccess() ? true : targetRank < currentRank;
          const roleBadgeClass =
            u.role === 'OWNER'
              ? 'bg-amber-100 text-amber-700'
              : u.role === 'ADMIN'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-emerald-100 text-emerald-700';

          return `
            <tr class="hover:bg-slate-50">
              <td class="py-2.5 px-3 font-bold text-slate-800">${u.full_name}</td>
              <td class="py-2.5 px-3 font-mono text-slate-500">${u.username}</td>
              <td class="py-2.5 px-3">
                <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold ${roleBadgeClass}">${
            ROLE_LABELS[u.role] || u.role
          }</span>
              </td>
              <td class="py-2.5 px-3 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }">
                  ${u.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </td>
              <td class="py-2.5 px-3 text-center">
                ${
                  canEdit
                    ? `<button onclick="window.openEditEmployeeModal('${u.id}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-700">
                        <i class="fa-solid fa-pen"></i> Edit
                      </button>`
                    : `<span class="text-[10px] text-slate-400">Tidak ada akses</span>`
                }
              </td>
            </tr>
          `;
        })
        .join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400">Belum ada karyawan lain untuk toko ini.</td></tr>`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-rose-500">${
      err.message || 'Gagal memuat data karyawan.'
    }</td></tr>`;
  }
}

function populateRoleOptions() {
  const select = document.getElementById('employee-role-input');
  if (!select) return;

  select.innerHTML = isFullAccess()
    ? `<option value="OWNER">Owner (Akses Penuh Toko)</option>
       <option value="ADMIN">Admin (Kelola Produk, Stok &amp; Kasir)</option>
       <option value="CASHIER">Kasir (Transaksi, Shift, Barang Masuk)</option>`
    : `<option value="CASHIER">Kasir (Transaksi, Shift, Barang Masuk)</option>`;
}

export function openAddEmployeeModal() {
  document.getElementById('employee-modal-title').innerText = 'Tambah Karyawan Baru';
  document.getElementById('employee-id-input').value = '';
  document.getElementById('employee-fullname-input').value = '';
  document.getElementById('employee-username-input').value = '';
  const passwordInput = document.getElementById('employee-password-input');
  passwordInput.value = '';
  passwordInput.placeholder = '••••••••';
  passwordInput.required = true;

  populateRoleOptions();
  document.getElementById('employee-role-input').value = 'CASHIER';
  document.getElementById('employee-active-row').classList.add('hidden');
  document.getElementById('employee-modal').classList.remove('hidden');
}

export function openEditEmployeeModal(id) {
  const u = employeesCache.find((e) => e.id === id);
  if (!u) return;

  document.getElementById('employee-modal-title').innerText = 'Ubah Data Karyawan';
  document.getElementById('employee-id-input').value = u.id;
  document.getElementById('employee-fullname-input').value = u.full_name;
  document.getElementById('employee-username-input').value = u.username;
  const passwordInput = document.getElementById('employee-password-input');
  passwordInput.value = '';
  passwordInput.placeholder = 'Kosongkan jika tidak diubah';
  passwordInput.required = false;

  populateRoleOptions();
  document.getElementById('employee-role-input').value = u.role;
  document.getElementById('employee-active-row').classList.remove('hidden');
  document.getElementById('employee-active-input').checked = !!u.is_active;
  document.getElementById('employee-modal').classList.remove('hidden');
}

export function closeEmployeeModal() {
  document.getElementById('employee-modal').classList.add('hidden');
}

export async function submitEmployeeForm() {
  const id = document.getElementById('employee-id-input').value;
  const full_name = document.getElementById('employee-fullname-input').value.trim();
  const username = document.getElementById('employee-username-input').value.trim();
  const password = document.getElementById('employee-password-input').value.trim();
  const role = document.getElementById('employee-role-input').value;
  const is_active = document.getElementById('employee-active-input').checked ? 1 : 0;

  if (!full_name || !username || (!id && !password)) {
    showToast('Harap lengkapi nama, username, dan password!', 'error');
    return;
  }

  const btn = document.getElementById('btn-save-employee');
  if (btn) btn.disabled = true;

  try {
    let result;
    if (id) {
      const payload = { full_name, username, role, is_active };
      if (password) payload.password = password;
      result = await api.put(`/api/employees/${id}`, payload);
    } else {
      result = await api.post('/api/employees', { full_name, username, password, role });
    }

    if (result.success) {
      showToast(result.message || 'Data karyawan berhasil disimpan.');
      closeEmployeeModal();
      loadEmployees();
    } else {
      showToast(result.error || 'Gagal menyimpan data karyawan.', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Terjadi kesalahan jaringan.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
