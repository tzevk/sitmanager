import mysql from 'mysql2/promise';
import { getOldDbEnv } from '@/lib/env';

let oldPool: mysql.Pool | null = null;

const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

const READ_ONLY_SQL_RE = /^(with|select|show|describe|desc|explain)\b/i;
const LEADING_SQL_COMMENTS_RE = /^(?:\s|\/\*[\s\S]*?\*\/|--[^\n]*\n|#[^\n]*\n)*/;

function isReadOnlySql(sql: string): boolean {
  const normalized = sql.replace(LEADING_SQL_COMMENTS_RE, '').trim();
  if (!normalized) return false;
  return READ_ONLY_SQL_RE.test(normalized);
}

function assertReadOnlyQuery(sql: unknown): void {
  const queryText = typeof sql === 'string'
    ? sql
    : (sql && typeof sql === 'object' && 'sql' in sql && typeof (sql as { sql: unknown }).sql === 'string'
      ? (sql as { sql: string }).sql
      : '');

  if (!isReadOnlySql(queryText)) {
    throw new Error('Blocked non-read query on OLD DB. OLD DB is configured as read-only.');
  }
}

export function getOldPool(): mysql.Pool {
  if (!oldPool) {
    const env = getOldDbEnv();
    const configuredLimit = parseInt(process.env.OLD_DB_CONNECTION_LIMIT || '', 10);
    const connectionLimit = Number.isFinite(configuredLimit) && configuredLimit > 0
      ? configuredLimit
      : (isServerless ? 5 : 20);
    oldPool = mysql.createPool({
      host: env.OLD_DB_HOST,
      port: env.OLD_DB_PORT,
      database: env.OLD_DB_NAME,
      user: env.OLD_DB_USER,
      password: env.OLD_DB_PASSWORD,
      waitForConnections: true,
      connectionLimit,
      maxIdle: isServerless ? 2 : 10,
      idleTimeout: isServerless ? 10000 : 60000,
      queueLimit: 0,
      enableKeepAlive: !isServerless,
      keepAliveInitialDelay: 30000,
      connectTimeout: isServerless ? 10000 : 30000,
      namedPlaceholders: true,
      dateStrings: true,
      ...(process.env.OLD_DB_SSL === 'true' && {
        ssl: {
          rejectUnauthorized: true,
        },
      }),
    });

    oldPool.on('connection', (connection) => {
      connection.on('error', (err) => {
        console.error('OLD DB connection error:', err.code);
      });
    });

    const baseQuery = oldPool.query.bind(oldPool);
    oldPool.query = ((sql: unknown, values?: unknown) => {
      assertReadOnlyQuery(sql);
      return baseQuery(sql as never, values as never);
    }) as typeof oldPool.query;

    const baseExecute = oldPool.execute.bind(oldPool);
    oldPool.execute = ((sql: string, values?: unknown) => {
      assertReadOnlyQuery(sql);
      return baseExecute(sql as never, values as never);
    }) as typeof oldPool.execute;
  }
  return oldPool;
}

export async function destroyOldPool(): Promise<void> {
  if (oldPool) {
    await oldPool.end();
    oldPool = null;
  }
}
