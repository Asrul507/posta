import { Env, CheckoutPayload, UserPayload } from '../types';

export async function handleCheckoutRoutes(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  authUser: UserPayload | null
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/checkout' && request.method === 'POST') {
    const payload = (await request.json()) as CheckoutPayload;
    const tenant_id = authUser?.tenant_id || payload.tenant_id;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'Tenant ID wajib disertakan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!payload.items || payload.items.length === 0) {
      return new Response(JSON.stringify({ error: 'Keranjang belanja kosong' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const transactionId = 'TRX-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const invoiceNumber = 'INV/' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '/' + Date.now().toString().slice(-6);

    let totalAmount = 0;
    let totalCost = 0;

    for (const item of payload.items) {
      totalAmount += item.subtotal;
      totalCost += (item.cost_price || 0) * item.quantity;
    }

    const discountAmount = payload.discount_amount || 0;
    const finalAmount = totalAmount - discountAmount;

    // Pastikan skema tabel mendukung shift_id
    const insertTx = env.DB.prepare(`
      INSERT INTO transactions (
        id, tenant_id, invoice_number, shift_id, cashier_id, cashier_name,
        total_amount, discount_amount, final_amount, total_cost,
        payment_method, cash_amount, change_amount, customer_name, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      transactionId,
      tenant_id,
      invoiceNumber,
      payload.shift_id || null,
      payload.cashier_id || authUser?.id || 'cashier',
      payload.cashier_name || authUser?.username || 'Kasir',
      totalAmount,
      discountAmount,
      finalAmount,
      totalCost,
      payload.payment_method || 'cash',
      payload.cash_amount || finalAmount,
      payload.change_amount || 0,
      payload.customer_name || 'Umum',
      payload.notes || ''
    );

    const statements: D1PreparedStatement[] = [insertTx];

    // Simpan detail item transaksi & kurangi stok
    for (const item of payload.items) {
      const itemId = 'TXI-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      
      statements.push(
        env.DB.prepare(`
          INSERT INTO transaction_items (
            id, transaction_id, product_id, product_name, barcode,
            quantity, cost_price, selling_price, subtotal
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          itemId,
          transactionId,
          item.product_id,
          item.name,
          item.barcode || '',
          item.quantity,
          item.cost_price || 0,
          item.price,
          item.subtotal
        )
      );

      statements.push(
        env.DB.prepare(`
          UPDATE products
          SET stock = stock - ?, updated_at = datetime('now')
          WHERE id = ? AND tenant_id = ?
        `).bind(item.quantity, item.product_id, tenant_id)
      );

      // Catat buku besar mutasi stok
      const movementId = 'MOV-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      statements.push(
        env.DB.prepare(`
          INSERT INTO stock_movements (
            id, tenant_id, product_id, type, quantity,
            reference_id, notes, created_at
          ) VALUES (?, ?, ?, 'sale', ?, ?, 'Penjualan POS', datetime('now'))
        `).bind(movementId, tenant_id, item.product_id, -item.quantity, transactionId)
      );
    }

    await env.DB.batch(statements);

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: transactionId,
        invoice_number: invoiceNumber,
        final_amount: finalAmount,
        change_amount: payload.change_amount || 0,
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
