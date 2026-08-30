export async function handleShiftsRoute(
    pathname: string,
    request: Request,
    env: any,
    tenantId: string,
    user: any,
    corsHeaders: Record<string, string>
): Promise<Response | null> {
    const method = request.method;

    // 1. GET /api/shifts/current - Cek shift aktif milik user yang sedang login
    if (pathname === '/api/shifts/current' && method === 'GET') {
        const activeShift = await env.DB.prepare(`
            SELECT * FROM shifts 
            WHERE tenant_id = ? AND user_id = ? AND status = 'OPEN' 
            ORDER BY start_time DESC LIMIT 1
        `).bind(tenantId, user.id).first();

        return new Response(JSON.stringify({
            success: true,
            shift: activeShift || null
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    // 2. GET /api/shifts/summary-today - Ringkasan Dashboard Admin (Shift terakhir & kasir aktif hari ini)
    if (pathname === '/api/shifts/summary-today' && method === 'GET') {
        const today = new Date().toISOString().split('T')[0];

        // Kasir yang sedang status OPEN di hari ini
        const activeShifts = await env.DB.prepare(`
            SELECT id, user_id, cashier_name, shift_name, starting_cash, start_time, status 
            FROM shifts 
            WHERE tenant_id = ? AND status = 'OPEN' AND date(start_time) = date(?)
        `).bind(tenantId, today).all();

        // Shift paling terakhir hari ini beserta omzet penjualannya
        const latestShift = await env.DB.prepare(`
            SELECT s.*, 
              COALESCE((SELECT SUM(total_amount) FROM transactions WHERE shift_id = s.id), 0) as total_sales
            FROM shifts s
            WHERE s.tenant_id = ? AND date(s.start_time) = date(?)
            ORDER BY s.start_time DESC
            LIMIT 1
        `).bind(tenantId, today).first();

        return new Response(JSON.stringify({
            success: true,
            active_shifts: activeShifts.results || [],
            latest_shift: latestShift || null
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    // 3. POST /api/shifts/open - Membuka shift baru
    if (pathname === '/api/shifts/open' && method === 'POST') {
        const body: any = await request.json();
        const startingCash = Number(body.starting_cash) || 0;
        const shiftName = body.shift_name || 'Pagi';
        const shiftId = crypto.randomUUID();

        // Pastikan tidak ada shift yang masih OPEN untuk kasir ini
        const existing = await env.DB.prepare(`
            SELECT id FROM shifts WHERE tenant_id = ? AND user_id = ? AND status = 'OPEN'
        `).bind(tenantId, user.id).first();

        if (existing) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Anda masih memiliki shift aktif yang belum ditutup.'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        await env.DB.prepare(`
            INSERT INTO shifts (id, tenant_id, user_id, cashier_name, shift_name, starting_cash, status, start_time)
            VALUES (?, ?, ?, ?, ?, ?, 'OPEN', CURRENT_TIMESTAMP)
        `).bind(shiftId, tenantId, user.id, user.name, shiftName, startingCash).run();

        const createdShift = await env.DB.prepare(`SELECT * FROM shifts WHERE id = ?`).bind(shiftId).first();

        return new Response(JSON.stringify({
            success: true,
            message: 'Shift berhasil dibuka.',
            shift: createdShift
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    // 4. POST /api/shifts/close - Menutup shift (Blind Closing)
    if (pathname === '/api/shifts/close' && method === 'POST') {
        const body: any = await request.json();
        const actualCash = Number(body.actual_cash) || 0;
        const notes = body.notes || '';

        const activeShift: any = await env.DB.prepare(`
            SELECT * FROM shifts WHERE tenant_id = ? AND user_id = ? AND status = 'OPEN' ORDER BY start_time DESC LIMIT 1
        `).bind(tenantId, user.id).first();

        if (!activeShift) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Tidak ada shift aktif yang ditemukan.'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Hitung total penjualan tunai di shift ini
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

        return new Response(JSON.stringify({
            success: true,
            message: 'Shift berhasil ditutup.',
            summary: closedShift
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    return null;
}
