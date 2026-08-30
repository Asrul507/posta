import { Hono } from 'hono';
import { recordStockMovement } from '../services/inventory';

type Bindings = {
  DB: D1Database;
};

export const checkoutRoute = new Hono<{ Bindings: Bindings }>();

checkoutRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { items, totalAmount, paymentMethod, shiftId, notes, customerName } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return c.json({ success: false, error: 'Item belanja tidak boleh kosong' }, 400);
    }

    // 1. Simpan Header Transaksi
    const orderInsert = await c.env.DB
      .prepare(`
        INSERT INTO transactions (total_amount, payment_method, shift_id, customer_name, notes, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
        RETURNING id
      `)
      .bind(
        totalAmount,
        paymentMethod || 'CASH',
        shiftId || null,
        customerName || 'Pelanggan Umum',
        notes || null
      )
      .first<{ id: number | string }>();

    const transactionId = orderInsert?.id;

    // 2. Simpan Item Detail & Potong Stok Otomatis
    for (const item of items) {
      const productId = item.productId || item.id;
      const qty = Number(item.quantity || item.qty || 1);
      const price = Number(item.price || 0);
      const subtotal = Number(item.subtotal || (price * qty));

      // Simpan rincian item transaksi
      await c.env.DB
        .prepare(`
          INSERT INTO transaction_items (transaction_id, product_id, quantity, price, subtotal)
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(transactionId, productId, qty, price, subtotal)
        .run();

      // Mutasi stok keluar (SALE)
      await recordStockMovement(c.env.DB, {
        productId: productId,
        qtyChange: -Math.abs(qty),
        type: 'SALE',
        referenceId: transactionId,
        notes: `Penjualan Kasir #${transactionId}`
      });
    }

    return c.json({
      success: true,
      message: 'Transaksi berhasil disimpan',
      transactionId
    });
  } catch (err: any) {
    console.error('Checkout error:', err);
    return c.json({ success: false, error: err.message || 'Gagal memproses transaksi' }, 500);
  }
});

export default checkoutRoute;
