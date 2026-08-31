import { Env, POPayload, UserPayload } from '../types';

export async function handlePORoutes(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  authUser?: UserPayload | null
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/po/submit' && request.method === 'POST') {
    const payload = (await request.json()) as POPayload;
    const tenant_id = authUser?.tenant_id || payload.tenant_id;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'Tenant ID wajib disertakan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!payload.items || payload.items.length === 0) {
      return new Response(JSON.stringify({ error: 'Daftar barang PO tidak boleh kosong' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const poId = 'PO-' + Date.now();
    const poNumber = 'PO/' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '/' + Date.now().toString().slice(-4);
    
    let totalAmount = 0;
    for (const item of payload.items) {
      totalAmount += item.quantity * item.cost_price;
    }

    const statements: any[] = [
      env.DB.prepare(`
        INSERT INTO purchase_orders (
          id, tenant_id, po_number, supplier_id, user_id,
          total_amount, status, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'received', ?, datetime('now'))
      `).bind(
        poId,
        tenant_id,
        poNumber,
        payload.supplier_id || 'SUP-DEFAULT',
        payload.user_id || authUser?.id || 'admin',
        totalAmount,
        payload.notes || ''
      )
    ];

    for (const item of payload.items) {
      const poItemId = 'POI-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      const subtotal = item.quantity * item.cost_price;

      statements.push(
        env.DB.prepare(`
          INSERT INTO purchase_order_items (
            id, po_id, product_id, quantity, cost_price, subtotal
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(poItemId, poId, item.product_id, item.quantity, item.cost_price, subtotal)
      );

      const currentProduct = await env.DB.prepare(
        'SELECT stock FROM products WHERE id = ? AND tenant_id = ?'
      ).bind(item.product_id, tenant_id).first<{ stock: number }>();

      const stockBefore = currentProduct?.stock || 0;
      const stockAfter = stockBefore + item.quantity;

      statements.push(
        env.DB.prepare(`
          UPDATE products
          SET stock = stock + ?, cost_price = ?, updated_at = datetime('now')
          WHERE id = ? AND tenant_id = ?
        `).bind(item.quantity, item.cost_price, item.product_id, tenant_id)
      );

      const movementId = 'MOV-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      statements.push(
        env.DB.prepare(`
          INSERT INTO stock_movements (
            id, tenant_id, product_id, type, quantity,
            stock_before, stock_after, reference_id, notes, created_at
          ) VALUES (?, ?, ?, 'purchase', ?, ?, ?, ?, 'Penerimaan PO', datetime('now'))
        `).bind(movementId, tenant_id, item.product_id, item.quantity, stockBefore, stockAfter, poId)
      );
    }

    await env.DB.batch(statements);

    return new Response(
      JSON.stringify({
        success: true,
        po_id: poId,
        po_number: poNumber,
        total_amount: totalAmount,
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
