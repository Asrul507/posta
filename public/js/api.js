// public/js/api.js
import { state } from './state.js';

export async function api(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json'
    };

    if (state && state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }

    const options = {
        method,
        headers
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(endpoint, options);
        const data = await response.json();

        if (response.status === 401) {
            // Token expired atau tidak valid
            if (window.postaAuth && window.postaAuth.logout) {
                window.postaAuth.logout();
            }
        }

        return data;
    } catch (err) {
        console.error(`API Error on ${method} ${endpoint}:`, err);
        throw err;
    }
}

// =========================================================================
// HELPER METHODS UNTUK MANAJEMEN STOK & PRODUK
// =========================================================================

/**
 * Mengirim penyesuaian stok (Stock Opname / Koreksi)
 * @param {string|number} productId 
 * @param {number} diffQty (Positif untuk tambah, Negatif untuk kurang)
 * @param {string} reason 
 */
export async function adjustStock(productId, diffQty, reason) {
    return await api('/api/stock/adjust', 'POST', {
        productId,
        diffQty: Number(diffQty),
        reason
    });
}

/**
 * Mengambil histori log audit mutasi stok berdasarkan Product ID
 * @param {string|number} productId 
 */
export async function getStockHistory(productId) {
    return await api(`/api/stock/history/${productId}`, 'GET');
}

/**
 * Mengambil ringkasan seluruh riwayat mutasi stok
 */
export async function getAllStockLogs() {
    return await api('/api/stock/logs', 'GET');
}

// Alias agar kompatibel ke semua kemungkinan pemanggilan
export const apiFetch = api;
export default api;
