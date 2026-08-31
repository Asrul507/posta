import { Env, UserPayload } from '../types';

export async function handleReportsRoutes(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  authUser?: UserPayload | null
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const tenant_id = authUser?.tenant_id || request.headers.get('x-tenant-id') || 'berkah';

  if (path === '/api/reports/summary' && request.method === 'GET') {
    const todaySummary = await env.DB.prepare(`
      SELECT 
        COUNT(id) as total_transactions,
        COALESCE(SUM(final_amount), 0) as total_sales,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(SUM(final_amount - total_cost), 0) as gross_profit
      FROM transactions
      WHERE tenant_id = ? AND date(created_at) = date('now')
    `)
      .bind(tenant_id)
      .first();

    const lowStock = await env.DB.prepare(`
      SELECT COUNT(id) as low_stock_count
      FROM products
      WHERE tenant_id = ? AND stock <= 5 AND is_active = 1
    `)
      .bind(tenant_id)
      .first();

    return new Response(
      JSON.stringify({
        summary: todaySummary || {},
        low_stock_count: lowStock ? (lowStock as any).low_stock_count : 0,
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
