import { Env } from "../types";

export async function handleCheckout(request: Request, env: Env): Promise<Response> {
  try {
    const payload: {
      tenant_id?: string;
      items: Array<{
        id: string;
        name: string;
        cost_price?: number;
        price: number;
        qty: number;
      }>;
      payment_method?: string;
      paid_amount: number;
      cashier_name?: string;
    } = await request.json();

    const url = new URL(request.url);
    const host = url.hostname.toLowerCase().split(":")[0];
    const subdomain = host.endsWith(".gpro.my.id") ? host.replace(".gpro.my.id", "") : "berkah";

    // 1. Dapatkan tenant_id yang valid dari database berdasarkan subdomain atau payload
    let tenantId = payload.tenant_id;
    const tenant = await env.DB.prepare(
      "SELECT id FROM tenants WHERE subdomain = ? OR id = ? LIMIT 1"
    ).bind(subdomain, tenantId || "").first();

    if (!tenant) {
      return Response.json({ success: false, error: "Toko/Tenant tidak valid atau tidak ditemukan di database." }, { status: 400 });
    }

    tenantId = tenant.id as string;

    if (!payload.items || payload.items.length === 0) {
      return Response.json({ success: false, error: "Keranjang belanja kosong." }, { status: 400 });
    }

    const transactionId = "trx_" + Date.now();
    const invoiceNumber = "INV-" + Date.now().toString().slice(-8);
    const totalAmount = payload.items.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const paidAmount = Number(payload.paid_amount) || totalAmount;
    const changeAmount = Math.max(0, paidAmount - totalAmount);

    const statements: any[] = [];

    // 2. Insert Header Transaksi
    statements.push(
      env.DB.prepare(`
        INSERT INTO transactions (id, tenant_id, invoice_number, payment_method, total_amount, paid_amount, change_amount, cashier_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        transactionId,
        tenantId,
        invoiceNumber,
        payload.payment_method || "CASH",
        totalAmount,
        paidAmount,
        changeAmount,
        payload.cashier_name || "Kasir"
      )
    );

    // 3. Insert Items & Potong Stok Produk
    for (const item of payload.items) {
      const itemId = "titem_" + Math.random().toString(36).substring(2, 9);
      const subtotal = item.price * item.qty;

      statements.push(
        env.DB.prepare(`
          INSERT INTO transaction_items (id, transaction_id, product_id, product_name, cost_price, price, qty, subtotal)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          itemId,
          transactionId,
          item.id || "manual_item",
          item.name,
          item.cost_price || 0,
          item.price,
          item.qty,
          subtotal
        )
      );

      // Kurangi stok jika item memiliki id produk valid di katalog
      if (item.id) {
        statements.push(
          env.DB.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ? AND tenant_id = ?")
            .bind(item.qty, item.id, tenantId)
        );
      }
    }

    // Eksekusi secara atomic (Batch Transaction)
    await env.DB.batch(statements);

    return Response.json({
      success: true,
      message: "Transaksi berhasil disimpan",
      data: {
        transaction_id: transactionId,
        invoice_number: invoiceNumber,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        change_amount: changeAmount
      }
    });
  } catch (err: any) {
    console.error("Checkout Error:", err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
