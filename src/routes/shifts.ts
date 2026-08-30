import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

export const shiftsRoute = new Hono<{ Bindings: Bindings }>();

// 1. Shift yang sedang aktif
shiftsRoute.get('/current', async (c) => {
  try {
    const shift = await c.env.DB
      .prepare(`SELECT * FROM shifts WHERE status = 'OPEN' ORDER BY start_time DESC LIMIT 1`)
      .first();
    return c.json({ success: true, data: shift || null });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 2. Ringkasan Shift Hari Ini
shiftsRoute.get('/summary-today', async (c) => {
  try {
    const shifts = await c.env.DB
      .prepare(`
        SELECT * FROM shifts 
        WHERE date(start_time) = date('now') 
        ORDER BY start_time DESC
      `)
      .all();
    return c.json({ success: true, data: shifts.results });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 3. Buka Shift Baru
shiftsRoute.post('/open', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, startingCash, notes } = body;

    const newShift = await c.env.DB
      .prepare(`
        INSERT INTO shifts (user_id, starting_cash, status, start_time, notes)
        VALUES (?, ?, 'OPEN', datetime('now'), ?)
        RETURNING id
      `)
      .bind(userId || null, Number(startingCash) || 0, notes || null)
      .first<{ id: number | string }>();

    return c.json({ success: true, message: 'Shift berhasil dibuka', shiftId: newShift?.id });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 4. Tutup Shift
shiftsRoute.post('/close', async (c) => {
  try {
    const body = await c.req.json();
    const { shiftId, endingCash, actualCash, notes } = body;

    await c.env.DB
      .prepare(`
        UPDATE shifts 
        SET status = 'CLOSED', end_time = datetime('now'), ending_cash = ?, actual_cash = ?, notes = ?
        WHERE id = ?
      `)
      .bind(Number(endingCash) || 0, Number(actualCash) || 0, notes || null, shiftId)
      .run();

    return c.json({ success: true, message: 'Shift berhasil ditutup' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default shiftsRoute;
