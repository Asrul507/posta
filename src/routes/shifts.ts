import { Env, UserPayload } from '../types';

function json(body: unknown, status = 200, corsHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

interface ShiftRow {
  id: string;
  tenant_id: string;
  cashier_id: string;
  cashier_name: string;
  shift_name: string | null;
  start_cash: number;
  total_cash_sales: number;
  total_non_cash_sales: number;
  actual_end_cash: number | null;
  status: string;
  notes: string | null;
  start_time: string;
  end_time: string | null;
}

// Menyeragamkan bentuk data shift untuk frontend (nama field & status huruf besar),
// karena kolom di database tetap memakai status huruf kecil ('open'/'closed').
function mapShift(row: ShiftRow) {
  const startingCash = row.start_cash || 0;
  const expectedCash = startingCash + (row.total_cash_sales || 0);
  const hasActual = row.actual_end_cash !== null && row.actual_end_cash !== undefined;

  return {
    id: row.id,
    cashier_id: row.cashier_id,
    cashier_name: row.cashier_name,
    shift_name: row.shift_name || 'Pagi',
    starting_cash: startingCash,
    total_cash_sales: row.total_cash_sales || 0,
    total_non_cash_sales: row.total_non_cash_sales || 0,
    expected_cash: expectedCash,
    actual_cash: hasActual ? row.actual_end_cash : null,
    difference: hasActual ? (row.actual_end_cash as number) - expectedCash : null,
    status: (row.status || '').toUpperCase(),
    notes: row.notes,
    start_time: row.start_time,
    end_time: row.end_time,
  };
}

export async function handleShiftsRoutes(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  authUser?: UserPayload | null
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const tenant_id = authUser?.tenant_id || request.headers.get('x-tenant-id') || 'berkah';

  // Cek Status Shift Aktif Milik Kasir yang Sedang Login
  if (path === '/api/shifts/current' && request.method === 'GET') {
    const userId = url.searchParams.get('user_id') || authUser?.id;

    if (!userId) {
      return json({ success: true, active_shift: null }, 200, corsHeaders);
    }

    const shift = await env.DB.prepare(
      "SELECT * FROM shifts WHERE tenant_id = ? AND cashier_id = ? AND status = 'open' ORDER BY start_time DESC LIMIT 1"
    )
      .bind(tenant_id, userId)
      .first<ShiftRow>();

    return json({ success: true, active_shift: shift ? mapShift(shift) : null }, 200, corsHeaders);
  }

  // Buka Shift Baru
  if (path === '/api/shifts/open' && request.method === 'POST') {
    const body = (await request.json()) as {
      user_id?: string;
      cashier_id?: string;
      cashier_name?: string;
      shift_name?: string;
      starting_cash?: number;
      start_cash?: number;
    };

    const cashierId = body.cashier_id || body.user_id || authUser?.id;
    if (!cashierId) {
      return json({ success: false, error: 'ID kasir tidak ditemukan, silakan login ulang.' }, 400, corsHeaders);
    }
    const cashierName = body.cashier_name || authUser?.username || 'Kasir';
    const shiftName = body.shift_name || 'Pagi';
    const startCash = Number(body.starting_cash ?? body.start_cash ?? 0) || 0;

    const existing = await env.DB.prepare(
      "SELECT id FROM shifts WHERE tenant_id = ? AND cashier_id = ? AND status = 'open' LIMIT 1"
    )
      .bind(tenant_id, cashierId)
      .first();

    if (existing) {
      return json({ success: false, error: 'Anda masih memiliki shift aktif yang belum ditutup.' }, 409, corsHeaders);
    }

    const shiftId = 'SFT-' + Date.now();
    await env.DB.prepare(`
      INSERT INTO shifts (
        id, tenant_id, cashier_id, cashier_name, shift_name,
        start_cash, total_cash_sales, total_non_cash_sales,
        status, start_time
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'open', datetime('now'))
    `)
      .bind(shiftId, tenant_id, cashierId, cashierName, shiftName, startCash)
      .run();

    const shift = await env.DB.prepare('SELECT * FROM shifts WHERE id = ?').bind(shiftId).first<ShiftRow>();

    return json(
      { success: true, shift_id: shiftId, shift: shift ? mapShift(shift) : null },
      200,
      corsHeaders
    );
  }

  // Tutup Shift
  if (path === '/api/shifts/close' && request.method === 'POST') {
    const body = (await request.json()) as {
      shift_id?: string;
      actual_cash?: number;
      actual_end_cash?: number;
      notes?: string;
    };

    const shiftId = body.shift_id;
    if (!shiftId) {
      return json({ success: false, error: 'Shift ID wajib diisi.' }, 400, corsHeaders);
    }

    const shift = await env.DB.prepare(
      'SELECT * FROM shifts WHERE id = ? AND tenant_id = ?'
    )
      .bind(shiftId, tenant_id)
      .first<ShiftRow>();

    if (!shift) {
      return json({ success: false, error: 'Shift tidak ditemukan.' }, 404, corsHeaders);
    }
    if (shift.status === 'closed') {
      return json({ success: false, error: 'Shift ini sudah ditutup sebelumnya.' }, 409, corsHeaders);
    }

    // Hitung total cash & non-cash dari transaksi shift ini
    const salesSummary = await env.DB.prepare(`
      SELECT
        COUNT(id) as total_transactions,
        COALESCE(SUM(final_amount), 0) as grand_total_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN final_amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_method != 'cash' THEN final_amount ELSE 0 END), 0) as non_cash_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN 1 ELSE 0 END), 0) as count_cash,
        COALESCE(SUM(CASE WHEN payment_method != 'cash' THEN 1 ELSE 0 END), 0) as count_non_cash
      FROM transactions
      WHERE tenant_id = ? AND shift_id = ?
    `)
      .bind(tenant_id, shiftId)
      .first<{
        total_transactions: number;
        grand_total_sales: number;
        cash_sales: number;
        non_cash_sales: number;
        count_cash: number;
        count_non_cash: number;
      }>();

    const cashSales = salesSummary?.cash_sales || 0;
    const nonCashSales = salesSummary?.non_cash_sales || 0;
    const startingCash = shift.start_cash || 0;
    const expectedCash = startingCash + cashSales;
    const actualCash = Number(body.actual_cash ?? body.actual_end_cash ?? 0) || 0;
    const difference = actualCash - expectedCash;

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
      .bind(cashSales, nonCashSales, actualCash, body.notes || '', shiftId, tenant_id)
      .run();

    return json(
      {
        success: true,
        shift_id: shiftId,
        summary: {
          shift_name: shift.shift_name || 'Pagi',
          cashier_name: shift.cashier_name,
          end_time: new Date().toISOString(),
          total_transactions: salesSummary?.total_transactions || 0,
          grand_total_sales: salesSummary?.grand_total_sales || 0,
          total_cash: cashSales,
          count_cash: salesSummary?.count_cash || 0,
          total_non_cash: nonCashSales,
          count_non_cash: salesSummary?.count_non_cash || 0,
          starting_cash: startingCash,
          expected_cash: expectedCash,
          actual_cash: actualCash,
          difference,
        },
      },
      200,
      corsHeaders
    );
  }

  return json({ error: 'Method not allowed' }, 405, corsHeaders);
}
