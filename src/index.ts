import { Env } from "./types";
import { handleGetProducts } from "./routes/products";
import { handleCheckout } from "./routes/checkout";
import { handleSubmitPO } from "./routes/po";
import { handleStockAdjust } from "./routes/stock";
import { handleGetTransactions, handleGetPOHistory } from "./routes/reports";

// =========================================================================
    // POST /api/auth/login (Handler Login)
    // =========================================================================
    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      try {
        const { username, password } = await request.json() as any;
        if (!username || !password) {
          return Response.json({ success: false, error: "Username dan password wajib diisi" }, { status: 400 });
        }

        let user: any = null;
        if (currentSubdomain === "posta") {
          // Login Superadmin
          user = await env.DB.prepare(
            "SELECT * FROM users WHERE username = ? AND role = 'SUPERADMIN' AND is_active = 1"
          ).bind(username.trim().toLowerCase()).first();
        } else {
          // Login Toko / Tenant
          const tenant = await env.DB.prepare(
            "SELECT id FROM tenants WHERE subdomain = ? AND is_active = 1"
          ).bind(currentSubdomain).first();

          if (!tenant) {
            return Response.json({ success: false, error: "Toko tidak terdaftar atau nonaktif." }, { status: 404 });
          }

          user = await env.DB.prepare(
            "SELECT * FROM users WHERE username = ? AND tenant_id = ? AND is_active = 1"
          ).bind(username.trim().toLowerCase(), tenant.id).first();
        }

        if (!user) {
          return Response.json({ success: false, error: "Username atau password salah." }, { status: 401 });
        }

        const inputHash = await hashPassword(password, user.salt || "posta_salt_2026");
        if (inputHash !== user.password_hash) {
          return Response.json({ success: false, error: "Username atau password salah." }, { status: 401 });
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

function extractSubdomain(hostname: string): string {
  const host = hostname.toLowerCase().split(':')[0]; // hapus port

  // Domain Superadmin / Developer
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

    // 1. Endpoint Info Tenant Aktif / Cek Superadmin
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

    // 2. Endpoint Khusus Developer (List & Buat Toko)
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

        return Response.json({
          success: true,
          message: `Toko '${payload.name}' berhasil dibuat!`,
          subdomain: cleanSubdomain
        });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // 3. API Operasional Kasir
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

    // 4. Static Assets Frontend
    return env.ASSETS.fetch(request);
  }
};
