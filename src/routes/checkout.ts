import { Hono } from 'hono';
import { recordStockMovement } from '../services/inventory';


export async function handleCheckout(request: Request, env: Env): Promise<Response> {
  try {
    const payload: {
      tenant_id?: string;
      items: Array<{
        id: string;
        name: string;
        cost_price?: number;
        price: number;
        qty: number;
      }>;
      payment_method?: string;
      paid_amount: number;
      cashier_name?: string;
    } = await request.json();

export const checkoutRoute = new Hono<{ Bindings: Bindings }>();

function extractTenantFromHost(hostname: string): string {
  const host = hostname.toLowerCase().split(':')[0];
  if (host === "posta.gpro.my.id" || host === "localhost" || host === "127.0.0.1") return "posta";
  if (host.endsWith(".gpro.my.id")) {
    const sub = host.replace(".gpro.my.id", "");
    if (sub && sub !== "www") return sub;
  }
  return "posta";
}

checkoutRoute.post('/', async (c) => {
  try {
    const sub = extractTenantFromHost(new URL(c.req.url).hostname);
    let tenantId: string | null = null;
    if (sub !== "posta") {
      const tenant = await c.env.DB.prepare("SELECT id FROM tenants WHERE subdomain = ?").bind(sub).first<{ id: string }>();
      if (tenant) tenantId = tenant.id;
    }

    const body = await c.req.json();
    const items = body.items || body.cart || [];
    const totalAmount = Number(body.totalAmount || body.total || body.amount || 0);
    const paymentMethod = body.paymentMethod || body.payment_method || 'CASH';
    const shiftId = body.shiftId || null;
    const customerName = body.customerName || 'Pelanggan Umum';

    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ success: false, error: 'Keranjang belanja kosong' }, 400);
    }

    const trxId = "trx_" + Date.now();

    // 1. Simpan Transaksi
    await c.env.DB.prepare(`
      INSERT INTO transactions (id, tenant_id, total_amount, payment_method, shift_id, customer_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(trxId, tenantId, totalAmount, paymentMethod, shiftId, customerName).run();

    // 2. Simpan Item & Kurangi Stok
    for (const item of items) {
      const productId = item.productId || item.id;
      const qty = Number(item.quantity || item.qty || 1);
      const price = Number(item.price || 0);

      await c.env.DB.prepare(`
        INSERT INTO transaction_items (transaction_id, product_id, quantity, price, subtotal)
        VALUES (?, ?, ?, ?, ?)
      `).bind(trxId, productId, qty, price, (qty * price)).run();

      // Mutasi stok
      try {
        await recordStockMovement(c.env.DB, {
          productId,
          qtyChange: -qty,
          type: 'SALE',
          referenceId: trxId,
          notes: `Penjualan POS #${trxId}`
        });
      } catch (stkErr) {
        console.warn('Gagal potong stok produk:', productId, stkErr);
      }
    }

    return c.json({
      success: true,
      message: 'Transaksi berhasil!',
      transactionId: trxId
    });
  } catch (err: any) {
    console.error('Checkout error:', err);
    return c.json({ success: false, error: err.message || 'Gagal memproses pembayaran' }, 500);
  }
});

export default checkoutRoute;
