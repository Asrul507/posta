import { Env } from "./types";
import { handleGetProducts } from "./routes/products";
import { handleCheckout } from "./routes/checkout";
import { handleSubmitPO } from "./routes/po";
import { handleStockAdjust } from "./routes/stock";
import { handleGetTransactions, handleGetPOHistory } from "./routes/reports";

function extractSubdomain(hostname: string): string {
  const host = hostname.toLowerCase().split(':')[0];

  // Jika domain persis posta.gpro.my.id -> mode Superadmin
  if (host === "posta.gpro.my.id") {
    return "posta";
  }

  // Jika subdomain lain (misal: berkah.gpro.my.id)
  if (host.endsWith(".gpro.my.id")) {
    const parts = host.replace(".gpro.my.id", "").split(".");
    if (parts.length > 0 && parts[0] !== "" && parts[0] !== "www") {
      return parts[0];
    }
  }

  // Fallback lokal / dev
  return "posta";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const currentSubdomain = extractSubdomain(url.hostname);

    // =========================================================================
    // 1. ENDPOINT KHUSUS DEVELOPER / SUPERADMIN (posta.gpro.my.id)
    // =========================================================================
    
    // Ambil semua daftar tenant / toko
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

    // Tambah Toko / Tenant Baru
    if (url.pathname === "/api/admin/tenants" && request.method === "POST") {
      try {
        const payload: {
          subdomain: string;
          name: string;
          address?: string;
          phone?: string;
        } = await request.json();

        const cleanSubdomain = payload.subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (!cleanSubdomain || !payload.name) {
          return Response.json({ success: false, error: "Subdomain dan Nama Toko wajib diisi" }, { status: 400 });
        }

        // Cek apakah subdomain sudah terpakai
        const existing = await env.DB.prepare("SELECT id FROM tenants WHERE subdomain = ?")
          .bind(cleanSubdomain)
          .first();

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
          subdomain: cleanSubdomain,
          url: `https://${cleanSubdomain}.gpro.my.id`
        });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // =========================================================================
    // 2. ENDPOINT INFORMASI TOKO (TENANT SESSION)
    // =========================================================================
    if (url.pathname === "/api/tenant/info" && request.method === "GET") {
      try {
        // Jika sedang di domain utama developer
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
            { success: false, error: `Toko '${currentSubdomain}' tidak terdaftar atau sedang nonaktif.` },
            { status: 404 }
          );
        }

        return Response.json({ success: true, is_admin: false, data: tenant });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // =========================================================================
    // 3. API OPERASIONAL KASIR
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

    // 4. Static Assets Frontend
    return env.ASSETS.fetch(request);
  }
};
