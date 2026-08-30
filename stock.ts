import { Env } from "../types";

export async function handleStockAdjust(request: Request, env: Env): Promise<Response> {
  try {
    const payload: {
      tenant_id: string;
      product_id: string;
      type: "IN" | "OUT";
      qty: number;
      notes?: string;
    } = await request.json();

    const { tenant_id, product_id, type, qty, notes } = payload;

    const product: any = await env.DB.prepare("SELECT stock FROM products WHERE id = ? AND tenant_id = ?")
      .bind(product_id, tenant_id || "toko_demo_01")
      .first();

    if (!product) {
      return Response.json({ success: false, error: "Produk tidak ditemukan" }, { status: 404 });
    }

    const currentStock = product.stock;
    const change = type === "IN" ? Math.abs(qty) : -Math.abs(qty);
    const finalStock = currentStock + change;

    if (finalStock < 0) {
      return Response.json({ success: false, error: "Stok tidak boleh bernilai negatif" }, { status: 400 });
    }

    const movementId = "sm_" + Date.now();
    const statements = [
      env.DB.prepare("UPDATE products SET stock = ? WHERE id = ? AND tenant_id = ?")
        .bind(finalStock, product_id, tenant_id || "toko_demo_01"),
      env.DB.prepare(`
        INSERT INTO stock_movements (id, tenant_id, product_id, type, qty_change, stock_before, stock_after, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        movementId,
        tenant_id || "toko_demo_01",
        product_id,
        type,
        change,
        currentStock,
        finalStock,
        notes || "Penyesuaian Manual"
      )
    ];

    await env.DB.batch(statements);

    return Response.json({
      success: true,
      message: "Stok berhasil disesuaikan",
      stock_after: finalStock
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
