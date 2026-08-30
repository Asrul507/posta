import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

export const reportsRoute = new Hono<{ Bindings: Bindings }>();

// 1. Riwayat Transaksi POS
reportsRoute.get('/transactions', async (c) => {
  try {
    const transactions = await c.env.DB
      .prepare(`
        SELECT * FROM transactions 
        ORDER BY created_at DESC 
        LIMIT 100
      `)
      .all();
    return c.json({ success: true, data: transactions.results });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 2. Riwayat PO
reportsRoute.get('/po', async (c) => {
  try {
    const pos = await c.env.DB
      .prepare(`
        SELECT po.*, s.name as supplier_name 
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        ORDER BY po.created_at DESC
        LIMIT 100
      `)
      .all();
    return c.json({ success: true, data: pos.results });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 3. Ringkasan Laporan Harian
reportsRoute.get('/daily', async (c) => {
  try {
    const summary = await c.env.DB
      .prepare(`
        SELECT 
          date(created_at) as report_date,
          COUNT(id) as total_orders,
          SUM(total_amount) as total_revenue
        FROM transactions
        WHERE date(created_at) = date('now')
        GROUP BY date(created_at)
      `)
      .first();

    return c.json({ success: true, data: summary || { total_orders: 0, total_revenue: 0 } });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 4. Ringkasan Laporan Bulanan
reportsRoute.get('/monthly', async (c) => {
  try {
    const summary = await c.env.DB
      .prepare(`
        SELECT 
          strftime('%Y-%m', created_at) as report_month,
          COUNT(id) as total_orders,
          SUM(total_amount) as total_revenue
        FROM transactions
        WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
        GROUP BY strftime('%Y-%m', created_at)
      `)
      .first();

    return c.json({ success: true, data: summary || { total_orders: 0, total_revenue: 0 } });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default reportsRoute;
