import { Env } from "./types";
import { handleGetProducts } from "./routes/products";
import { handleCheckout } from "./routes/checkout";
import { handleSubmitPO } from "./routes/po";
import { handleStockAdjust } from "./routes/stock";
import { handleGetTransactions, handleGetPOHistory } from "./routes/reports";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API Routing
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

    // Static Assets Frontend (public/index.html)
    return env.ASSETS.fetch(request);
  }
};
