import { Hono } from 'hono';
import { Bindings, Variables } from '../types';

export const shiftsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// GET /api/shifts/current - Cek shift aktif milik user yang login
shiftsRouter.get('/current', async (c) => {
    const tenantId = c.get('tenantId');
    const user = c.get('user');

    const activeShift = await c.env.DB.prepare(`
        SELECT * FROM shifts 
        WHERE tenant_id = ? AND user_id = ? AND status = 'OPEN' 
        ORDER BY start_time DESC LIMIT 1
    `).bind(tenantId, user.id).first();

    return c.json({
        success: true,
        shift: activeShift || null
    });
});

// GET /api/shifts/summary-today - Untuk ringkasan Dashboard Admin
shiftsRouter.get('/summary-today', async (c) => {
    const tenantId = c.get('tenantId');
    const today = new Date().toISOString().split('T')[0];

    // 1. Kasir yang sedang OPEN hari ini
    const activeShifts = await c.env.DB.prepare(`
        SELECT id, user_id, cashier_name, shift_name, starting_cash, start_time, status 
        FROM shifts 
        WHERE tenant_id = ? AND status = 'OPEN' AND date(start_time) = date(?)
    `).bind(tenantId, today).all();

    // 2. Shift paling terakhir hari ini beserta total penjualannya
    const latestShift = await c.env.DB.prepare(`
        SELECT s.*, 
          COALESCE((SELECT SUM(total_amount) FROM transactions WHERE shift_id = s.id), 0) as total_sales
        FROM shifts s
        WHERE s.tenant_id = ? AND date(s.start_time) = date(?)
        ORDER BY s.start_time DESC
        LIMIT 1
    `).bind(tenantId, today).first();

    return c.json({
        success: true,
        active_shifts: activeShifts.results || [],
        latest_shift: latestShift || null
    });
});

// POST /api/shifts/open - Membuka shift baru
shiftsRouter.post('/open', async (c) => {
    const tenantId = c.get('tenantId');
    const user = c.get('user');
    const body = await c.req.json();

    const startingCash = Number(body.starting_cash) || 0;
    const shiftName = body.shift_name || 'Pagi';
    const shiftId = crypto.randomUUID();

    // Pastikan tidak ada shift yang masih OPEN untuk user ini
    const existing = await c.env.DB.prepare(`
        SELECT id FROM shifts WHERE tenant_id = ? AND user_id = ? AND status = 'OPEN'
    `).bind(tenantId, user.id).first();

    if (existing) {
        return c.json({ success: false, message: 'Anda masih memiliki shift aktif yang belum ditutup.' }, 400);
    }

    await c.env.DB.prepare(`
        INSERT INTO shifts (id, tenant_id, user_id, cashier_name, shift_name, starting_cash, status, start_time)
        VALUES (?, ?, ?, ?, ?, ?, 'OPEN', CURRENT_TIMESTAMP)
    `).bind(shiftId, tenantId, user.id, user.name, shiftName, startingCash).run();

    const createdShift = await c.env.DB.prepare(`SELECT * FROM shifts WHERE id = ?`).bind(shiftId).first();

    return c.json({
        success: true,
        message: 'Shift berhasil dibuka.',
        shift: createdShift
    });
});

// POST /api/shifts/close - Menutup shift (Blind Closing)
shiftsRouter.post('/close', async (c) => {
    const tenantId = c.get('tenantId');
    const user = c.get('user');
    const body = await c.req.json();
    const actualCash = Number(body.actual_cash) || 0;
    const notes = body.notes || '';

    const activeShift: any = await c.env.DB.prepare(`
        SELECT * FROM shifts WHERE tenant_id = ? AND user_id = ? AND status = 'OPEN' ORDER BY start_time DESC LIMIT 1
    `).bind(tenantId, user.id).first();

    if (!activeShift) {
        return c.json({ success: false, message: 'Tidak ada shift aktif yang ditemukan.' }, 400);
    }

    // Hitung total uang tunai dari transaksi di shift ini
    const cashTx: any = await c.env.DB.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total_cash_sales 
        FROM transactions 
        WHERE shift_id = ? AND payment_method = 'CASH'
    `).bind(activeShift.id).first();

    const totalCashSales = Number(cashTx?.total_cash_sales) || 0;
    const expectedCash = activeShift.starting_cash + totalCashSales;
    const difference = actualCash - expectedCash;

    await c.env.DB.prepare(`
        UPDATE shifts 
        SET end_time = CURRENT_TIMESTAMP,
            expected_cash = ?,
            actual_cash = ?,
            difference = ?,
            status = 'CLOSED',
            notes = ?
        WHERE id = ?
    `).bind(expectedCash, actualCash, difference, notes, activeShift.id).run();

    const closedShift = await c.env.DB.prepare(`SELECT * FROM shifts WHERE id = ?`).bind(activeShift.id).first();

    return c.json({
        success: true,
        message: 'Shift berhasil ditutup.',
        summary: closedShift
    });
});
