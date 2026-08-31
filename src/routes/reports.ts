import { Env, UserPayload } from '../types';

function json(body: unknown, status = 200, corsHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export async function handleReportsRoutes(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  authUser?: UserPayload | null
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const tenant_id = authUser?.tenant_id || request.headers.get('x-tenant-id') || 'berkah';

  if (path === '/api/reports/summary' && request.method === 'GET') {
    const todaySummary = await env.DB.prepare(`
      SELECT 
        COUNT(id) as total_transactions,
        COALESCE(SUM(final_amount), 0) as total_sales,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(SUM(final_amount - total_cost), 0) as gross_profit
      FROM transactions
      WHERE tenant_id = ? AND date(created_at) = date('now')
    `)
      .bind(tenant_id)
      .first();

    const lowStock = await env.DB.prepare(`
      SELECT COUNT(id) as low_stock_count
      FROM products
      WHERE tenant_id = ? AND stock <= 5 AND is_active = 1
    `)
      .bind(tenant_id)
      .first();

    return json(
      {
        summary: todaySummary || {},
        low_stock_count: lowStock ? (lowStock as any).low_stock_count : 0,
      },
      200,
      corsHeaders
    );
  }

  // Riwayat transaksi kasir (dipakai halaman "Riwayat Transaksi Kasir")
  if (path === '/api/reports/transactions' && request.method === 'GET') {
    const { results } = await env.DB.prepare(`
      SELECT created_at, invoice_number, payment_method,
             final_amount AS total_amount, cash_amount AS paid_amount, change_amount
      FROM transactions
      WHERE tenant_id = ?
      ORDER BY created_at DESC
      LIMIT 300
    `)
      .bind(tenant_id)
      .all();

    return json({ success: true, data: results || [] }, 200, corsHeaders);
  }

  // Riwayat barang masuk / purchase order (dipakai halaman "Riwayat Barang Masuk")
  if (path === '/api/reports/po' && request.method === 'GET') {
    const { results } = await env.DB.prepare(`
      SELECT po.created_at, po.po_number, po.notes,
             COALESCE(po.supplier_id, 'Umum') AS supplier_name,
             (SELECT COALESCE(SUM(quantity), 0) FROM purchase_order_items WHERE po_id = po.id) AS total_qty
      FROM purchase_orders po
      WHERE po.tenant_id = ?
      ORDER BY po.created_at DESC
      LIMIT 300
    `)
      .bind(tenant_id)
      .all();

    return json({ success: true, data: results || [] }, 200, corsHeaders);
  }

  // Laporan Harian (Z-Report) + rekap shift kasir per tanggal
  if (path === '/api/reports/daily' && request.method === 'GET') {
    const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

    const summary = await env.DB.prepare(`
      SELECT
        COUNT(id) as total_transactions,
        COALESCE(SUM(final_amount), 0) as total_sales,
        COALESCE(SUM(total_cost), 0) as total_cogs,
        COALESCE(SUM(final_amount - total_cost), 0) as gross_profit
      FROM transactions
      WHERE tenant_id = ? AND date(created_at) = date(?)
    `)
      .bind(tenant_id, date)
      .first<{ total_transactions: number; total_sales: number; total_cogs: number; gross_profit: number }>();

    const totalSales = summary?.total_sales || 0;
    const grossProfit = summary?.gross_profit || 0;
    const profitMarginPct = totalSales > 0 ? Math.round((grossProfit / totalSales) * 1000) / 10 : 0;

    const { results: shiftRows } = await env.DB.prepare(`
      SELECT * FROM shifts
      WHERE tenant_id = ? AND date(start_time) = date(?)
      ORDER BY start_time ASC
    `)
      .bind(tenant_id, date)
      .all();

    const shifts = (shiftRows || []).map((row: any) => {
      const startingCash = row.start_cash || 0;
      const expectedCash = startingCash + (row.total_cash_sales || 0);
      const hasActual = row.actual_end_cash !== null && row.actual_end_cash !== undefined;
      return {
        shift_name: row.shift_name || 'Pagi',
        cashier_name: row.cashier_name,
        starting_cash: startingCash,
        expected_cash: expectedCash,
        actual_cash: hasActual ? row.actual_end_cash : null,
        difference: hasActual ? row.actual_end_cash - expectedCash : null,
        status: (row.status || '').toUpperCase(),
        start_time: row.start_time,
        end_time: row.end_time,
      };
    });

    return json(
      {
        success: true,
        summary: {
          total_transactions: summary?.total_transactions || 0,
          total_sales: totalSales,
          total_cogs: summary?.total_cogs || 0,
          gross_profit: grossProfit,
          profit_margin_pct: profitMarginPct,
        },
        shifts,
      },
      200,
      corsHeaders
    );
  }

  // Laporan Bulanan & tren laba
  if (path === '/api/reports/monthly' && request.method === 'GET') {
    const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);

    const summary = await env.DB.prepare(`
      SELECT
        COUNT(id) as total_transactions,
        COALESCE(SUM(final_amount), 0) as total_sales,
        COALESCE(SUM(total_cost), 0) as total_cogs,
        COALESCE(SUM(final_amount - total_cost), 0) as gross_profit
      FROM transactions
      WHERE tenant_id = ? AND strftime('%Y-%m', created_at) = ?
    `)
      .bind(tenant_id, month)
      .first<{ total_transactions: number; total_sales: number; total_cogs: number; gross_profit: number }>();

    const totalSales = summary?.total_sales || 0;
    const grossProfit = summary?.gross_profit || 0;
    const profitMarginPct = totalSales > 0 ? Math.round((grossProfit / totalSales) * 1000) / 10 : 0;

    const { results: trendRows } = await env.DB.prepare(`
      SELECT date(created_at) as sale_date,
             COUNT(id) as daily_tx,
             COALESCE(SUM(final_amount), 0) as daily_sales
      FROM transactions
      WHERE tenant_id = ? AND strftime('%Y-%m', created_at) = ?
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `)
      .bind(tenant_id, month)
      .all();

    return json(
      {
        success: true,
        summary: {
          total_transactions: summary?.total_transactions || 0,
          total_sales: totalSales,
          total_cogs: summary?.total_cogs || 0,
          gross_profit: grossProfit,
          profit_margin_pct: profitMarginPct,
        },
        daily_trends: trendRows || [],
      },
      200,
      corsHeaders
    );
  }

  return json({ error: 'Method not allowed' }, 405, corsHeaders);
}
