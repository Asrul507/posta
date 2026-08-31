import { Env, UserPayload } from '../types';

export async function handleStockRoutes(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  authUser?: UserPayload | null
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const tenant_id = authUser?.tenant_id || request.headers.get('x-tenant-id') || 'berkah';

  if (path === '/api/stock/adjust' && request.method === 'POST') {
    const body = (await request.json()) as {
      product_id: string;
      actual_stock: number;
      notes?: string;
    };

    if (!body.product_id || body.actual_stock === undefined) {
      return new Response(JSON.stringify({ error: 'Product ID dan actual stock wajib diisi' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const product = await env.DB.prepare(
      'SELECT stock FROM products WHERE id = ? AND tenant_id = ?'
    )
      .bind(body.product_id, tenant_id)
      .first<{ stock: number }>();

    if (!product) {
      return new Response(JSON.stringify({ error: 'Produk tidak ditemukan' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const currentStock = product.stock;
    const diff = body.actual_stock - currentStock;
    const movementId = 'MOV-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

    const statements: any[] = [
      env.DB.prepare(
        'UPDATE products SET stock = ?, updated_at = datetime(\'now\') WHERE id = ? AND tenant_id = ?'
      ).bind(body.actual_stock, body.product_id, tenant_id),
      env.DB.prepare(`
        INSERT INTO stock_movements (
          id, tenant_id, product_id, type, quantity,
          stock_before, stock_after, reference_id, notes, created_at
        ) VALUES (?, ?, ?, 'adjustment', ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        movementId,
        tenant_id,
        body.product_id,
        diff,
        currentStock,
        body.actual_stock,
        'ADJ-' + Date.now(),
        body.notes || 'Penyesuaian Stok Fisik'
      ),
    ];

    await env.DB.batch(statements);

    return new Response(
      JSON.stringify({
        success: true,
        product_id: body.product_id,
        stock_before: currentStock,
        stock_after: body.actual_stock,
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
