import mysql from 'mysql2/promise';
import { getDbEnv } from '@/lib/env';

// Global pool reference for connection reuse across serverless invocations
let pool: mysql.Pool | null = null;

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
      // Serverless: fewer connections, shorter timeouts
      connectionLimit: isServerless ? 5 : 20,
      maxIdle: isServerless ? 2 : 10,
      idleTimeout: isServerless ? 10000 : 60000, // 10s for serverless
      queueLimit: 0,
      enableKeepAlive: !isServerless, // Disable keep-alive in serverless
      keepAliveInitialDelay: 30000,
      connectTimeout: isServerless ? 5000 : 10000, // Faster timeout for serverless
      namedPlaceholders: true,
      // Ensure connections are released properly
      dateStrings: true,
    });
  }
  return pool;
}

/**
 * Execute a query with automatic connection management
 * Ensures connections are properly released back to pool
 */
export async function query<T>(
  sql: string,
  params?: (string | number | null | boolean)[]
): Promise<T[]> {
  const p = getPool();
  const [rows] = await p.query<mysql.RowDataPacket[]>(sql, params);
  return rows as T[];
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
  const data = await fetcher();
  cache.set(key, { data, expiry: now + ttl });
  return data;
}

/** Invalidate one key or all keys matching a prefix */
export function invalidateCache(keyOrPrefix?: string) {
  if (!keyOrPrefix) {
    cache.clear();
    return;
  }
  for (const k of cache.keys()) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix + ':')) {
      cache.delete(k);
    }
  }
}