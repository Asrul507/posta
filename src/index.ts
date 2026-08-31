import { Env, UserPayload } from './types';
import { handleProductsRoutes } from './routes/products';
import { handleCheckoutRoutes } from './routes/checkout';
import { handleStockRoutes } from './routes/stock';
import { handlePORoutes } from './routes/po';
import { handleReportsRoutes } from './routes/reports';
import { handleShiftsRoutes } from './routes/shifts';

const DEFAULT_JWT_SECRET = 'posta-secure-jwt-secret-key-2026';

function getJwtSecret(env: Env): string {
  return env.JWT_SECRET || DEFAULT_JWT_SECRET;
}

// Helper SHA-256
async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Base64Url Helpers
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let output = str.replace(/-/g, '+').replace(/_/g, '/');
  switch (output.length % 4) {
    case 0: break;
    case 2: output += '=='; break;
    case 3: output += '='; break;
    default: throw new Error('Illegal base64url string!');
  }
  return atob(output);
}

// Generate JWT HMAC-SHA256
async function createJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const encodedSignature = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));

  return `${data}.${encodedSignature}`;
}

// Verifikasi JWT
export async function verifyJWT(authHeader: string | null, secret: string): Promise<UserPayload | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = Uint8Array.from(base64UrlDecode(encodedSignature), (c) => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(data));

    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }
    return payload as UserPayload;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. PUBLIC ENDPOINTS
      if (path === '/api/login' && request.method === 'POST') {
        const body = (await request.json()) as { username?: string; password?: string; tenant_id?: string };
        const { username, password } = body;
        const tenant_id = body.tenant_id || 'berkah';

        if (!username || !password) {
          return new Response(JSON.stringify({ error: 'Username dan password wajib diisi' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const passwordHash = await sha256(password + 'posta_salt_2026');
        const user = await env.DB.prepare(
          'SELECT id, tenant_id, username, full_name, role FROM users WHERE username = ? AND password_hash = ? AND tenant_id = ? AND is_active = 1'
        )
          .bind(username, passwordHash, tenant_id)
          .first<{ id: string; tenant_id: string; username: string; full_name: string; role: string }>();

        if (!user) {
          return new Response(JSON.stringify({ error: 'Username atau password salah' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const token = await createJWT(
          {
            id: user.id,
            tenant_id: user.tenant_id,
            username: user.username,
            role: user.role,
            exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
          },
          getJwtSecret(env)
        );

        return new Response(
          JSON.stringify({
            token,
            user: {
              id: user.id,
              tenant_id: user.tenant_id,
              username: user.username,
              full_name: user.full_name,
              role: user.role,
            },
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // 2. PROTECTED ENDPOINTS
      if (path.startsWith('/api/')) {
        const authUser = await verifyJWT(request.headers.get('Authorization'), getJwtSecret(env));

        const protectedPrefixes = ['/api/checkout', '/api/stock', '/api/po', '/api/reports', '/api/shifts', '/api/admin'];
        const isProtected = protectedPrefixes.some((prefix) => path.startsWith(prefix));

        if (isProtected && !authUser) {
          return new Response(JSON.stringify({ error: 'Sesi kedaluwarsa atau tidak terautentikasi. Silakan login kembali.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (path.startsWith('/api/products')) {
          return await (handleProductsRoutes as any)(request, env, corsHeaders, authUser);
        }
        if (path.startsWith('/api/checkout')) {
          return await (handleCheckoutRoutes as any)(request, env, corsHeaders, authUser);
        }
        if (path.startsWith('/api/stock')) {
          return await (handleStockRoutes as any)(request, env, corsHeaders, authUser);
        }
        if (path.startsWith('/api/po')) {
          return await (handlePORoutes as any)(request, env, corsHeaders, authUser);
        }
        if (path.startsWith('/api/reports')) {
          return await (handleReportsRoutes as any)(request, env, corsHeaders, authUser);
        }
        if (path.startsWith('/api/shifts')) {
          return await (handleShiftsRoutes as any)(request, env, corsHeaders, authUser);
        }
      }

      return new Response(JSON.stringify({ error: 'Endpoint tidak ditemukan' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown Server Error';
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  },
};
