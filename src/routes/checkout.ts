import { Env, CartItem } from "../types";

export async function handleCheckout(request: Request, env: Env): Promise<Response> {
  try {
    const payload: {
      tenant_id: string;
      user_id?: string;
      invoice_number: string;
      total_amount: number;
      paid_amount: number;
      change_amount: number;
      payment_method?: string;
      items: CartItem[];
    } = await request.json();

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
        tenant_id || "toko_demo_01",
        user_id || "user_kasir_01",
        invoice_number,
        total_amount,
        paid_amount,
        change_amount,
        payment_method || "CASH"
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

      // Potong Stok
      statements.push(
        env.DB.prepare(`
          UPDATE products 
          SET stock = stock - ? 
          WHERE id = ? AND tenant_id = ?
        `).bind(item.qty, item.id, tenant_id || "toko_demo_01")
      );

      // Catat Mutasi Keluar
      const movementId = "sm_" + Math.random().toString(36).substring(2, 11);
      statements.push(
        env.DB.prepare(`
          INSERT INTO stock_movements (id, tenant_id, product_id, type, qty_change, notes)
          VALUES (?, ?, ?, 'OUT', ?, ?)
        `).bind(
          movementId,
          tenant_id || "toko_demo_01",
          item.id,
          -item.qty,
          `Penjualan Invoice: ${invoice_number}`
        )
      );
    }

    await env.DB.batch(statements);

    return Response.json({
      success: true,
      message: "Transaksi berhasil diproses",
      transaction_id: transactionId
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
