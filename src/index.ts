// src/index.ts
import { Hono } from 'hono';
import { checkoutRoute } from './routes/checkout';
import { poRoute } from './routes/po';
import { stockRoute } from './routes/stock';
import { productsRoute } from './routes/products';
import { reportsRoute } from './routes/reports';
import { shiftsRoute } from './routes/shifts';

export type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

const JWT_SECRET = "posta-secure-jwt-secret-key-2026";

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================
async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function createJWT(payload: object): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const encHeader = btoa(JSON.stringify(header));
  const encPayload = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + (7 * 24 * 3600) }));
  const signatureInput = `${encHeader}.${encPayload}`;
  
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signatureInput));
  const encSig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${signatureInput}.${encSig}`;
}

function extractSubdomain(hostname: string): string {
  const host = hostname.toLowerCase().split(':')[0];
  if (host === "posta.gpro.my.id" || host === "localhost" || host === "127.0.0.1") {
    return "posta";
  }
  if (host.endsWith(".gpro.my.id")) {
    const sub = host.replace(".gpro.my.id", "");
    if (sub && sub !== "www") {
      return sub;
    }
  }
  return "posta";
}

// =========================================================================
// AUTH & TENANT ROUTES
// =========================================================================
app.post('/api/auth/login', async (c) => {
  try {
    const { username, password } = await c.req.json();
    const cleanUser = (username || "").trim().toLowerCase();
    const inputPass = (password || "").trim();

    if (!cleanUser || !inputPass) {
      return c.json({ success: false, error: "Username dan password wajib diisi" }, 400);
    }

    const currentSubdomain = extractSubdomain(new URL(c.req.url).hostname);
    let user: any = null;

    if (currentSubdomain === "posta") {
      user = await c.env.DB.prepare(
        "SELECT * FROM users WHERE username = ? AND role = 'SUPERADMIN' AND is_active = 1"
      ).bind(cleanUser).first();
    } else {
      const tenant = await c.env.DB.prepare(
        "SELECT id FROM tenants WHERE subdomain = ? AND is_active = 1"
      ).bind(currentSubdomain).first();

      if (!tenant) {
        return c.json({ success: false, error: `Toko '${currentSubdomain}' tidak ditemukan atau nonaktif.` }, 404);
      }

      user = await c.env.DB.prepare(
        "SELECT * FROM users WHERE username = ? AND tenant_id = ? AND is_active = 1"
      ).bind(cleanUser, tenant.id).first();
    }

    if (!user) {
      return c.json({ success: false, error: "Username tidak terdaftar." }, 401);
    }

    const salt = user.salt || "posta_salt_2026";
    const computedHash = await hashPassword(inputPass, salt);
    const isMatch = (computedHash === user.password_hash) || (inputPass === user.password_hash);

    if (!isMatch) {
      return c.json({ success: false, error: "Password salah." }, 401);
    }

    if (inputPass === user.password_hash) {
      await c.env.DB.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?")
        .bind(computedHash, salt, user.id)
        .run();
    }

    const token = await createJWT({
      id: user.id,
      tenant_id: user.tenant_id,
      username: user.username,
      name: user.name,
      role: user.role
    });

    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        tenant_id: user.tenant_id
      }
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.get('/api/tenant/info', async (c) => {
  try {
    const currentSubdomain = extractSubdomain(new URL(c.req.url).hostname);
    if (currentSubdomain === "posta") {
      return c.json({
        success: true,
        is_admin: true,
        data: { id: "admin", name: "Developer Dashboard", subdomain: "posta" }
      });
    }

    const tenant = await c.env.DB.prepare(
      "SELECT id, subdomain, name, address, phone FROM tenants WHERE subdomain = ? AND is_active = 1"
    ).bind(currentSubdomain).first();

    if (!tenant) {
      return c.json({ success: false, error: `Toko '${currentSubdomain}' tidak ditemukan.` }, 404);
    }

    return c.json({ success: true, is_admin: false, data: tenant });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// =========================================================================
// ADMIN ROUTES (TENANTS, USERS, IMPERSONATION)
// =========================================================================
app.get('/api/admin/tenants', async (c) => {
  try {
    const query = `
      SELECT 
        t.id, t.subdomain, t.name, t.address, t.phone, t.is_active, t.created_at,
        (SELECT COUNT(*) FROM products p WHERE p.tenant_id = t.id) AS total_products,
        (SELECT COUNT(*) FROM transactions tr WHERE tr.tenant_id = t.id) AS total_transactions
      FROM tenants t
      ORDER BY t.created_at DESC
    `;
    const { results } = await c.env.DB.prepare(query).all();
    return c.json({ success: true, data: results });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.post('/api/admin/tenants', async (c) => {
  try {
    const payload: any = await c.req.json();
    const cleanSubdomain = (payload.subdomain || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

    if (!cleanSubdomain || !payload.name) {
      return c.json({ success: false, error: "Subdomain dan Nama Toko wajib diisi" }, 400);
    }

    const existing = await c.env.DB.prepare("SELECT id FROM tenants WHERE subdomain = ?").bind(cleanSubdomain).first();
    if (existing) {
      return c.json({ success: false, error: `Subdomain '${cleanSubdomain}' sudah digunakan.` }, 400);
    }

    const tenantId = "tenant_" + Math.random().toString(36).substring(2, 9);
    await c.env.DB.prepare(`
      INSERT INTO tenants (id, subdomain, name, address, phone, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).bind(tenantId, cleanSubdomain, payload.name, payload.address || "", payload.phone || "").run();

    const salt = "posta_salt_2026";
    const ownerPassHash = await hashPassword("123456", salt);
    await c.env.DB.prepare(`
      INSERT INTO users (id, tenant_id, username, password_hash, salt, name, role, is_active)
      VALUES (?, ?, 'owner', ?, ?, ?, 'OWNER', 1)
    `).bind("usr_" + Date.now(), tenantId, ownerPassHash, salt, "Owner " + payload.name).run();

    return c.json({
      success: true,
      message: `Toko '${payload.name}' berhasil dibuat!`,
      subdomain: cleanSubdomain
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.get('/api/admin/users', async (c) => {
  try {
    const query = `
      SELECT 
        u.id, u.tenant_id, u.username, u.name, u.role, u.is_active, u.created_at,
        COALESCE(t.name, 'SUPERADMIN / PUSAT') AS tenant_name,
        COALESCE(t.subdomain, 'posta') AS subdomain
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      ORDER BY u.created_at DESC
    `;
    const { results } = await c.env.DB.prepare(query).all();
    return c.json({ success: true, data: results });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.post('/api/admin/users', async (c) => {
  try {
    const payload: any = await c.req.json();
    const cleanUser = (payload.username || "").trim().toLowerCase();
    const cleanName = (payload.name || "").trim();
    const role = payload.role;
    const tenantId = payload.tenant_id === "SUPERADMIN" ? null : payload.tenant_id;

    if (!cleanUser || !payload.password || !cleanName || !role) {
      return c.json({ success: false, error: "Semua form wajib diisi lengkap." }, 400);
    }

    let checkQuery = "SELECT id FROM users WHERE username = ? AND tenant_id IS NULL";
    let checkParams: any[] = [cleanUser];

    if (tenantId) {
      checkQuery = "SELECT id FROM users WHERE username = ? AND tenant_id = ?";
      checkParams = [cleanUser, tenantId];
    }

    const existing = await c.env.DB.prepare(checkQuery).bind(...checkParams).first();
    if (existing) {
      return c.json({ success: false, error: `Username '${cleanUser}' sudah ada di toko ini.` }, 400);
    }

    const salt = "posta_salt_2026";
    const passHash = await hashPassword(payload.password, salt);
    const newUserId = "usr_" + Date.now();

    await c.env.DB.prepare(`
      INSERT INTO users (id, tenant_id, username, password_hash, salt, name, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(newUserId, tenantId, cleanUser, passHash, salt, cleanName, role).run();

    return c.json({
      success: true,
      message: `User '${cleanName}' (${role}) berhasil ditambahkan!`
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.get('/api/admin/impersonate', async (c) => {
  try {
    const targetSub = c.req.query("subdomain");
    if (!targetSub) {
      return c.json({ success: false, error: "Subdomain wajib ada" }, 400);
    }

    const tenant = await c.env.DB.prepare(
      "SELECT id, subdomain, name FROM tenants WHERE subdomain = ? AND is_active = 1"
    ).bind(targetSub).first();

    if (!tenant) {
      return c.json({ success: false, error: "Toko tidak ditemukan" }, 404);
    }

    const token = await createJWT({
      id: "superadmin_session",
      tenant_id: tenant.id,
      username: "superadmin",
      name: "Superadmin (" + tenant.name + ")",
      role: "OWNER"
    });

    return c.json({
      success: true,
      token,
      user: {
        id: "superadmin_session",
        username: "superadmin",
        name: "Superadmin",
        role: "OWNER",
        tenant_id: tenant.id
      },
      target_url: `https://${targetSub}.gpro.my.id?sso_token=${token}`
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// =========================================================================
// REGISTER MODULAR SUB-ROUTES
// =========================================================================
app.route('/api/checkout', checkoutRoute);
app.route('/api/po', poRoute);
app.route('/api/stock', stockRoute);
app.route('/api/products', productsRoute);
app.route('/api/reports', reportsRoute);
app.route('/api/shifts', shiftsRoute);

// Fallback untuk melayani frontend static assets (HTML/CSS/JS dari folder public/)
app.all('*', (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
