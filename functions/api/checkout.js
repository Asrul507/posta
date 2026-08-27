export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const payload = await request.json();
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

    // 2. Simpan Detail Item & Kurangi Stok
    for (const item of items) {
      const itemId = "item_" + Math.random().toString(36).substr(2, 9);
      
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

      // Pengurangan stok
      statements.push(
        env.DB.prepare(`
          UPDATE products 
          SET stock = stock - ? 
          WHERE id = ? AND tenant_id = ?
        `).bind(item.qty, item.id, tenant_id)
      );
    }

    // Eksekusi semua query secara aman (Atomik)
    await env.DB.batch(statements);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Transaksi berhasil diproses", 
      transaction_id: transactionId 
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
