import { Env } from "../types";

// 1. Ambil Riwayat Transaksi Kasir
export async function handleGetTransactions(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenant_id") || "toko_demo_01";

  try {
    const query = `
      SELECT id, invoice_number, total_amount, paid_amount, change_amount, payment_method, created_at
      FROM transactions
      WHERE tenant_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `;
    const { results } = await env.DB.prepare(query).bind(tenantId).all();
    return Response.json({ success: true, data: results });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 2. Ambil Riwayat Dokumen Barang Masuk (PO)
export async function handleGetPOHistory(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenant_id") || "toko_demo_01";

  try {
    const query = `
      SELECT id, po_number, supplier_name, notes, total_items, created_at
      FROM purchase_orders
      WHERE tenant_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `;
    const { results } = await env.DB.prepare(query).bind(tenantId).all();
    return Response.json({ success: true, data: results });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
