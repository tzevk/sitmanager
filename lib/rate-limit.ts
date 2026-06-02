/**
 * Rate limiter for API routes.
 *
 * Uses Redis when REDIS_URL is set (distributed, works across all instances).
 * Falls back to in-memory sliding-window counter (per-instance) otherwise.
 */

import { NextRequest, NextResponse } from 'next/server';
import { redis } from './redis';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  maxRequests: number;
  windowSeconds: number;
  scope?: string;
}

// ── In-memory fallback ────────────────────────────────────────────────────────

const stores = new Map<string, Map<string, RateLimitEntry>>();
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [, store] of stores) {
      for (const [key, entry] of store) {
        if (entry.resetAt <= now) store.delete(key);
      }
    }
  }, 60_000);
  if (cleanupInterval && typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
    cleanupInterval.unref();
  }
}

function memCheck(
  ip: string,
  storeKey: string,
  maxRequests: number,
  windowSeconds: number
): { allowed: boolean; remaining: number; resetAt: number } {
  if (!stores.has(storeKey)) stores.set(storeKey, new Map());
  const store = stores.get(storeKey)!;
  ensureCleanup();

  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = store.get(ip);

  if (!entry || entry.resetAt <= now) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  entry.count++;
  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

// ── Redis check (atomic via Lua) ──────────────────────────────────────────────

const LUA_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local current = redis.call('GET', key)
if current == false then
  redis.call('SET', key, 1, 'EX', window)
  return {1, limit - 1, window}
end
current = tonumber(current)
if current >= limit then
  local ttl = redis.call('TTL', key)
  return {0, 0, ttl}
end
redis.call('INCR', key)
local ttl = redis.call('TTL', key)
return {1, limit - current - 1, ttl}
`;

async function redisCheck(
  ip: string,
  storeKey: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  try {
    const key = `rl:${storeKey}:${ip}`;
    const result = await redis!.eval(LUA_SCRIPT, 1, key, String(maxRequests), String(windowSeconds)) as [number, number, number];
    const [allowed, remaining, ttl] = result;
    return {
      allowed: allowed === 1,
      remaining,
      resetAt: Date.now() + ttl * 1000,
    };
  } catch (err) {
    // Redis unavailable (ECONNRESET, timeout, etc.) — fall back to in-memory
    // so login and other routes keep working during Redis outages.
    console.warn('[RateLimit] Redis error, using in-memory fallback:', err instanceof Error ? err.message : String(err));
    return memCheck(ip, storeKey, maxRequests, windowSeconds);
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createRateLimiter(options: RateLimiterOptions) {
  const { maxRequests, windowSeconds, scope } = options;
  const baseStoreKey = `${scope || 'default'}:${maxRequests}:${windowSeconds}`;

  return async function checkRateLimit(request: NextRequest): Promise<NextResponse | null> {
    const ip = getClientIp(request);
    const pathKey = normalizeRateLimitPath(request.nextUrl.pathname);
    const storeKey = `${baseStoreKey}:${pathKey}`;

    const { allowed, resetAt } = redis
      ? await redisCheck(ip, storeKey, maxRequests, windowSeconds)
      : memCheck(ip, storeKey, maxRequests, windowSeconds);

    if (!allowed) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
          },
        }
      );
    }

    return null;
  };
}

function normalizeRateLimitPath(pathname: string): string {
  return pathname
    .toLowerCase()
    .replace(/\/+/g, '/')
    .replace(/[^a-z0-9/_-]/g, '')
    .replace(/\//g, ':') || 'root';
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

// ── Pre-configured limiters ───────────────────────────────────────────────────

export const loginRateLimiter = createRateLimiter({ maxRequests: 5, windowSeconds: 60, scope: 'login' });
export const apiRateLimiter = createRateLimiter({ maxRequests: 100, windowSeconds: 60, scope: 'api' });
export const dashboardRateLimiter = createRateLimiter({ maxRequests: 60, windowSeconds: 60, scope: 'dashboard' });
export const healthRateLimiter = createRateLimiter({ maxRequests: 10, windowSeconds: 60, scope: 'health' });
export const publicFormRateLimiter = createRateLimiter({ maxRequests: 10, windowSeconds: 60, scope: 'public-form' });
export const webhookRateLimiter = createRateLimiter({ maxRequests: 300, windowSeconds: 60, scope: 'webhook' });
