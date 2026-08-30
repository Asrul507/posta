// src/routes/po.ts
import { Hono } from 'hono';
import { recordStockMovement } from '../services/inventory';

type Bindings = {
  DB: D1Database;
};

export const poRoute = new Hono<{ Bindings: Bindings }>();

// Endpoint untuk menerima barang dari PO (Receiving)
poRoute.post('/:id/receive', async (c) => {
  try {
    const poId = c.req.param('id');
    const body = await c.req.json();
    const { items } = body; // Array [{ productId, quantityReceived }]

    // 1. Update status PO ke RECEIVED
    await c.env.DB
      .prepare(`UPDATE purchase_orders SET status = 'RECEIVED', received_at = datetime('now') WHERE id = ?`)
      .bind(poId)
      .run();

    // 2. Tambah stok untuk setiap produk yang diterima
    for (const item of items) {
      await recordStockMovement(c.env.DB, {
        productId: item.productId,
        qtyChange: Math.abs(item.quantityReceived), // Penambahan stok
        type: 'PO_RECEIVE',
        referenceId: poId,
        notes: `Barang Masuk PO #${poId}`
      });
    }

    return c.json({
      success: true,
      message: `Stok berhasil ditambahkan dari PO #${poId}`
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Gagal memproses penerimaan PO' }, 500);
  }
});
