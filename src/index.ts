import { Env } from "./types";
import { handleGetProducts } from "./routes/products";
import { handleCheckout } from "./routes/checkout";
import { handleSubmitPO } from "./routes/po";
import { handleStockAdjust } from "./routes/stock";
import { handleGetTransactions, handleGetPOHistory } from "./routes/reports";

// Helper untuk mengekstrak subdomain dari URL
function extractSubdomain(hostname: string): string {
  // Contoh: berkah.gpro.my.id -> 'berkah'
  // Jika akses via localhost / IP / root domain -> fallback default 'berkah'
  const host = hostname.toLowerCase().split(':')[0]; // hapus port jika ada

  if (host.endsWith("gpro.my.id")) {
    const parts = host.replace(".gpro.my.id", "").split(".");
    if (parts.length > 0 && parts[0] !== "" && parts[0] !== "www") {
      return parts[0];
    }
  }

  // Fallback untuk pengujian lokal (localhost/127.0.0.1)
  return "berkah";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const currentSubdomain = extractSubdomain(url.hostname);

    // 1. Endpoint Info Tenant Aktif (berdasarkan Subdomain)
    if (url.pathname === "/api/tenant/info" && request.method === "GET") {
      try {
        const tenant = await env.DB.prepare(
          "SELECT id, subdomain, name, address, phone FROM tenants WHERE subdomain = ? AND is_active = 1"
        ).bind(currentSubdomain).first();

        if (!tenant) {
          return Response.json(
            { success: false, error: `Toko dengan subdomain '${currentSubdomain}' tidak ditemukan atau nonaktif.` },
            { status: 404 }
          );
        }

        return Response.json({ success: true, data: tenant });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // 2. API Routing Utama (Otomatis sisipkan tenant_id jika belum ada di searchParams)
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

    // 3. Static Assets Frontend (public/index.html)
    return env.ASSETS.fetch(request);
  }
};
