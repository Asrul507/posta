import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

export const productsRoute = new Hono<{ Bindings: Bindings }>();

function extractTenantFromHost(hostname: string): string {
  const host = hostname.toLowerCase().split(':')[0];
  if (host === "posta.gpro.my.id" || host === "localhost" || host === "127.0.0.1") return "posta";
  if (host.endsWith(".gpro.my.id")) {
    const sub = host.replace(".gpro.my.id", "");
    if (sub && sub !== "www") return sub;
  }
  return "posta";
}

// 1. Ambil Produk Khusus Toko yang Sedang Aktif
productsRoute.get('/', async (c) => {
  try {
    const sub = extractTenantFromHost(new URL(c.req.url).hostname);
    let results: any[] = [];

    if (sub === "posta") {
      // Jika di pusat / developer dashboard, ambil semua produk
      const query = "SELECT * FROM products ORDER BY name ASC";
      const res = await c.env.DB.prepare(query).all();
      results = res.results;
    } else {
      // Ambil ID tenant toko tersebut
      const tenant = await c.env.DB.prepare("SELECT id FROM tenants WHERE subdomain = ? AND is_active = 1")
        .bind(sub)
        .first<{ id: string }>();

      if (tenant) {
        const query = "SELECT * FROM products WHERE tenant_id = ? ORDER BY name ASC";
        const res = await c.env.DB.prepare(query).bind(tenant.id).all();
        results = res.results;
      }
    }

    return c.json({ success: true, data: results });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 2. Tambah Produk ke Toko yang Aktif
productsRoute.post('/', async (c) => {
  try {
    const sub = extractTenantFromHost(new URL(c.req.url).hostname);
    let tenantId: string | null = null;

    if (sub !== "posta") {
      const tenant = await c.env.DB.prepare("SELECT id FROM tenants WHERE subdomain = ? AND is_active = 1")
        .bind(sub)
        .first<{ id: string }>();
      if (tenant) tenantId = tenant.id;
    }

    const body = await c.req.json();
    const { name, sku, barcode, price, costPrice, stock, category } = body;

    const id = "prod_" + Date.now();
    await c.env.DB.prepare(`
      INSERT INTO products (id, tenant_id, name, sku, barcode, price, cost_price, stock, category, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      id,
      tenantId,
      name,
      sku || null,
      barcode || null,
      Number(price) || 0,
      Number(costPrice) || 0,
      Number(stock) || 0,
      category || 'Umum'
    ).run();

    return c.json({ success: true, message: 'Produk berhasil ditambahkan', productId: id });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default productsRoute;
