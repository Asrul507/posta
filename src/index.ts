import { Env } from "./types";
import { handleGetProducts } from "./routes/products";
import { handleCheckout } from "./routes/checkout";
import { handleSubmitPO } from "./routes/po";
import { handleStockAdjust } from "./routes/stock";
import { handleGetTransactions, handleGetPOHistory } from "./routes/reports";

const JWT_SECRET = "posta-secure-jwt-secret-key-2026";

// Helper Hash Password SHA-256
async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Helper Simple JWT Token Generator
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

// Helper Ekstraksi Subdomain
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const currentSubdomain = extractSubdomain(url.hostname);

    // =========================================================================
    // 1. ENDPOINT AUTHENTICATION (LOGIN)
    // =========================================================================
    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      try {
        const { username, password } = await request.json() as any;
        const cleanUser = (username || "").trim().toLowerCase();
        const inputPass = (password || "").trim();

        if (!cleanUser || !inputPass) {
          return Response.json({ success: false, error: "Username dan password wajib diisi" }, { status: 400 });
        }

        let user: any = null;
        if (currentSubdomain === "posta") {
          // Login Superadmin
          user = await env.DB.prepare(
            "SELECT * FROM users WHERE username = ? AND role = 'SUPERADMIN' AND is_active = 1"
          ).bind(cleanUser).first();
        } else {
          // Login Toko / Tenant
          const tenant = await env.DB.prepare(
            "SELECT id FROM tenants WHERE subdomain = ? AND is_active = 1"
          ).bind(currentSubdomain).first();

          if (!tenant) {
            return Response.json({ success: false, error: `Toko '${currentSubdomain}' tidak ditemukan atau nonaktif.` }, { status: 404 });
          }

          user = await env.DB.prepare(
            "SELECT * FROM users WHERE username = ? AND tenant_id = ? AND is_active = 1"
          ).bind(cleanUser, tenant.id).first();
        }

        if (!user) {
          return Response.json({ success: false, error: "Username tidak terdaftar." }, { status: 401 });
        }

        const salt = user.salt || "posta_salt_2026";
        const computedHash = await hashPassword(inputPass, salt);

        // Cocokkan dengan Hash ATAU cocok dengan teks langsung
        const isMatch = (computedHash === user.password_hash) || (inputPass === user.password_hash);

        if (!isMatch) {
          return Response.json({ success: false, error: "Password salah." }, { status: 401 });
        }

        // Jika password di database masih plain, otomatis update jadi hash yang aman
        if (inputPass === user.password_hash) {
          await env.DB.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?")
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

        return Response.json({
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
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // =========================================================================
    // 2. ENDPOINT INFO TENANT
    // =========================================================================
    if (url.pathname === "/api/tenant/info" && request.method === "GET") {
      try {
        if (currentSubdomain === "posta") {
          return Response.json({
            success: true,
            is_admin: true,
            data: { id: "admin", name: "Developer Dashboard", subdomain: "posta" }
          });
        }

        const tenant = await env.DB.prepare(
          "SELECT id, subdomain, name, address, phone FROM tenants WHERE subdomain = ? AND is_active = 1"
        ).bind(currentSubdomain).first();

        if (!tenant) {
          return Response.json(
            { success: false, error: `Toko '${currentSubdomain}' tidak ditemukan atau nonaktif.` },
            { status: 404 }
          );
        }

        return Response.json({ success: true, is_admin: false, data: tenant });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // =========================================================================
    // 3. ENDPOINT DEVELOPER HUB (SUPERADMIN TENANTS)
    // =========================================================================
    if (url.pathname === "/api/admin/tenants" && request.method === "GET") {
      try {
        const query = `
          SELECT 
            t.id, 
            t.subdomain, 
            t.name, 
            t.address, 
            t.phone, 
            t.is_active, 
            t.created_at,
            (SELECT COUNT(*) FROM products p WHERE p.tenant_id = t.id) AS total_products,
            (SELECT COUNT(*) FROM transactions tr WHERE tr.tenant_id = t.id) AS total_transactions
          FROM tenants t
          ORDER BY t.created_at DESC
        `;
        const { results } = await env.DB.prepare(query).all();
        return Response.json({ success: true, data: results });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    if (url.pathname === "/api/admin/tenants" && request.method === "POST") {
      try {
        const payload: { subdomain: string; name: string; address?: string; phone?: string } = await request.json();
        const cleanSubdomain = payload.subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

        if (!cleanSubdomain || !payload.name) {
          return Response.json({ success: false, error: "Subdomain dan Nama Toko wajib diisi" }, { status: 400 });
        }

        const existing = await env.DB.prepare("SELECT id FROM tenants WHERE subdomain = ?").bind(cleanSubdomain).first();
        if (existing) {
          return Response.json({ success: false, error: `Subdomain '${cleanSubdomain}' sudah digunakan.` }, { status: 400 });
        }

        const tenantId = "tenant_" + Math.random().toString(36).substring(2, 9);
        await env.DB.prepare(`
          INSERT INTO tenants (id, subdomain, name, address, phone, is_active)
          VALUES (?, ?, ?, ?, ?, 1)
        `).bind(tenantId, cleanSubdomain, payload.name, payload.address || "", payload.phone || "").run();

        const salt = "posta_salt_2026";
        const ownerPassHash = await hashPassword("123456", salt);
        await env.DB.prepare(`
          INSERT INTO users (id, tenant_id, username, password_hash, salt, name, role, is_active)
          VALUES (?, ?, 'owner', ?, ?, ?, 'OWNER', 1)
        `).bind("usr_" + Date.now(), tenantId, ownerPassHash, salt, "Owner " + payload.name).run();

        return Response.json({
          success: true,
          message: `Toko '${payload.name}' berhasil dibuat! Akun default owner dibuat (user: owner / pass: 123456).`,
          subdomain: cleanSubdomain
        });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // =========================================================================
    // 4. API OPERASIONAL KASIR
    // =========================================================================
    if (url.pathname === "/api/products" && request.method === "GET") {
      return handleGetProducts(request, env);
    }
    if (url.pathname === "/api/checkout" && request.method === "POST") {
      return handleCheckout(request, env);
    }
    if (url.pathname === "/api/po/submit" && request.method === "POST") {
      return handleSubmitPO(request, env);
    }
    if (url.pathname === "/api/stock/adjust" && request.method === "POST") {
      return handleStockAdjust(request, env);
    }
    if (url.pathname === "/api/reports/transactions" && request.method === "GET") {
      return handleGetTransactions(request, env);
    }
    if (url.pathname === "/api/reports/po" && request.method === "GET") {
      return handleGetPOHistory(request, env);
    }

    // =========================================================================
    // 5. STATIC ASSETS FRONTEND
    // =========================================================================
    return env.ASSETS.fetch(request);

    // =========================================================================
    // ENDPOINT SUPERADMIN: LIST USERS & TAMBAH USER UNTUK SEMUA TOKO
    // =========================================================================

    // GET /api/admin/users -> Ambil daftar user seluruh toko
    if (url.pathname === "/api/admin/users" && request.method === "GET") {
      try {
        const query = `
          SELECT 
            u.id, 
            u.tenant_id, 
            u.username, 
            u.name, 
            u.role, 
            u.is_active, 
            u.created_at,
            COALESCE(t.name, 'SUPERADMIN / PUSAT') AS tenant_name,
            COALESCE(t.subdomain, 'posta') AS subdomain
          FROM users u
          LEFT JOIN tenants t ON u.tenant_id = t.id
          ORDER BY u.created_at DESC
        `;
        const { results } = await env.DB.prepare(query).all();
        return Response.json({ success: true, data: results });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // POST /api/admin/users -> Tambah user baru untuk toko mana saja
    if (url.pathname === "/api/admin/users" && request.method === "POST") {
      try {
        const payload: {
          tenant_id: string; // ID Toko atau 'SUPERADMIN'
          username: string;
          password: string;
          name: string;
          role: string;
        } = await request.json();

        const cleanUser = (payload.username || "").trim().toLowerCase();
        const cleanName = (payload.name || "").trim();
        const role = payload.role;
        const tenantId = payload.tenant_id === "SUPERADMIN" ? null : payload.tenant_id;

        if (!cleanUser || !payload.password || !cleanName || !role) {
          return Response.json({ success: false, error: "Semua form wajib diisi lengkap." }, { status: 400 });
        }

        // Cek apakah username sudah ada di tenant tersebut
        let checkQuery = "SELECT id FROM users WHERE username = ? AND tenant_id IS NULL";
        let checkParams: any[] = [cleanUser];

        if (tenantId) {
          checkQuery = "SELECT id FROM users WHERE username = ? AND tenant_id = ?";
          checkParams = [cleanUser, tenantId];
        }

        const existing = await env.DB.prepare(checkQuery).bind(...checkParams).first();
        if (existing) {
          return Response.json({ success: false, error: `Username '${cleanUser}' sudah digunakan pada toko ini.` }, { status: 400 });
        }

        const salt = "posta_salt_2026";
        const passHash = await hashPassword(payload.password, salt);
        const newUserId = "usr_" + Date.now();

        await env.DB.prepare(`
          INSERT INTO users (id, tenant_id, username, password_hash, salt, name, role, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `).bind(newUserId, tenantId, cleanUser, passHash, salt, cleanName, role).run();

        return Response.json({
          success: true,
          message: `User '${cleanName}' (${role}) berhasil ditambahkan!`
        });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // GET /api/admin/impersonate?subdomain=berkah -> Login Instan Superadmin ke Toko Tertentu
    if (url.pathname === "/api/admin/impersonate" && request.method === "GET") {
      try {
        const targetSub = url.searchParams.get("subdomain");
        if (!targetSub) {
          return Response.json({ success: false, error: "Parameter subdomain wajib ada." }, { status: 400 });
        }

        const tenant = await env.DB.prepare(
          "SELECT id, subdomain, name FROM tenants WHERE subdomain = ? AND is_active = 1"
        ).bind(targetSub).first();

        if (!tenant) {
          return Response.json({ success: false, error: "Toko tidak ditemukan." }, { status: 404 });
        }

        // Buat token khusus Superadmin yang diikatkan ke tenant tersebut
        const token = await createJWT({
          id: "superadmin_session",
          tenant_id: tenant.id,
          username: "superadmin",
          name: "Superadmin (" + tenant.name + ")",
          role: "OWNER" // Akses penuh setara owner toko
        });

        return Response.json({
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
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }
  }
};
