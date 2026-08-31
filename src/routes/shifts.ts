import { Env, UserPayload } from '../types';

export async function handleShiftsRoutes(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  authUser?: UserPayload | null
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const tenant_id = authUser?.tenant_id || request.headers.get('x-tenant-id') || 'berkah';

  // Cek Status Shift Aktif
  if (path === '/api/shifts/current' && request.method === 'GET') {
    const shift = await env.DB.prepare(
      "SELECT * FROM shifts WHERE tenant_id = ? AND status = 'open' ORDER BY start_time DESC LIMIT 1"
    )
      .bind(tenant_id)
      .first();

    return new Response(JSON.stringify(shift || null), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // Buka Shift Baru
  if (path === '/api/shifts/open' && request.method === 'POST') {
    const body = (await request.json()) as {
      cashier_id: string;
      cashier_name: string;
      start_cash: number;
    };

    const shiftId = 'SFT-' + Date.now();
    await env.DB.prepare(`
      INSERT INTO shifts (
        id, tenant_id, cashier_id, cashier_name,
        start_cash, total_cash_sales, total_non_cash_sales,
        status, start_time
      ) VALUES (?, ?, ?, ?, ?, 0, 0, 'open', datetime('now'))
    `)
      .bind(
        shiftId,
        tenant_id,
        body.cashier_id || authUser?.id || 'cashier',
        body.cashier_name || authUser?.username || 'Kasir',
        body.start_cash || 0
      )
      .run();

    return new Response(
      JSON.stringify({ success: true, shift_id: shiftId }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Tutup Shift
  if (path === '/api/shifts/close' && request.method === 'POST') {
    const body = (await request.json()) as {
      shift_id: string;
      actual_end_cash: number;
      notes?: string;
    };

    // Hitung total cash dari transaksi shift ini
    const salesSummary = await env.DB.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN final_amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_method != 'cash' THEN final_amount ELSE 0 END), 0) as non_cash_sales
      FROM transactions
      WHERE tenant_id = ? AND shift_id = ?
    `)
      .bind(tenant_id, body.shift_id)
      .first<{ cash_sales: number; non_cash_sales: number }>();

    const cashSales = salesSummary?.cash_sales || 0;
    const nonCashSales = salesSummary?.non_cash_sales || 0;

    await env.DB.prepare(`
      UPDATE shifts
      SET 
        total_cash_sales = ?,
        total_non_cash_sales = ?,
        actual_end_cash = ?,
        notes = ?,
        status = 'closed',
        end_time = datetime('now')
      WHERE id = ? AND tenant_id = ?
    `)
      .bind(cashSales, nonCashSales, body.actual_end_cash, body.notes || '', body.shift_id, tenant_id)
      .run();

    return new Response(
      JSON.stringify({ success: true, shift_id: body.shift_id, total_cash_sales: cashSales }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
