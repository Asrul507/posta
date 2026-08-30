import { Env, POItem } from "../types";

export async function handleSubmitPO(request: Request, env: Env): Promise<Response> {
  try {
    const payload: {
      tenant_id: string;
      po_number: string;
      supplier_name?: string;
      notes?: string;
      items: POItem[];
    } = await request.json();

    const { tenant_id, po_number, supplier_name, notes, items } = payload;

    if (!items || items.length === 0) {
      return Response.json({ success: false, error: "Daftar barang PO tidak boleh kosong" }, { status: 400 });
    }

    const poId = "po_" + Date.now();
    const statements = [];

    // 1. Simpan Header Dokumen PO
    statements.push(
      env.DB.prepare(`
        INSERT INTO purchase_orders (id, tenant_id, po_number, supplier_name, notes, total_items)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        poId,
        tenant_id || "toko_demo_01",
        po_number,
        supplier_name || "Supplier Umum",
        notes || "",
        items.length
      )
    );

    // 2. Loop Items
    for (const item of items) {
      let productId = item.id;

      if (item.is_new) {
        productId = "prod_" + Math.random().toString(36).substring(2, 9);
        statements.push(
          env.DB.prepare(`
            INSERT INTO products (id, tenant_id, barcode, name, price, cost_price, stock, unit, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
          `).bind(
            productId,
            tenant_id || "toko_demo_01",
            item.barcode || null,
            item.name,
            item.price || (item.cost_price ? item.cost_price * 1.2 : 0),
            item.cost_price || 0,
            item.qty,
            item.unit || "pcs"
          )
        );
      } else {
        statements.push(
          env.DB.prepare(`
            UPDATE products 
            SET stock = stock + ?, cost_price = COALESCE(?, cost_price)
            WHERE id = ? AND tenant_id = ?
          `).bind(item.qty, item.cost_price || null, productId, tenant_id || "toko_demo_01")
        );
      }

      // Catat Detail PO
      const poItemId = "poi_" + Math.random().toString(36).substring(2, 9);
      statements.push(
        env.DB.prepare(`
          INSERT INTO purchase_order_items (id, po_id, product_id, product_name, qty, cost_price)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(poItemId, poId, productId, item.name, item.qty, item.cost_price || 0)
      );

      // Catat Mutasi Masuk (dengan stock_before & stock_after diisi nilai default 0)
      const movementId = "sm_" + Math.random().toString(36).substring(2, 9);
      statements.push(
        env.DB.prepare(`
          INSERT INTO stock_movements (id, tenant_id, product_id, type, qty_change, stock_before, stock_after, notes)
          VALUES (?, ?, ?, 'IN', ?, 0, 0, ?)
        `).bind(
          movementId,
          tenant_id || "toko_demo_01",
          productId,
          item.qty,
          `PO No: ${po_number} (${supplier_name || 'Restock'})`
        )
      );
    }

    await env.DB.batch(statements);

    return Response.json({
      success: true,
      message: `PO ${po_number} berhasil disimpan dan stok telah diperbarui!`,
      po_id: poId
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
