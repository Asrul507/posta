export async function onRequestGet(context) {
  const { env, request } = context;
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

    return new Response(JSON.stringify({ success: true, data: results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
