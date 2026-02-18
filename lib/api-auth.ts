/**
 * API Authentication & Permission Middleware
 * 
 * Provides a clean wrapper for API routes that handles:
 * 1. Session validation (auth check)
 * 2. Permission checking (RBAC)
 * 3. Caching of role permissions (avoids DB hit per request)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, SessionData } from '@/lib/session';
import { getPool } from '@/lib/db';
import { ALL_PERMISSIONS } from '@/lib/rbac';

// ── Cache role permissions in-memory (per serverless instance) ──────
interface PermissionCacheEntry {
  permissions: string[];
  expiry: number;
}

const permissionCache = new Map<number, PermissionCacheEntry>();
const PERMISSION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get permissions for a role, with in-memory caching
 */
async function getRolePermissions(roleId: number): Promise<string[]> {
  // Super admin (role 1) gets all permissions
  if (roleId === 1) {
    return ALL_PERMISSIONS.map(p => p.id);
  }

  const now = Date.now();
  const cached = permissionCache.get(roleId);
  if (cached && cached.expiry > now) {
    return cached.permissions;
  }

  const pool = getPool();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows] = await pool.execute<any[]>(
    'SELECT permission_id FROM role_permissions WHERE role_id = ?',
    [roleId]
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const permissions = (rows as any[]).map((r: any) => r.permission_id);
  permissionCache.set(roleId, { permissions, expiry: now + PERMISSION_CACHE_TTL });
  return permissions;
}

/** Invalidate cached permissions for a specific role or all roles */
export function invalidatePermissionCache(roleId?: number) {
  if (roleId !== undefined) {
    permissionCache.delete(roleId);
  } else {
    permissionCache.clear();
  }
}

// ── Auth result types ───────────────────────────────────────────────

export interface AuthenticatedRequest {
  session: SessionData;
  permissions: string[];
}

// ── Main helpers ────────────────────────────────────────────────────

/**
 * Require authentication only. Returns session or 401 response.
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthenticatedRequest | NextResponse> {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Please login to continue' },
      { status: 401 }
    );
  }

  try {
    const permissions = await getRolePermissions(session.role);
    return { session, permissions };
  } catch (err) {
    console.error('Failed to load permissions for role', session.role, err);
    // Return empty permissions rather than crashing — route can still check auth
    return { session, permissions: [] };
  }
}

/**
 * Require authentication + specific permission(s).
 * Pass a single permission string or array of permissions (any match = allowed).
 */
export async function requirePermission(
  request: NextRequest,
  required: string | string[]
): Promise<AuthenticatedRequest | NextResponse> {
  const result = await requireAuth(request);
  if (result instanceof NextResponse) return result;

  const { permissions } = result;
  const requiredArr = Array.isArray(required) ? required : [required];

  // Check if user has ANY of the required permissions
  const hasAccess = requiredArr.some(p => permissions.includes(p));
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'You do not have permission to perform this action' },
      { status: 403 }
    );
  }

  return result;
}

// ── Response helpers ────────────────────────────────────────────────

/** Standard success response with cache headers */
export function jsonResponse(data: unknown, cacheSeconds = 0) {
  const headers: Record<string, string> = {};
  if (cacheSeconds > 0) {
    headers['Cache-Control'] = `s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`;
  } else {
    headers['Cache-Control'] = 'no-store';
  }
  return NextResponse.json(data, { headers });
}
