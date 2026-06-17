import mysql from 'mysql2/promise';
import { getDbEnv } from '@/lib/env';
import { cache as sharedCache } from '@/lib/cache';

declare global {
  var __sitDbPool: mysql.Pool | undefined;
  var __sitLegacyDbPool: mysql.Pool | undefined;
}

let pool: mysql.Pool | null = global.__sitDbPool ?? null;
let legacyPool: mysql.Pool | null = global.__sitLegacyDbPool ?? null;
let cleanupRegistered = false;

function registerPoolCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  const cleanup = () => {
    destroyAllPools().catch(() => {});
  };

  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);
  process.once('beforeExit', cleanup);
}

function isPoolClosed(p: mysql.Pool): boolean {
  return (p as unknown as { pool?: { _closed?: boolean } }).pool?._closed === true;
}

export function getPool(): mysql.Pool {
  if (pool && isPoolClosed(pool)) {
    pool = null;
    global.__sitDbPool = undefined;
  }
  if (!pool) {
    const env = getDbEnv();
    pool = mysql.createPool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 2,
      idleTimeout: 10_000,
      queueLimit: 0,
      connectTimeout: 30_000,
      namedPlaceholders: true,
      dateStrings: true,
      ...(process.env.DB_SSL === 'true' && { ssl: { rejectUnauthorized: true } }),
    });

    pool.on('connection', (conn) => {
      conn.on('error', (err) => {
        const expected = ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'ETIMEDOUT', 'PROTOCOL_SEQUENCE_TIMEOUT'];
        if (!expected.includes(err.code)) {
          console.error('[DB] connection error:', err.code);
        }
      });
    });

    global.__sitDbPool = pool;
    registerPoolCleanup();
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

export async function destroyLegacyPool(): Promise<void> {
  if (legacyPool) {
    await legacyPool.end();
    legacyPool = null;
    global.__sitLegacyDbPool = undefined;
  }
}

export async function destroyAllPools(): Promise<void> {
  await Promise.allSettled([
    destroyPool(),
    destroyLegacyPool(),
  ]);
}

/**
 * Returns a pool connected to the legacy (OLD_DB_*) database.
 * Returns null if the legacy DB is not configured.
 */
export function getLegacyPool(): mysql.Pool | null {
  const host = process.env.OLD_DB_HOST?.trim();
  if (!host) return null;

  if (!legacyPool) {
    legacyPool = mysql.createPool({
      host,
      port: parseInt(process.env.OLD_DB_PORT || '3306', 10),
      database: process.env.OLD_DB_NAME || '',
      user: process.env.OLD_DB_USER || '',
      password: process.env.OLD_DB_PASSWORD || '',
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 1,
      idleTimeout: 10_000,
      queueLimit: 0,
      connectTimeout: 30_000,
      dateStrings: true,
    });

    legacyPool.on('connection', (conn) => {
      conn.on('error', (err) => {
        const expected = ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'ETIMEDOUT'];
        if (!expected.includes(err.code)) {
          console.error('[Legacy DB] connection error:', err.code);
        }
      });
    });

    global.__sitLegacyDbPool = legacyPool;
    registerPoolCleanup();
  }

  return legacyPool;
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
    const message = err instanceof Error ? err.message : 'Unknown DB error';
    const isRetryable = (code && ['ETIMEDOUT', 'ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'PROTOCOL_SEQUENCE_TIMEOUT'].includes(code))
      || message.includes('Pool is closed');
    if (isRetryable) {
      if (message.includes('Pool is closed')) {
        pool = null;
        global.__sitDbPool = undefined;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      const [rows] = await getPool().query<mysql.RowDataPacket[]>(sql, params);
      return rows as T[];
    }
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

// ── Shared cache helpers (Redis-backed when REDIS_URL is configured) ────────

const inFlight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const hit = await sharedCache.get<T>(key);
  if (hit !== null) return hit;

  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) return running;

  const p = (async () => {
    const data = await fetcher();
    await sharedCache.set(key, data, ttl);
    return data;
  })();

  inFlight.set(key, p);
  try {
    return await p;
  } finally {
    inFlight.delete(key);
  }
}

export async function cachedWithMeta<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T; cacheStatus: 'HIT' | 'MISS' }> {
  const hit = await sharedCache.get<T>(key);
  if (hit !== null) {
    return { data: hit, cacheStatus: 'HIT' };
  }

  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) {
    return { data: await running, cacheStatus: 'MISS' };
  }

  const p = (async () => {
    const data = await fetcher();
    await sharedCache.set(key, data, ttl);
    return data;
  })();

  inFlight.set(key, p);
  try {
    return { data: await p, cacheStatus: 'MISS' };
  } finally {
    inFlight.delete(key);
  }
}

export function invalidateCache(keyOrPrefix?: string) {
  if (!keyOrPrefix) {
    void sharedCache.clear();
    inFlight.clear();
    return;
  }
  void sharedCache.delete(keyOrPrefix);
  void sharedCache.deleteByPrefix(keyOrPrefix);
  for (const k of inFlight.keys()) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix + ':')) inFlight.delete(k);
  }
}
