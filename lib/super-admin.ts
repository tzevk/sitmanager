import { getPool } from '@/lib/db';

type CacheEntry = { value: boolean; expiry: number };

const cache = new Map<number, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

function normalizeRoleTitle(title: unknown): string {
  return String(title ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Returns true if the given role should be treated as "Super Admin".
 *
 * Why: Several parts of the app historically assumed super admin was role id 1.
 * In real data, the role id can differ (e.g. imported DB), so we detect by title.
 */
export async function isSuperAdminRole(roleId: number, pool?: any): Promise<boolean> {
  if (!roleId || Number.isNaN(roleId)) return false;

  // Back-compat: keep role 1 as super admin.
  if (roleId === 1) return true;

  const now = Date.now();
  const cached = cache.get(roleId);
  if (cached && cached.expiry > now) return cached.value;

  const db = pool ?? getPool();

  // role table schema: id, title, `delete`
  // We treat both "Super Admin" and "Administration" as super admin.
  const [rows] = await db.execute('SELECT title FROM role WHERE id = ? LIMIT 1', [roleId]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const title = normalizeRoleTitle((rows as any[])?.[0]?.title);

  const value = title === 'super admin' || title === 'superadmin' || title === 'administration';
  cache.set(roleId, { value, expiry: now + TTL_MS });
  return value;
}

export function invalidateSuperAdminCache(roleId?: number) {
  if (roleId !== undefined) cache.delete(roleId);
  else cache.clear();
}
