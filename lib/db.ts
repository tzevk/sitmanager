import mysql from 'mysql2/promise';
import { getDbEnv } from '@/lib/env';

declare global {
  // eslint-disable-next-line no-var
  var __sitDbPool: mysql.Pool | undefined;
}

let pool: mysql.Pool | null = global.__sitDbPool ?? null;

export function getPool(): mysql.Pool {
  if (!pool) {
    const env = getDbEnv();
    pool = mysql.createPool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      waitForConnections: true,
      // 1 connection per process — never opens more than one physical TCP
      // connection, keeping MySQL max_user_connections as low as possible.
      connectionLimit: 1,
      // Close connections immediately after release so MySQL sees 0 open
      // connections from this process while it is idle between requests.
      maxIdle: 0,
      queueLimit: 0,
      connectTimeout: 30_000,
      namedPlaceholders: true,
      dateStrings: true,
      ...(process.env.DB_SSL === 'true' && { ssl: { rejectUnauthorized: true } }),
    });

    pool.on('connection', (conn) => {
      conn.on('error', (err) => {
        console.error('[DB] connection error:', err.code);
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
          console.warn('[DB] connection lost — pool will create a new one');
        }
      });
    });

    global.__sitDbPool = pool;

    const cleanup = () => { destroyPool().catch(() => {}); };
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
    process.once('beforeExit', cleanup);
  }
  return pool;
}

export async function destroyPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    global.__sitDbPool = undefined;
  }
}

// ── query / queryOne helpers ──────────────────────────────────────────────────

export async function query<T>(
  sql: string,
  params?: (string | number | null | boolean)[]
): Promise<T[]> {
  try {
    const [rows] = await getPool().query<mysql.RowDataPacket[]>(sql, params);
    return rows as T[];
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code && ['ETIMEDOUT', 'ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'PROTOCOL_SEQUENCE_TIMEOUT'].includes(code)) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const [rows] = await getPool().query<mysql.RowDataPacket[]>(sql, params);
      return rows as T[];
    }
    const message = err instanceof Error ? err.message : 'Unknown DB error';
    console.error('DB query error:', message);
    throw new Error('Database query failed');
  }
}

export async function queryOne<T>(
  sql: string,
  params?: (string | number | null | boolean)[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] || null;
}

// ── In-memory cache with TTL ──────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiry > now) return hit.data;

  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) return running;

  const p = (async () => {
    const data = await fetcher();
    cache.set(key, { data, expiry: Date.now() + ttl });
    return data;
  })();

  inFlight.set(key, p);
  try {
    return await p;
  } finally {
    inFlight.delete(key);
  }
}

export function invalidateCache(keyOrPrefix?: string) {
  if (!keyOrPrefix) {
    cache.clear();
    inFlight.clear();
    return;
  }
  for (const k of cache.keys()) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix + ':')) cache.delete(k);
  }
  for (const k of inFlight.keys()) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix + ':')) inFlight.delete(k);
  }
}
