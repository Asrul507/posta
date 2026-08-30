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

// Alias agar kompatibel ke semua kemungkinan pemanggilan
export const apiFetch = api;
export default api;
