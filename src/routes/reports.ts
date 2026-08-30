import { Env } from "../types";

export async function handleGetTransactions(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenant_id");
    if (!tenantId) return Response.json({ success: false, error: "tenant_id required" }, { status: 400 });

    const query = `
      SELECT t.*, 
        (SELECT COUNT(*) FROM transaction_items ti WHERE ti.transaction_id = t.id) as total_items
      FROM transactions t
      WHERE t.tenant_id = ?
      ORDER BY t.created_at DESC
      LIMIT 100
    `;
    const { results } = await env.DB.prepare(query).bind(tenantId).all();
    return Response.json({ success: true, data: results });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function handleGetPOHistory(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenant_id");
    if (!tenantId) return Response.json({ success: false, error: "tenant_id required" }, { status: 400 });

    const query = `
      SELECT po.*, 
        (SELECT SUM(qty) FROM purchase_order_items poi WHERE poi.po_id = po.id) as total_qty
      FROM purchase_orders po
      WHERE po.tenant_id = ?
      ORDER BY po.created_at DESC
      LIMIT 100
    `;
    const { results } = await env.DB.prepare(query).bind(tenantId).all();
    return Response.json({ success: true, data: results });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 3. GET /api/reports/daily -> Laporan Harian Lengkap (Z-Report & Laba Kotor)
export async function handleGetDailyReport(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenant_id");
    const dateParam = url.searchParams.get("date") || new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    if (!tenantId) return Response.json({ success: false, error: "tenant_id required" }, { status: 400 });

    // Total Penjualan & Perkiraan HPP Hari Ini
    const salesSummary: any = await env.DB.prepare(`
      SELECT 
        COALESCE(SUM(t.total_amount), 0) as total_sales,
        COUNT(DISTINCT t.id) as total_transactions,
        COALESCE(SUM(ti.qty * ti.cost_price), 0) as total_cogs
      FROM transactions t
      LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
      WHERE t.tenant_id = ? AND DATE(t.created_at) = DATE(?)
    `).bind(tenantId, dateParam).first();

    // Top 5 Produk Terlaris Hari Ini
    const topProducts: any = await env.DB.prepare(`
      SELECT 
        ti.product_name,
        SUM(ti.qty) as total_qty,
        SUM(ti.subtotal) as total_revenue
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      WHERE t.tenant_id = ? AND DATE(t.created_at) = DATE(?)
      GROUP BY ti.product_name
      ORDER BY total_qty DESC
      LIMIT 5
    `).bind(tenantId, dateParam).all();

    // Rekap Seluruh Shift Kasir Hari Ini
    const shiftsSummary: any = await env.DB.prepare(`
      SELECT * FROM shifts
      WHERE tenant_id = ? AND DATE(start_time) = DATE(?)
      ORDER BY start_time DESC
    `).bind(tenantId, dateParam).all();

    const totalSales = salesSummary?.total_sales || 0;
    const totalCogs = salesSummary?.total_cogs || 0;
    const grossProfit = totalSales - totalCogs;

    return Response.json({
      success: true,
      date: dateParam,
      summary: {
        total_sales: totalSales,
        total_transactions: salesSummary?.total_transactions || 0,
        total_cogs: totalCogs,
        gross_profit: grossProfit,
        profit_margin_pct: totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) : 0
      },
      top_products: topProducts.results || [],
      shifts: shiftsSummary.results || []
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 4. GET /api/reports/monthly -> Laporan Bulanan (Tren Harian & Performa)
export async function handleGetMonthlyReport(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenant_id");
    const monthParam = url.searchParams.get("month") || new Date().toISOString().slice(0, 7); // YYYY-MM

    if (!tenantId) return Response.json({ success: false, error: "tenant_id required" }, { status: 400 });

    // Ringkasan Total Bulanan
    const monthSummary: any = await env.DB.prepare(`
      SELECT 
        COALESCE(SUM(t.total_amount), 0) as total_sales,
        COUNT(DISTINCT t.id) as total_transactions,
        COALESCE(SUM(ti.qty * ti.cost_price), 0) as total_cogs
      FROM transactions t
      LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
      WHERE t.tenant_id = ? AND strftime('%Y-%m', t.created_at) = ?
    `).bind(tenantId, monthParam).first();

    // Rincian Tren Per Hari dalam Bulan Tersebut
    const dailyTrends: any = await env.DB.prepare(`
      SELECT 
        DATE(t.created_at) as sale_date,
        SUM(t.total_amount) as daily_sales,
        COUNT(DISTINCT t.id) as daily_tx,
        COALESCE(SUM(ti.qty * ti.cost_price), 0) as daily_cogs
      FROM transactions t
      LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
      WHERE t.tenant_id = ? AND strftime('%Y-%m', t.created_at) = ?
      GROUP BY DATE(t.created_at)
      ORDER BY DATE(t.created_at) ASC
    `).bind(tenantId, monthParam).all();

    // Performa Tiap Kasir
    const cashierPerf: any = await env.DB.prepare(`
      SELECT 
        cashier_name,
        COUNT(id) as total_tx,
        SUM(total_amount) as total_sales
      FROM transactions
      WHERE tenant_id = ? AND strftime('%Y-%m', created_at) = ?
      GROUP BY cashier_name
      ORDER BY total_sales DESC
    `).bind(tenantId, monthParam).all();

    const totalSales = monthSummary?.total_sales || 0;
    const totalCogs = monthSummary?.total_cogs || 0;
    const grossProfit = totalSales - totalCogs;

    return Response.json({
      success: true,
      month: monthParam,
      summary: {
        total_sales: totalSales,
        total_transactions: monthSummary?.total_transactions || 0,
        total_cogs: totalCogs,
        gross_profit: grossProfit,
        profit_margin_pct: totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) : 0
      },
      daily_trends: dailyTrends.results || [],
      cashier_performance: cashierPerf.results || []
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
