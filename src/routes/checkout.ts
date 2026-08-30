// src/routes/checkout.ts
import { Hono } from 'hono';
import { recordStockMovement } from '../services/inventory';

type Bindings = {
  DB: D1Database;
};

export const checkoutRoute = new Hono<{ Bindings: Bindings }>();

checkoutRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { items, totalAmount, paymentMethod, shiftId, notes } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return c.json({ error: 'Item belanja tidak boleh kosong' }, 400);
    }

    // 1. Simpan header transaksi order
    const orderInsert = await c.env.DB
      .prepare(`
        INSERT INTO orders (total_amount, payment_method, shift_id, notes, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        RETURNING id
      `)
      .bind(totalAmount, paymentMethod, shiftId || null, notes || null)
      .first<{ id: number }>();

    const orderId = orderInsert?.id;

    // 2. Simpan order items dan potong stok secara terpusat
    for (const item of items) {
      // Simpan item pesanan
      await c.env.DB
        .prepare(`
          INSERT INTO order_items (order_id, product_id, quantity, price, subtotal)
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(orderId, item.productId, item.quantity, item.price, item.subtotal || (item.price * item.quantity))
        .run();

      // Mutasi stok keluar (SALE)
      await recordStockMovement(c.env.DB, {
        productId: item.productId,
        qtyChange: -Math.abs(item.quantity), // Pengurangan stok
        type: 'SALE',
        referenceId: orderId,
        notes: `Penjualan Kasir Order #${orderId}`
      });
    }

    return c.json({
      success: true,
      message: 'Transaksi checkout berhasil',
      orderId
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Gagal memproses checkout' }, 500);
  }
});
