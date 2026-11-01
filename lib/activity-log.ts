import type { NextRequest } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbEnv } from '@/lib/env';
import { getSession } from '@/lib/session';

export type ActivityAction = 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'REQUEST' | 'PAGE' | 'CLICK';

interface ActivityLogInput {
  tableName: string;
  action: ActivityAction;
  recordId?: string | number | null;
  details?: unknown;
  /** Who acted, when the request has no session yet (login). */
  actor?: { userId: number | null; userName: string | null };
}

let ensured = false;

declare global {
  var __sitActivityPool: mysql.Pool | undefined;
}

/**
 * One connection per instance, kept apart from the app pool. Logging runs on every
 * write and browser heartbeat (and in the proxy, which would otherwise get a second
 * full pool), so it must never be able to use up MySQL's connections. Rows queue here.
 */
export function getActivityPool(): mysql.Pool {
  if (!global.__sitActivityPool) {
    const env = getDbEnv();
    global.__sitActivityPool = mysql.createPool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      waitForConnections: true,
      connectionLimit: 1,
      maxIdle: 1,
      idleTimeout: 5_000,
      queueLimit: 100,
      connectTimeout: 10_000,
      dateStrings: true,
      ...(process.env.DB_SSL === 'true' && { ssl: { rejectUnauthorized: true } }),
    });
  }
  return global.__sitActivityPool;
}

async function ensureActivityTable() {
  if (ensured) return;
  const pool = getActivityPool();
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_presence (
      user_id INT NOT NULL PRIMARY KEY,
      user_name VARCHAR(255) NULL,
      page VARCHAR(255) NULL,
      last_click VARCHAR(80) NULL,
      last_click_at DATETIME NULL,
      last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_weekly_summary (
      week_start DATE NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(255) NULL,
      action_type VARCHAR(30) NOT NULL,
      events INT NOT NULL,
      PRIMARY KEY (week_start, user_id, action_type)
    )
  `);
  ensured = true;
}

export { ensureActivityTable };

export async function logTableActivity(req: NextRequest, input: ActivityLogInput): Promise<void> {
  try {
    await ensureActivityTable();
    const pool = getActivityPool();
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
