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
    // 2. POST /api/stock/adjust : Barang Masuk / Ubah Stok
    // ---------------------------------------------------------
    if (url.pathname === "/api/stock/adjust" && request.method === "POST") {
      try {
        const payload: any = await request.json();
        const { tenant_id, product_id, type, qty, notes } = payload;
        // type: 'IN' (tambah stok), 'OUT' (kurang stok)

        // Ambil stok saat ini
        const product: any = await env.DB.prepare("SELECT stock FROM products WHERE id = ? AND tenant_id = ?")
          .bind(product_id, tenant_id || "toko_demo_01")
          .first();

        if (!product) {
          return new Response(JSON.stringify({ success: false, error: "Produk tidak ditemukan" }), { status: 404 });
        }

        const currentStock = product.stock;
        const change = type === "IN" ? Math.abs(qty) : -Math.abs(qty);
        const finalStock = currentStock + change;

        if (finalStock < 0) {
          return new Response(JSON.stringify({ success: false, error: "Stok tidak boleh bernilai negatif" }), { status: 400 });
        }

        const movementId = "sm_" + Date.now();
        const statements = [
          // Update Stok di Produk
          env.DB.prepare("UPDATE products SET stock = ? WHERE id = ? AND tenant_id = ?")
            .bind(finalStock, product_id, tenant_id || "toko_demo_01"),
          // Catat Riwayat Mutasi
          env.DB.prepare(`
            INSERT INTO stock_movements (id, tenant_id, product_id, type, qty_change, stock_before, stock_after, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(movementId, tenant_id || "toko_demo_01", product_id, type, change, currentStock, finalStock, notes || "Update Manual")
        ];

        await env.DB.batch(statements);

        return new Response(JSON.stringify({ 
          success: true, 
          message: "Stok berhasil diperbarui", 
          stock_after: finalStock 
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
    // 3. POST /api/checkout : Transaksi Penjualan & Kurangi Stok
    // ---------------------------------------------------------
    if (url.pathname === "/api/checkout" && request.method === "POST") {
      try {
        const payload: any = await request.json();
        const { 
          tenant_id, 
          user_id, 
          invoice_number, 
          total_amount, 
          paid_amount, 
          change_amount, 
          payment_method, 
          items 
        } = payload;

        const transactionId = "trx_" + Date.now();
        const statements = [];

        statements.push(
          env.DB.prepare(`
            INSERT INTO transactions (id, tenant_id, user_id, invoice_number, total_amount, paid_amount, change_amount, payment_method)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            transactionId, 
            tenant_id, 
            user_id || "user_kasir_01", 
            invoice_number, 
            total_amount, 
            paid_amount, 
            change_amount, 
            payment_method
          )
        );

        for (const item of items) {
          const itemId = "item_" + Math.random().toString(36).substring(2, 11);
          
          statements.push(
            env.DB.prepare(`
              INSERT INTO transaction_items (id, transaction_id, product_id, product_name, price, cost_price, qty, subtotal)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              itemId, 
              transactionId, 
              item.id, 
              item.name, 
              item.price, 
              item.cost_price || 0, 
              item.qty, 
              item.price * item.qty
            )
          );

          // Update Stok
          statements.push(
            env.DB.prepare(`
              UPDATE products 
              SET stock = stock - ? 
              WHERE id = ? AND tenant_id = ?
            `).bind(item.qty, item.id, tenant_id)
          );

          // Catat Mutasi Barang Keluar (Penjualan)
          statements.push(
            env.DB.prepare(`
              INSERT INTO stock_movements (id, tenant_id, product_id, type, qty_change, stock_before, stock_after, notes)
              VALUES (?, ?, ?, 'OUT', ?, 0, 0, ?)
            `).bind("sm_" + Math.random().toString(36).substring(2, 11), tenant_id, item.id, -item.qty, `Penjualan Invoice: ${invoice_number}`)
          );
        }

        await env.DB.batch(statements);

        return new Response(JSON.stringify({ 
          success: true, 
          message: "Transaksi berhasil diproses", 
          transaction_id: transactionId 
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
    // 4. STATIC ASSETS
    // ---------------------------------------------------------
    return env.ASSETS.fetch(request);
  }
};
