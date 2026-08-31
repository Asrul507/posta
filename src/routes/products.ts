import { Env, UserPayload } from '../types';

export async function handleProductsRoutes(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  authUser?: UserPayload | null
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const tenant_id = authUser?.tenant_id || request.headers.get('x-tenant-id') || 'berkah';

  if (path === '/api/products' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, tenant_id, barcode, name, category, cost_price, selling_price, stock, unit, is_active FROM products WHERE tenant_id = ? AND is_active = 1'
    )
      .bind(tenant_id)
      .all();

    return new Response(JSON.stringify(results || []), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// Alias export untuk mencegah kegagalan import nama tunggal/jamak
export { handleProductsRoutes as handleProductRoutes };
