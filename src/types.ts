export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

export interface UserPayload {
  id: string;
  tenant_id: string;
  // Subdomain toko (mis. "berkah") — disimpan di JWT agar semua route bisa
  // tetap cocok dengan data lama yang mungkin memakai teks subdomain sebagai
  // tenant_id, bukan hanya UUID resmi tenants.id.
  tenant_subdomain?: string;
  username: string;
  role: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  barcode: string;
  name: string;
  category: string;
  cost_price: number;
  selling_price: number;
  stock: number;
  unit: string;
  is_active: number;
}

export interface CartItem {
  product_id: string;
  barcode: string;
  name: string;
  price: number;
  cost_price: number;
  quantity: number;
  subtotal: number;
}

export interface CheckoutPayload {
  tenant_id: string;
  cashier_id: string;
  cashier_name: string;
  shift_id?: string | null;
  items: CartItem[];
  payment_method: 'cash' | 'qris' | 'card';
  cash_amount: number;
  change_amount: number;
  discount_amount?: number;
  customer_name?: string;
  notes?: string;
}

export interface POPayload {
  tenant_id: string;
  supplier_id: string;
  user_id: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    cost_price: number;
  }>;
  notes?: string;
}
