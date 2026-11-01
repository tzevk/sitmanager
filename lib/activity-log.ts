import type { NextRequest } from 'next/server';
import { getPool } from '@/lib/db';
import { getSession } from '@/lib/session';

export type ActivityAction = 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'REQUEST';

interface ActivityLogInput {
  tableName: string;
  action: ActivityAction;
  recordId?: string | number | null;
  details?: unknown;
  /** Who acted, when the request has no session yet (login). */
  actor?: { userId: number | null; userName: string | null };
}

let ensured = false;

async function ensureActivityTable() {
  if (ensured) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_activity_log (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      table_name VARCHAR(120) NOT NULL,
      action_type VARCHAR(30) NOT NULL,
      record_id VARCHAR(80) NULL,
      user_id INT NULL,
      user_name VARCHAR(255) NULL,
      endpoint VARCHAR(255) NULL,
      details_json LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_activity_created (created_at),
      INDEX idx_activity_table_created (table_name, created_at),
      INDEX idx_activity_user_created (user_id, created_at)
    )
  `);
  ensured = true;
}

export { ensureActivityTable };

export async function logTableActivity(req: NextRequest, input: ActivityLogInput): Promise<void> {
  try {
    await ensureActivityTable();
    const pool = getPool();
    const session = input.actor ? null : await getSession(req);
    const userName = input.actor
      ? input.actor.userName
      : [session?.firstName, session?.lastName].filter(Boolean).join(' ').trim() || null;
    const detailsJson = input.details == null ? null : JSON.stringify(input.details);

    await pool.query(
      `INSERT INTO system_activity_log
       (table_name, action_type, record_id, user_id, user_name, endpoint, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.tableName,
        input.action,
        input.recordId != null ? String(input.recordId) : null,
        input.actor ? input.actor.userId : session?.userId ?? null,
        userName,
        req.nextUrl?.pathname ?? null,
        detailsJson,
      ]
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown logging error';
    console.error('Activity logging failed:', message);
  }
}

/**
 * Records one staff write request (POST/PUT/PATCH/DELETE). Called from the proxy so
 * routes without their own logTableActivity call are still covered. The proxy runs
 * before the route, so this means "submitted", not "succeeded". Bodies and query
 * strings are never stored: they can hold passwords, tokens and personal data.
 */
export async function logRequestActivity(input: {
  method: string;
  pathname: string;
  userId: number | null;
  userName: string | null;
}): Promise<void> {
  try {
    await ensureActivityTable();
    const segments = input.pathname.split('/').filter(Boolean).slice(1);
    const recordId = [...segments].reverse().find((s) => /^\d+$/.test(s)) ?? null;
    const moduleName = segments.filter((s) => !/^\d+$/.test(s)).join('/').slice(0, 120) || 'api';
    await getPool().query(
      `INSERT INTO system_activity_log
       (table_name, action_type, record_id, user_id, user_name, endpoint, details_json)
       VALUES (?, 'REQUEST', ?, ?, ?, ?, ?)`,
      [moduleName, recordId, input.userId, input.userName, input.pathname.slice(0, 255), JSON.stringify({ method: input.method })]
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown logging error';
    console.error('Request activity logging failed:', message);
  }
}
