import { state } from './state.js';

export const API = {
  async getProducts() {
    const res = await fetch(`/api/products?tenant_id=${state.tenantId}`);
    return res.json();
  },
  async checkout(payload) {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  },
  async submitPO(payload) {
    const res = await fetch('/api/po/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  },
  async getTransactions() {
    const res = await fetch(`/api/reports/transactions?tenant_id=${state.tenantId}`);
    return res.json();
  },
  async getPOHistory() {
    const res = await fetch(`/api/reports/po?tenant_id=${state.tenantId}`);
    return res.json();
  }
};
