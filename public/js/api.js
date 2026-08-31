// Base API Request Helper
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
}

// Wrapper Object untuk method HTTP
export const api = {
  get: (url, options = {}) => apiRequest(url, { method: 'GET', ...options }),
  post: (url, body, options = {}) => apiRequest(url, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: (url, body, options = {}) => apiRequest(url, { method: 'PUT', body: JSON.stringify(body), ...options }),
  delete: (url, options = {}) => apiRequest(url, { method: 'DELETE', ...options })
};

// Export alias huruf besar untuk mendukung impor { API } di pos.js
export const API = api;
