import { Env, UserPayload } from '../types';

function json(body: unknown, status = 200, corsHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

const PRODUCT_SELECT = `
  SELECT id, tenant_id, barcode, name, category, category AS category_name,
         cost_price, selling_price, stock, unit, is_active
  FROM products
`;

// Kumpulan nilai tenant_id yang dianggap valid untuk toko ini: UUID resmi
// tenants.id DAN (jika ada) teks subdomainnya. Ini menjaga kompatibilitas
// dengan data lama yang mungkin memakai subdomain sebagai tenant_id, bukan
// UUID, sehingga data tidak "hilang" hanya karena beda representasi.
function tenantIdVariants(authUser?: UserPayload | null, fallback = 'berkah'): string[] {
  const variants = new Set<string>();
  if (authUser?.tenant_id) variants.add(authUser.tenant_id);
  if (authUser?.tenant_subdomain) variants.add(authUser.tenant_subdomain);
  if (variants.size === 0) variants.add(fallback);
  return Array.from(variants);
}

export async function handleProductsRoutes(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  authUser?: UserPayload | null
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  const tenantIdCanonical = authUser?.tenant_id || request.headers.get('x-tenant-id') || 'berkah';
  const variants = tenantIdVariants(authUser, request.headers.get('x-tenant-id') || 'berkah');
  const variantPlaceholders = variants.map(() => '?').join(', ');

  // Cek ketersediaan barcode (dipakai form "Input Barang Masuk" untuk auto-popup tambah produk baru)
  if (path === '/api/products/check' && request.method === 'GET') {
    const barcode = url.searchParams.get('barcode')?.trim();
    if (!barcode) {
      return json({ success: false, error: 'Barcode wajib diisi.' }, 400, corsHeaders);
    }
    const product = await env.DB.prepare(
      `${PRODUCT_SELECT} WHERE tenant_id IN (${variantPlaceholders}) AND barcode = ? AND is_active = 1`
    )
      .bind(...variants, barcode)
      .first();

    return json({ success: true, found: !!product, data: product || null }, 200, corsHeaders);
  }

  // Daftar produk aktif toko ini
  if (path === '/api/products' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `${PRODUCT_SELECT} WHERE tenant_id IN (${variantPlaceholders}) AND is_active = 1 ORDER BY name`
    )
      .bind(...variants)
      .all();

    return new Response(JSON.stringify(results || []), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // Tambah produk baru (semua role toko boleh, termasuk saat quick-add barcode di form barang masuk)
  if (path === '/api/products' && request.method === 'POST') {
    const body = (await request.json()) as {
      barcode?: string;
      name?: string;
      category?: string;
      cost_price?: number;
      selling_price?: number;
      stock?: number;
      unit?: string;
    };

    const name = body.name?.trim();
    if (!name) {
      return json({ success: false, error: 'Nama produk wajib diisi.' }, 400, corsHeaders);
    }

    const barcode = body.barcode?.trim() || null;
    const category = body.category?.trim() || null;
    const costPrice = Number(body.cost_price) || 0;
    const sellingPrice = Number(body.selling_price) || 0;
    const stock = Number(body.stock) || 0;
    const unit = body.unit?.trim() || 'pcs';

    if (barcode) {
      const dup = await env.DB.prepare(`SELECT id FROM products WHERE tenant_id IN (${variantPlaceholders}) AND barcode = ?`)
        .bind(...variants, barcode)
        .first();
      if (dup) {
        return json({ success: false, error: 'Barcode ini sudah dipakai produk lain.' }, 409, corsHeaders);
      }
    }

    // Produk baru selalu ditulis dengan tenant_id kanonik (UUID resmi tenants.id)
    // supaya data ke depannya konsisten dan tidak menambah masalah baru.
    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO products (id, tenant_id, barcode, name, category, cost_price, selling_price, stock, unit, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `)
      .bind(id, tenantIdCanonical, barcode, name, category, costPrice, sellingPrice, stock, unit)
      .run();

    const product = await env.DB.prepare(`${PRODUCT_SELECT} WHERE id = ?`).bind(id).first();

    return json({ success: true, message: 'Produk berhasil ditambahkan.', data: product }, 201, corsHeaders);
  }

  const editMatch = path.match(/^\/api\/products\/([^/]+)$/);

  // Ubah data produk (khusus Owner/Admin, divalidasi di index.ts)
  if (editMatch && request.method === 'PUT') {
    const productId = editMatch[1];
    const existing = await env.DB.prepare(`SELECT id, tenant_id FROM products WHERE id = ? AND tenant_id IN (${variantPlaceholders})`)
      .bind(productId, ...variants)
      .first<{ id: string; tenant_id: string }>();
    if (!existing) {
      return json({ success: false, error: 'Produk tidak ditemukan.' }, 404, corsHeaders);
    }

    const body = (await request.json()) as {
      barcode?: string | null;
      name?: string;
      category?: string | null;
      cost_price?: number;
      selling_price?: number;
      stock?: number;
      unit?: string;
      is_active?: number | boolean;
    };

    if (body.barcode) {
      const dup = await env.DB.prepare(
        `SELECT id FROM products WHERE tenant_id IN (${variantPlaceholders}) AND barcode = ? AND id != ?`
      )
        .bind(...variants, body.barcode.trim(), productId)
        .first();
      if (dup) {
        return json({ success: false, error: 'Barcode ini sudah dipakai produk lain.' }, 409, corsHeaders);
      }
    }

    const updates: string[] = [];
    const binds: unknown[] = [];

    if (body.name?.trim()) {
      updates.push('name = ?');
      binds.push(body.name.trim());
    }
    if (body.barcode !== undefined) {
      updates.push('barcode = ?');
      binds.push(body.barcode ? body.barcode.trim() : null);
    }
    if (body.category !== undefined) {
      updates.push('category = ?');
      binds.push(body.category ? body.category.trim() : null);
    }
    if (body.cost_price !== undefined) {
      updates.push('cost_price = ?');
      binds.push(Number(body.cost_price) || 0);
    }
    if (body.selling_price !== undefined) {
      updates.push('selling_price = ?');
      binds.push(Number(body.selling_price) || 0);
    }
    if (body.stock !== undefined) {
      updates.push('stock = ?');
      binds.push(Number(body.stock) || 0);
    }
    if (body.unit?.trim()) {
      updates.push('unit = ?');
      binds.push(body.unit.trim());
    }
    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      binds.push(body.is_active ? 1 : 0);
    }

    // Rapikan otomatis: kalau produk ini masih memakai tenant_id versi lama
    // (mis. teks subdomain), samakan ke UUID resmi begitu produk diedit.
    if (existing.tenant_id !== tenantIdCanonical) {
      updates.push('tenant_id = ?');
      binds.push(tenantIdCanonical);
    }

    if (updates.length === 0) {
      return json({ success: false, error: 'Tidak ada perubahan data yang dikirim.' }, 400, corsHeaders);
    }

    updates.push("updated_at = datetime('now')");
    binds.push(productId);

    await env.DB.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...binds)
      .run();

    return json({ success: true, message: 'Produk berhasil diperbarui.' }, 200, corsHeaders);
  }

  // Hapus produk (soft-delete, khusus Owner/Admin)
  if (editMatch && request.method === 'DELETE') {
    const productId = editMatch[1];
    const existing = await env.DB.prepare(`SELECT id FROM products WHERE id = ? AND tenant_id IN (${variantPlaceholders})`)
      .bind(productId, ...variants)
      .first();
    if (!existing) {
      return json({ success: false, error: 'Produk tidak ditemukan.' }, 404, corsHeaders);
    }

    await env.DB.prepare("UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?")
      .bind(productId)
      .run();

    return json({ success: true, message: 'Produk berhasil dihapus.' }, 200, corsHeaders);
  }

  return json({ error: 'Method not allowed' }, 405, corsHeaders);
}

// Alias export untuk mencegah kegagalan import nama tunggal/jamak
export { handleProductsRoutes as handleProductRoutes };
