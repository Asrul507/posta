export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export interface Product {
  id: string;
  tenant_id: string;
  barcode?: string;
  name: string;
  price: number;
  cost_price?: number;
  stock: number;
  unit?: string;
  category_name?: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  cost_price?: number;
  qty: number;
}

export interface POItem {
  id?: string;
  name: string;
  barcode?: string;
  cost_price: number;
  price?: number;
  unit?: string;
  qty: number;
  is_new?: boolean;
}
