import { Env } from "../types";

// 1. GET /api/shifts/current -> Cek status shift aktif kasir yang login
export async function handleGetCurrentShift(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenant_id");
    const userId = url.searchParams.get("user_id");

    if (!tenantId || !userId) {
      return Response.json({ success: false, error: "tenant_id dan user_id wajib ada" }, { status: 400 });
    }

    const shift = await env.DB.prepare(`
      SELECT * FROM shifts 
      WHERE tenant_id = ? AND user_id = ? AND status = 'OPEN' 
      ORDER BY start_time DESC LIMIT 1
    `).bind(tenantId, userId).first();

    return Response.json({ success: true, active_shift: shift || null });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 2. POST /api/shifts/open -> Buka Shift Baru (Input Modal Awal)
export async function handleOpenShift(request: Request, env: Env): Promise<Response> {
  try {
    const payload: {
      tenant_id: string;
      user_id: string;
      cashier_name: string;
      starting_cash: number;
    } = await request.json();

    if (!payload.tenant_id || !payload.user_id) {
      return Response.json({ success: false, error: "Data tenant dan user wajib diisi" }, { status: 400 });
    }

    // Cek apakah masih ada shift open
    const existing = await env.DB.prepare(`
      SELECT id FROM shifts WHERE tenant_id = ? AND user_id = ? AND status = 'OPEN'
    `).bind(payload.tenant_id, payload.user_id).first();

    if (existing) {
      return Response.json({ success: false, error: "Anda masih memiliki shift yang belum ditutup." }, { status: 400 });
    }

    const shiftId = "shift_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const startCash = parseFloat(String(payload.starting_cash)) || 0;

    await env.DB.prepare(`
      INSERT INTO shifts (id, tenant_id, user_id, cashier_name, starting_cash, status)
      VALUES (?, ?, ?, ?, ?, 'OPEN')
    `).bind(shiftId, payload.tenant_id, payload.user_id, payload.cashier_name, startCash).run();

    const newShift = await env.DB.prepare("SELECT * FROM shifts WHERE id = ?").bind(shiftId).first();

    return Response.json({ success: true, message: "Shift berhasil dibuka!", shift: newShift });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 3. POST /api/shifts/close -> Tutup Shift Kasir (Blind Cash Drop)
export async function handleCloseShift(request: Request, env: Env): Promise<Response> {
  try {
    const payload: {
      shift_id: string;
      actual_cash: number;
      notes?: string;
    } = await request.json();

    if (!payload.shift_id) {
      return Response.json({ success: false, error: "shift_id wajib ada" }, { status: 400 });
    }

    const shift: any = await env.DB.prepare("SELECT * FROM shifts WHERE id = ?").bind(payload.shift_id).first();
    if (!shift || shift.status !== 'OPEN') {
      return Response.json({ success: false, error: "Shift tidak valid atau sudah ditutup sebelumnya." }, { status: 400 });
    }

    // Hitung total penjualan tunai pada shift ini
    const cashSalesRes: any = await env.DB.prepare(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_cash_sales,
        COUNT(id) as total_tx
      FROM transactions 
      WHERE shift_id = ? AND payment_method = 'CASH'
    `).bind(shift.id).first();

    const totalCashSales = cashSalesRes?.total_cash_sales || 0;
    const totalTx = cashSalesRes?.total_tx || 0;

    const startingCash = shift.starting_cash || 0;
    const expectedCash = startingCash + totalCashSales;
    const actualCash = parseFloat(String(payload.actual_cash)) || 0;
    const difference = actualCash - expectedCash;

    // Kunci shift di database
    await env.DB.prepare(`
      UPDATE shifts 
      SET end_time = CURRENT_TIMESTAMP,
          expected_cash = ?,
          actual_cash = ?,
          difference = ?,
          status = 'CLOSED',
          notes = ?
      WHERE id = ?
    `).bind(expectedCash, actualCash, difference, payload.notes || "", shift.id).run();

    return Response.json({
      success: true,
      message: "Shift berhasil ditutup.",
      summary: {
        shift_id: shift.id,
        cashier_name: shift.cashier_name,
        start_time: shift.start_time,
        end_time: new Date().toISOString(),
        starting_cash: startingCash,
        total_cash_sales: totalCashSales,
        total_transactions: totalTx,
        expected_cash: expectedCash,
        actual_cash: actualCash,
        difference: difference,
        notes: payload.notes || ""
      }
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
