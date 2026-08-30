import { Env } from "../types";

export async function handleGetProducts(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
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

    return Response.json({ success: true, data: results });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
