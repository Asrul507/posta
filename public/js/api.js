import { state } from './state.js';

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('posta_token');
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(state.tenantId ? { 'x-tenant-id': state.tenantId } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(endpoint, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP error: ${response.status}`);
  return data;
}

export const api = {
  get: (url, options = {}) => apiRequest(url, { method: 'GET', ...options }),
  post: (url, body, options = {}) => apiRequest(url, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: (url, body, options = {}) => apiRequest(url, { method: 'PUT', body: JSON.stringify(body), ...options }),
  delete: (url, options = {}) => apiRequest(url, { method: 'DELETE', ...options }),
};

export const API = {
  ...api,
  async getProducts() {
    const data = await api.get('/api/products');
    return {
      success: true,
      data: (Array.isArray(data) ? data : data.data || []).map((product) => ({
        ...product,
        price: product.price ?? product.selling_price,
      })),
    };
  },
  checkout: (payload) => api.post('/api/checkout', payload),
  submitPO: (payload) => api.post('/api/po/submit', payload),
  getTransactions: () => api.get('/api/reports/transactions'),
  getPOHistory: () => api.get('/api/reports/po'),
};
