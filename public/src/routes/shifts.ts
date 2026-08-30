import { Env } from "../types";

// Fungsi helper verifikasi JWT sederhana di route shift
async function getUserFromRequest(request: Request, env: Env): Promise<any | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload;
  } catch {
    return null;
  }
}

// 1. GET /api/shifts/current
export async function handleGetCurrentShift(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const activeShift = await env.DB.prepare(`
      SELECT * FROM shifts 
      WHERE tenant_id = ? AND user_id = ? AND status = 'OPEN' 
      ORDER BY start_time DESC LIMIT 1
    `).bind(user.tenant_id, user.id).first();

    return Response.json({
      success: true,
      shift: activeShift || null
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 2. GET /api/shifts/summary-today (Untuk Widget Dashboard Admin)
export async function handleGetShiftsSummaryToday(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const today = new Date().toISOString().split("T")[0];

    // Kasir yang sedang OPEN hari ini
    const activeShifts = await env.DB.prepare(`
      SELECT id, user_id, cashier_name, shift_name, starting_cash, start_time, status 
      FROM shifts 
      WHERE tenant_id = ? AND status = 'OPEN' AND date(start_time) = date(?)
    `).bind(user.tenant_id, today).all();

    // Shift terakhir hari ini beserta total transaksinya
    const latestShift = await env.DB.prepare(`
      SELECT s.*, 
        COALESCE((SELECT SUM(total_amount) FROM transactions WHERE shift_id = s.id), 0) as total_sales
      FROM shifts s
      WHERE s.tenant_id = ? AND date(s.start_time) = date(?)
      ORDER BY s.start_time DESC
      LIMIT 1
    `).bind(user.tenant_id, today).first();

    return Response.json({
      success: true,
      active_shifts: activeShifts.results || [],
      latest_shift: latestShift || null
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 3. POST /api/shifts/open
export async function handleOpenShift(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body: any = await request.json();
    const startingCash = Number(body.starting_cash) || 0;
    const shiftName = body.shift_name || "Pagi";
    const shiftId = "shift_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);

    const existing = await env.DB.prepare(`
      SELECT id FROM shifts WHERE tenant_id = ? AND user_id = ? AND status = 'OPEN'
    `).bind(user.tenant_id, user.id).first();

    if (existing) {
      return Response.json({ success: false, error: "Anda masih memiliki shift aktif yang belum ditutup." }, { status: 400 });
    }

    await env.DB.prepare(`
      INSERT INTO shifts (id, tenant_id, user_id, cashier_name, shift_name, starting_cash, status, start_time)
      VALUES (?, ?, ?, ?, ?, ?, 'OPEN', CURRENT_TIMESTAMP)
    `).bind(shiftId, user.tenant_id, user.id, user.name, shiftName, startingCash).run();

    const createdShift = await env.DB.prepare(`SELECT * FROM shifts WHERE id = ?`).bind(shiftId).first();

    return Response.json({
      success: true,
      message: "Shift berhasil dibuka.",
      shift: createdShift
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 4. POST /api/shifts/close (Blind Closing)
export async function handleCloseShift(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body: any = await request.json();
    const actualCash = Number(body.actual_cash) || 0;
    const notes = body.notes || "";

    const activeShift: any = await env.DB.prepare(`
      SELECT * FROM shifts WHERE tenant_id = ? AND user_id = ? AND status = 'OPEN' ORDER BY start_time DESC LIMIT 1
    `).bind(user.tenant_id, user.id).first();

    if (!activeShift) {
      return Response.json({ success: false, error: "Tidak ada shift aktif yang ditemukan." }, { status: 400 });
    }

    const cashTx: any = await env.DB.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total_cash_sales 
      FROM transactions 
      WHERE shift_id = ? AND payment_method = 'CASH'
    `).bind(activeShift.id).first();

    const totalCashSales = Number(cashTx?.total_cash_sales) || 0;
    const expectedCash = activeShift.starting_cash + totalCashSales;
    const difference = actualCash - expectedCash;

    await env.DB.prepare(`
      UPDATE shifts 
      SET end_time = CURRENT_TIMESTAMP,
          expected_cash = ?,
          actual_cash = ?,
          difference = ?,
          status = 'CLOSED',
          notes = ?
      WHERE id = ?
    `).bind(expectedCash, actualCash, difference, notes, activeShift.id).run();

    const closedShift = await env.DB.prepare(`SELECT * FROM shifts WHERE id = ?`).bind(activeShift.id).first();

    return Response.json({
      success: true,
      message: "Shift berhasil ditutup.",
      summary: closedShift
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
