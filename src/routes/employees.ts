import { Env, UserPayload } from '../types';

function json(body: unknown, status = 200, corsHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// Urutan tingkatan role di dalam satu toko (tenant). Semakin besar angka,
// semakin tinggi haknya.
const ROLE_RANK: Record<string, number> = { CASHIER: 1, ADMIN: 2, OWNER: 3 };
const ASSIGNABLE_ROLES = ['OWNER', 'ADMIN', 'CASHIER'];

function isPlatformAdmin(role?: string): boolean {
  return role === 'SUPERADMIN' || role === 'DEVELOPER';
}

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function handleEmployeesRoutes(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  authUser: UserPayload
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const tenant_id = authUser.tenant_id;

  if (!tenant_id || tenant_id === 'SUPERADMIN') {
    return json({ success: false, error: 'Akun ini tidak terhubung ke toko manapun.' }, 400, corsHeaders);
  }

  // Superadmin/developer yang sedang mengakses lewat impersonasi toko
  // diperlakukan setara OWNER (akses penuh) selama sesi tersebut.
  const actorRank = isPlatformAdmin(authUser.role) ? ROLE_RANK.OWNER : (ROLE_RANK[authUser.role] || 0);
  const isFullAccess = authUser.role === 'OWNER' || isPlatformAdmin(authUser.role);

  // 1. DAFTAR KARYAWAN TOKO INI
  if (path === '/api/employees' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT id, full_name, username, role, is_active, created_at
       FROM users
       WHERE tenant_id = ?
       ORDER BY CASE role WHEN 'OWNER' THEN 1 WHEN 'ADMIN' THEN 2 WHEN 'CASHIER' THEN 3 ELSE 4 END, full_name`
    )
      .bind(tenant_id)
      .all();

    return json({ success: true, data: results || [] }, 200, corsHeaders);
  }

  // 2. TAMBAH KARYAWAN BARU
  if (path === '/api/employees' && request.method === 'POST') {
    const body = (await request.json()) as {
      full_name?: string;
      username?: string;
      password?: string;
      role?: string;
    };

    const full_name = body.full_name?.trim();
    const username = body.username?.trim();
    const password = body.password;
    const role = body.role;

    if (!full_name || !username || !password || !role) {
      return json({ success: false, error: 'Nama, username, password, dan role wajib diisi.' }, 400, corsHeaders);
    }
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return json({ success: false, error: 'Role tidak valid.' }, 400, corsHeaders);
    }
    // ADMIN hanya boleh membuat karyawan dengan role di bawahnya (CASHIER).
    // OWNER (& superadmin yang impersonate) boleh membuat semua role di toko ini.
    if (!isFullAccess && ROLE_RANK[role] >= actorRank) {
      return json(
        { success: false, error: 'Anda hanya bisa menambahkan karyawan dengan role di bawah Anda.' },
        403,
        corsHeaders
      );
    }

    const existing = await env.DB.prepare('SELECT id FROM users WHERE tenant_id = ? AND username = ?')
      .bind(tenant_id, username)
      .first();
    if (existing) {
      return json({ success: false, error: 'Username sudah digunakan di toko ini.' }, 409, corsHeaders);
    }

    const passwordHash = await sha256(password + 'posta_salt_2026');
    const id = crypto.randomUUID();

    await env.DB.prepare(
      'INSERT INTO users (id, tenant_id, full_name, username, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)'
    )
      .bind(id, tenant_id, full_name, username, passwordHash, role)
      .run();

    return json({ success: true, message: 'Karyawan berhasil ditambahkan.' }, 201, corsHeaders);
  }

  // 3. UBAH DATA KARYAWAN: /api/employees/:id
  const editMatch = path.match(/^\/api\/employees\/([^/]+)$/);
  if (editMatch && request.method === 'PUT') {
    const targetId = editMatch[1];

    const target = await env.DB.prepare('SELECT id, role FROM users WHERE id = ? AND tenant_id = ?')
      .bind(targetId, tenant_id)
      .first<{ id: string; role: string }>();

    if (!target) {
      return json({ success: false, error: 'Karyawan tidak ditemukan.' }, 404, corsHeaders);
    }

    const targetRank = ROLE_RANK[target.role] || 0;
    // ADMIN hanya boleh mengubah data karyawan dengan role di bawahnya (CASHIER),
    // tidak boleh mengubah sesama ADMIN maupun OWNER.
    // OWNER (& superadmin impersonate) boleh mengubah semua karyawan di toko ini.
    if (!isFullAccess && targetRank >= actorRank) {
      return json(
        { success: false, error: 'Anda hanya bisa mengubah data karyawan dengan role di bawah Anda.' },
        403,
        corsHeaders
      );
    }

    const body = (await request.json()) as {
      full_name?: string;
      username?: string;
      password?: string;
      role?: string;
      is_active?: number | boolean;
    };

    const updates: string[] = [];
    const binds: unknown[] = [];

    if (body.full_name?.trim()) {
      updates.push('full_name = ?');
      binds.push(body.full_name.trim());
    }
    if (body.username?.trim()) {
      updates.push('username = ?');
      binds.push(body.username.trim());
    }
    if (body.password) {
      updates.push('password_hash = ?');
      binds.push(await sha256(body.password + 'posta_salt_2026'));
    }
    if (body.role) {
      if (!ASSIGNABLE_ROLES.includes(body.role)) {
        return json({ success: false, error: 'Role tidak valid.' }, 400, corsHeaders);
      }
      if (!isFullAccess && ROLE_RANK[body.role] >= actorRank) {
        return json(
          { success: false, error: 'Anda tidak bisa menaikkan role karyawan ke level tersebut.' },
          403,
          corsHeaders
        );
      }
      updates.push('role = ?');
      binds.push(body.role);
    }
    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      binds.push(body.is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return json({ success: false, error: 'Tidak ada perubahan data yang dikirim.' }, 400, corsHeaders);
    }

    updates.push("updated_at = datetime('now')");
    binds.push(targetId, tenant_id);

    try {
      await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`)
        .bind(...binds)
        .run();
    } catch (e) {
      return json({ success: false, error: 'Username sudah digunakan atau data tidak valid.' }, 409, corsHeaders);
    }

    return json({ success: true, message: 'Data karyawan berhasil diperbarui.' }, 200, corsHeaders);
  }

  return json({ success: false, error: 'Endpoint karyawan tidak ditemukan.' }, 404, corsHeaders);
}
