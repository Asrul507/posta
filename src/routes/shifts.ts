import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

export const shiftsRoute = new Hono<{ Bindings: Bindings }>();

function extractTenantFromHost(hostname: string): string {
  const host = hostname.toLowerCase().split(':')[0];
  if (host === "posta.gpro.my.id" || host === "localhost" || host === "127.0.0.1") return "posta";
  if (host.endsWith(".gpro.my.id")) {
    const sub = host.replace(".gpro.my.id", "");
    if (sub && sub !== "www") return sub;
  }
  return "posta";
}

// 1. Ambil Shift yang Sedang Berjalan
shiftsRoute.get('/current', async (c) => {
  try {
    const sub = extractTenantFromHost(new URL(c.req.url).hostname);
    let query = "SELECT * FROM shifts WHERE status = 'OPEN' ORDER BY start_time DESC LIMIT 1";
    let params: any[] = [];

    if (sub !== "posta") {
      const tenant = await c.env.DB.prepare("SELECT id FROM tenants WHERE subdomain = ?").bind(sub).first<{ id: string }>();
      if (tenant) {
        query = "SELECT * FROM shifts WHERE tenant_id = ? AND status = 'OPEN' ORDER BY start_time DESC LIMIT 1";
        params = [tenant.id];
      }
    }

    const shift = await c.env.DB.prepare(query).bind(...params).first();
    return c.json({ success: true, data: shift || null });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 2. Ringkasan Shift Hari Ini
shiftsRoute.get('/summary-today', async (c) => {
  try {
    const sub = extractTenantFromHost(new URL(c.req.url).hostname);
    let query = "SELECT * FROM shifts WHERE date(start_time) = date('now') ORDER BY start_time DESC";
    let params: any[] = [];

    if (sub !== "posta") {
      const tenant = await c.env.DB.prepare("SELECT id FROM tenants WHERE subdomain = ?").bind(sub).first<{ id: string }>();
      if (tenant) {
        query = "SELECT * FROM shifts WHERE tenant_id = ? AND date(start_time) = date('now') ORDER BY start_time DESC";
        params = [tenant.id];
      }
    }

    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ success: true, data: results });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 3. Buka Shift Baru
shiftsRoute.post('/open', async (c) => {
  try {
    const sub = extractTenantFromHost(new URL(c.req.url).hostname);
    let tenantId: string | null = null;
    if (sub !== "posta") {
      const tenant = await c.env.DB.prepare("SELECT id FROM tenants WHERE subdomain = ?").bind(sub).first<{ id: string }>();
      if (tenant) tenantId = tenant.id;
    }

    const body = await c.req.json();
    const { userId, startingCash, notes } = body;
    const shiftId = "shift_" + Date.now();

    await c.env.DB.prepare(`
      INSERT INTO shifts (id, tenant_id, user_id, starting_cash, status, start_time, notes)
      VALUES (?, ?, ?, ?, 'OPEN', datetime('now'), ?)
    `).bind(shiftId, tenantId, userId || 'kasir', Number(startingCash) || 0, notes || null).run();

    return c.json({ success: true, message: 'Shift berhasil dibuka', shiftId });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 4. Tutup Shift
shiftsRoute.post('/close', async (c) => {
  try {
    const body = await c.req.json();
    const { shiftId, endingCash, actualCash, notes } = body;

    await c.env.DB.prepare(`
      UPDATE shifts 
      SET status = 'CLOSED', end_time = datetime('now'), ending_cash = ?, actual_cash = ?, notes = ?
      WHERE id = ? OR (status = 'OPEN' AND ? IS NULL)
    `).bind(Number(endingCash) || 0, Number(actualCash) || 0, notes || null, shiftId || null, shiftId || null).run();

    return c.json({ success: true, message: 'Shift berhasil ditutup' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default shiftsRoute;
