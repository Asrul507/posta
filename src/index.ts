export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ==========================================
    // 1. ENDPOINT: GET /api/products
    // ==========================================
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

    // ==========================================
    // 2. ENDPOINT: POST /api/checkout
    // ==========================================
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

        // 1. Simpan Header Transaksi
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

        // 2. Simpan Detail Item & Potong Stok
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

          statements.push(
            env.DB.prepare(`
              UPDATE products 
              SET stock = stock - ? 
              WHERE id = ? AND tenant_id = ?
            `).bind(item.qty, item.id, tenant_id)
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

    // ==========================================
    // 3. STATIC ASSETS: Layani file HTML di folder public
    // ==========================================
    return env.ASSETS.fetch(request);
  }
};
