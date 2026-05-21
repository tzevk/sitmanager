import mysql from 'mysql2/promise';
import { getDbEnv } from '@/lib/env';

declare global {
  // eslint-disable-next-line no-var
  var __sitDbPool: mysql.Pool | undefined;
}

// Global pool reference reused across hot reloads/process modules
let pool: mysql.Pool | null = global.__sitDbPool ?? null;

// Detect if running on Vercel (serverless)
const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

export function getPool(): mysql.Pool {
  if (!pool) {
    const env = getDbEnv(); // validates DB vars only, not JWT_SECRET
    pool = mysql.createPool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      waitForConnections: true,
      // Keep well under the server's max_user_connections limit for sitadmin.
      connectionLimit: isServerless ? 4 : 5,
      maxIdle: isServerless ? 2 : 3,
      idleTimeout: isServerless ? 10000 : 30000, // 30s for dev, 10s for serverless
      // Do not reject queued requests under load; allow waiting for free connection.
      queueLimit: 0,
      enableKeepAlive: !isServerless, // Disable keep-alive in serverless
      keepAliveInitialDelay: 30000,
      connectTimeout: isServerless ? 20000 : 60000,
      namedPlaceholders: true,
      dateStrings: true,
      // SECURITY: Enable SSL/TLS when DB_SSL=true (set in env for SSL-capable servers)
      ...(process.env.DB_SSL === 'true' && {
        ssl: {
          rejectUnauthorized: true,
        },
      }),
    });

    // Handle pool errors to prevent unhandled rejections
    pool.on('connection', (connection) => {
      connection.on('error', (err) => {
        console.error('DB connection error:', err.code);
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
          // Connection will be removed from pool automatically
          console.warn('Database connection lost. Pool will create a new one.');
        }
      });
    });

    global.__sitDbPool = pool;
  }
  return pool;
}

/**
 * Gracefully close the connection pool.
 * Call during shutdown / hot-reload to prevent connection leaks.
 */
export async function destroyPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    global.__sitDbPool = undefined;
  }
}

/**
 * Execute a query with automatic connection management.
 * Uses parameterized queries to prevent SQL injection.
 * Ensures connections are properly released back to pool.
 */
export async function query<T>(
  sql: string,
  params?: (string | number | null | boolean)[]
): Promise<T[]> {
  const p = getPool();
  try {
    const [rows] = await p.query<mysql.RowDataPacket[]>(sql, params);
    return rows as T[];
  } catch (err: unknown) {
    // Retry once for transient network/connection timeouts.
    const code = (err as { code?: string } | null)?.code;
    if (code && ['ETIMEDOUT', 'ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'PROTOCOL_SEQUENCE_TIMEOUT'].includes(code)) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const [rows] = await p.query<mysql.RowDataPacket[]>(sql, params);
      return rows as T[];
    }

    // Log DB errors server-side, but don't expose details to callers
    const message = err instanceof Error ? err.message : 'Unknown DB error';
    console.error('DB query error:', message);
    throw new Error('Database query failed');
  }
}

/**
 * Execute a single query and return first row or null
 */
export async function queryOne<T>(
  sql: string,
  params?: (string | number | null | boolean)[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] || null;
}

// ── In-memory cache with TTL ──────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Get-or-set cache. Returns cached value if still valid, otherwise
 * calls `fetcher`, stores the result, and returns it.
 *
 * @param key   Unique cache key
 * @param ttl   Time-to-live in milliseconds
 * @param fetcher Async function that produces the value
 */
export async function cached<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiry > now) {
    return hit.data;
  }

  // Coalesce concurrent misses for the same key into one fetch.
  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) {
    return running;
  }

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

/** Invalidate one key or all keys matching a prefix */
export function invalidateCache(keyOrPrefix?: string) {
  if (!keyOrPrefix) {
    cache.clear();
    inFlight.clear();
    return;
  }
  for (const k of cache.keys()) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix + ':')) {
      cache.delete(k);
    }
  }
  for (const k of inFlight.keys()) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix + ':')) {
      inFlight.delete(k);
    }
  }
}