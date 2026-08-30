import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

export const productsRoute = new Hono<{ Bindings: Bindings }>();

// 1. Ambil Semua Produk
productsRoute.get('/', async (c) => {
  try {
    const list = await c.env.DB
      .prepare(`SELECT * FROM products ORDER BY name ASC`)
      .all();
    return c.json({ success: true, data: list.results });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 2. Tambah / Simpan Produk Baru
productsRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { name, sku, barcode, price, costPrice, stock, category } = body;

    if (!name || price === undefined) {
      return c.json({ success: false, error: 'Nama dan harga produk wajib diisi' }, 400);
    }

    const res = await c.env.DB
      .prepare(`
        INSERT INTO products (name, sku, barcode, price, cost_price, stock, category, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        RETURNING id
      `)
      .bind(
        name,
        sku || null,
        barcode || null,
        Number(price) || 0,
        Number(costPrice) || 0,
        Number(stock) || 0,
        category || 'Umum'
      )
      .first<{ id: number | string }>();

    return c.json({ success: true, message: 'Produk berhasil ditambahkan', productId: res?.id });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 3. Update Data Produk
productsRoute.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { name, sku, barcode, price, costPrice, category } = body;

    await c.env.DB
      .prepare(`
        UPDATE products 
        SET name = ?, sku = ?, barcode = ?, price = ?, cost_price = ?, category = ?
        WHERE id = ?
      `)
      .bind(
        name,
        sku || null,
        barcode || null,
        Number(price) || 0,
        Number(costPrice) || 0,
        category || 'Umum',
        id
      )
      .run();

    return c.json({ success: true, message: 'Produk berhasil diperbarui' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 4. Hapus Produk
productsRoute.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare(`DELETE FROM products WHERE id = ?`).bind(id).run();
    return c.json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default productsRoute;
