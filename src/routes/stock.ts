import { Hono } from 'hono';
import { recordStockMovement } from '../services/inventory';

type Bindings = {
  DB: D1Database;
};

export const stockRoute = new Hono<{ Bindings: Bindings }>();

// Penyesuaian Stok Manual / Stock Opname
stockRoute.post('/adjust', async (c) => {
  try {
    const body = await c.req.json();
    const { productId, diffQty, reason } = body;

    if (productId === undefined || diffQty === undefined) {
      return c.json({ error: 'productId dan diffQty wajib diisi' }, 400);
    }

    const result = await recordStockMovement(c.env.DB, {
      productId,
      qtyChange: Number(diffQty),
      type: 'ADJUSTMENT',
      notes: reason || 'Koreksi stok manual'
    });

    return c.json({
      success: true,
      message: 'Penyesuaian stok berhasil disimpan',
      data: result
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Gagal menyesuaikan stok' }, 500);
  }
});

// Ambil riwayat log per produk
stockRoute.get('/history/:productId', async (c) => {
  try {
    const productId = c.req.param('productId');

    const logs = await c.env.DB
      .prepare(`
        SELECT id, product_id, qty_change, previous_stock, current_stock, type, reference_id, notes, created_at
        FROM stock_logs
        WHERE product_id = ?
        ORDER BY created_at DESC
        LIMIT 100
      `)
      .bind(productId)
      .all();

    return c.json({
      success: true,
      data: logs.results
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Gagal mengambil log stok' }, 500);
  }
});

// Ambil semua log mutasi terbaru
stockRoute.get('/logs', async (c) => {
  try {
    const logs = await c.env.DB
      .prepare(`
        SELECT sl.*, p.name as product_name, p.sku
        FROM stock_logs sl
        LEFT JOIN products p ON sl.product_id = p.id
        ORDER BY sl.created_at DESC
        LIMIT 50
      `)
      .all();

    return c.json({
      success: true,
      data: logs.results
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Gagal mengambil log stok' }, 500);
  }
});
