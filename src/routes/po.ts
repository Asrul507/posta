import { Hono } from 'hono';
import { recordStockMovement } from '../services/inventory';

type Bindings = {
  DB: D1Database;
};

export const poRoute = new Hono<{ Bindings: Bindings }>();

// 1. Ambil Semua Daftar Purchase Order
poRoute.get('/', async (c) => {
  try {
    const list = await c.env.DB
      .prepare(`
        SELECT po.*, s.name as supplier_name 
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        ORDER BY po.created_at DESC
      `)
      .all();

    return c.json({ success: true, data: list.results });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 2. Buat Draft PO Baru
poRoute.post('/submit', async (c) => {
  try {
    const body = await c.req.json();
    const { supplierId, items, totalAmount, notes } = body;

    const poInsert = await c.env.DB
      .prepare(`
        INSERT INTO purchase_orders (supplier_id, total_amount, status, notes, created_at)
        VALUES (?, ?, 'PENDING', ?, datetime('now'))
        RETURNING id
      `)
      .bind(supplierId || null, totalAmount || 0, notes || null)
      .first<{ id: number | string }>();

    const poId = poInsert?.id;

    if (items && Array.isArray(items)) {
      for (const item of items) {
        await c.env.DB
          .prepare(`
            INSERT INTO purchase_order_items (po_id, product_id, quantity, cost_price, subtotal)
            VALUES (?, ?, ?, ?, ?)
          `)
          .bind(poId, item.productId, item.quantity, item.costPrice || 0, item.subtotal || 0)
          .run();
      }
    }

    return c.json({ success: true, message: 'PO berhasil dibuat', poId });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 3. Terima Barang dari PO & Tambah Stok Otomatis
poRoute.post('/:id/receive', async (c) => {
  try {
    const poId = c.req.param('id');
    const body = await c.req.json();
    const { items } = body; // Format: [{ productId, quantityReceived }]

    // Update status PO
    await c.env.DB
      .prepare(`UPDATE purchase_orders SET status = 'RECEIVED', received_at = datetime('now') WHERE id = ?`)
      .bind(poId)
      .run();

    // Tambahkan stok untuk tiap barang yang diterima
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const qty = Number(item.quantityReceived || item.quantity || 0);
        if (qty > 0) {
          await recordStockMovement(c.env.DB, {
            productId: item.productId,
            qtyChange: qty,
            type: 'PO_RECEIVE',
            referenceId: poId,
            notes: `Penerimaan Barang PO #${poId}`
          });
        }
      }
    }

    return c.json({ success: true, message: `Stok berhasil ditambahkan dari PO #${poId}` });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default poRoute;
