// src/services/inventory.ts
export type MovementType = 'SALE' | 'PO_RECEIVE' | 'ADJUSTMENT' | 'RETURN' | 'CANCEL_ORDER';

export interface StockMovementParams {
  productId: string | number;
  qtyChange: number; // Negatif jika keluar (contoh: -2), Positif jika masuk (+5)
  type: MovementType;
  referenceId?: string | number | null;
  notes?: string | null;
}

/**
 * Memperbarui stok produk dan mencatat log pergerakan stok dalam D1 Database
 */
export async function recordStockMovement(
  db: D1Database,
  params: StockMovementParams
): Promise<{ success: boolean; newStock: number }> {
  const { productId, qtyChange, type, referenceId = null, notes = null } = params;

  // 1. Ambil data produk dan pastikan produk ada
  const product = await db
    .prepare('SELECT id, stock, name FROM products WHERE id = ?')
    .bind(productId)
    .first<{ id: number | string; stock: number; name: string }>();

  if (!product) {
    throw new Error(`Produk dengan ID ${productId} tidak ditemukan.`);
  }

  const currentStock = Number(product.stock) || 0;
  const newStock = currentStock + Number(qtyChange);

  // 2. Cegah stok menjadi minus saat penjualan (opsional, sesuaikan dengan aturan bisnis)
  if (newStock < 0 && type === 'SALE') {
    throw new Error(`Stok untuk produk "${product.name}" tidak mencukupi (sisa: ${currentStock}, diminta: ${Math.abs(qtyChange)}).`);
  }

  // 3. Update stok di tabel products
  await db
    .prepare('UPDATE products SET stock = ? WHERE id = ?')
    .bind(newStock, productId)
    .run();

  // 4. Catat riwayat audit di tabel stock_logs
  // Pastikan tabel stock_logs sudah ada di skema database D1
  await db
    .prepare(`
      INSERT INTO stock_logs (product_id, qty_change, previous_stock, current_stock, type, reference_id, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `)
    .bind(
      productId,
      qtyChange,
      currentStock,
      newStock,
      type,
      referenceId ? String(referenceId) : null,
      notes
    )
    .run();

  return { success: true, newStock };
}
