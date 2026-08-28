export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ---------------------------------------------------------
    // 1. GET /api/products : Ambil Daftar Produk & Stok
    // ---------------------------------------------------------
    if (url.pathname === "/api/products" && request.method === "GET") {
      const tenantId = url.searchParams.get("tenant_id") || "toko_demo_01";
      try {
        const query = `
          SELECT 
            p.id, 
            p.barcode, 
            p.name, 
            p.price, 
            p.cost_price, 
            p.stock, 
            p.unit, 
            c.name AS category_name
          FROM products p
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE p.tenant_id = ? AND p.is_active = 1
          ORDER BY p.name ASC
        `;
        const { results } = await env.DB.prepare(query).bind(tenantId).all();
        return new Response(JSON.stringify({ success: true, data: results }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // ---------------------------------------------------------
    // 2. POST /api/po/submit : Batch Purchase Order & Auto Add Produk
    // ---------------------------------------------------------
    if (url.pathname === "/api/po/submit" && request.method === "POST") {
      try {
        const payload: any = await request.json();
        const { tenant_id, po_number, supplier_name, notes, items } = payload;

        if (!items || items.length === 0) {
          return new Response(JSON.stringify({ success: false, error: "Daftar barang PO tidak boleh kosong" }), { status: 400 });
        }

        const poId = "po_" + Date.now();
        const statements = [];

        // 1. Header Purchase Order
        statements.push(
          env.DB.prepare(`
            INSERT INTO purchase_orders (id, tenant_id, po_number, supplier_name, notes, total_items)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(poId, tenant_id || "toko_demo_01", po_number, supplier_name || "Supplier Umum", notes || "", items.length)
        );

        // 2. Proses tiap item PO
        for (const item of items) {
          let productId = item.id;

          // Jika barang BARU (belum terdaftar di master database)
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
                item.qty, // Stok awal langsung diset ke qty PO
                item.unit || "pcs"
              )
            );
          } else {
            // Jika barang SUDAH ADA: Update stok dan harga beli terbaru
            statements.push(
              env.DB.prepare(`
                UPDATE products 
                SET stock = stock + ?, cost_price = COALESCE(?, cost_price)
                WHERE id = ? AND tenant_id = ?
              `).bind(item.qty, item.cost_price || null, productId, tenant_id || "toko_demo_01")
            );
          }

          // Catat Item ke Detail PO
          const poItemId = "poi_" + Math.random().toString(36).substring(2, 9);
          statements.push(
            env.DB.prepare(`
              INSERT INTO purchase_order_items (id, po_id, product_id, product_name, qty, cost_price)
              VALUES (?, ?, ?, ?, ?, ?)
            `).bind(poItemId, poId, productId, item.name, item.qty, item.cost_price || 0)
          );

          // Catat Riwayat Mutasi Stok Masuk
          const movementId = "sm_" + Math.random().toString(36).substring(2, 9);
          statements.push(
            env.DB.prepare(`
              INSERT INTO stock_movements (id, tenant_id, product_id, type, qty_change, stock_before, stock_after, notes)
              VALUES (?, ?, ?, 'IN', ?, 0, 0, ?)
            `).bind(movementId, tenant_id || "toko_demo_01", productId, item.qty, `PO No: ${po_number} (${supplier_name || 'Restock'})`)
          );
        }

        // Eksekusi semua secara atomik (aman & konsisten)
        await env.DB.batch(statements);

        return new Response(JSON.stringify({ 
          success: true, 
          message: `PO ${po_number} berhasil disimpan dan stok telah diperbarui!`,
          po_id: poId
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // ---------------------------------------------------------
    // 3. POST /api/checkout : Kasir Penjualan
    // ---------------------------------------------------------
    if (url.pathname === "/api/checkout" && request.method === "POST") {
      try {
        const payload: any = await request.json();
        const { tenant_id, user_id, invoice_number, total_amount, paid_amount, change_amount, payment_method, items } = payload;
        const transactionId = "trx_" + Date.now();
        const statements = [];

        statements.push(
          env.DB.prepare(`
            INSERT INTO transactions (id, tenant_id, user_id, invoice_number, total_amount, paid_amount, change_amount, payment_method)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(transactionId, tenant_id, user_id || "user_kasir_01", invoice_number, total_amount, paid_amount, change_amount, payment_method)
        );

        for (const item of items) {
          const itemId = "item_" + Math.random().toString(36).substring(2, 11);
          statements.push(
            env.DB.prepare(`
              INSERT INTO transaction_items (id, transaction_id, product_id, product_name, price, cost_price, qty, subtotal)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(itemId, transactionId, item.id, item.name, item.price, item.cost_price || 0, item.qty, item.price * item.qty)
          );

          statements.push(
            env.DB.prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND tenant_id = ?").bind(item.qty, item.id, tenant_id)
          );

          statements.push(
            env.DB.prepare(`
              INSERT INTO stock_movements (id, tenant_id, product_id, type, qty_change, stock_before, stock_after, notes)
              VALUES (?, ?, ?, 'OUT', ?, 0, 0, ?)
            `).bind("sm_" + Math.random().toString(36).substring(2, 11), tenant_id, item.id, -item.qty, `Penjualan Invoice: ${invoice_number}`)
          );
        }

        await env.DB.batch(statements);

        return new Response(JSON.stringify({ success: true, message: "Transaksi berhasil", transaction_id: transactionId }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // ---------------------------------------------------------
    // 4. STATIC ASSETS
    // ---------------------------------------------------------
    return env.ASSETS.fetch(request);
  }
};
