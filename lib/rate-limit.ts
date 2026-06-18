/**
 * Rate limiter for API routes.
 *
 * In-memory sliding-window counter (per-instance). Limits are enforced per
 * running instance rather than globally.
 */

import { NextRequest, NextResponse } from 'next/server';

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

// ── Factory ───────────────────────────────────────────────────────────────────

export function createRateLimiter(options: RateLimiterOptions) {
  const { maxRequests, windowSeconds, scope } = options;
  const baseStoreKey = `${scope || 'default'}:${maxRequests}:${windowSeconds}`;

  return async function checkRateLimit(request: NextRequest): Promise<NextResponse | null> {
    const ip = getClientIp(request);
    const pathKey = normalizeRateLimitPath(request.nextUrl.pathname);
    const storeKey = `${baseStoreKey}:${pathKey}`;

    const { allowed, resetAt } = memCheck(ip, storeKey, maxRequests, windowSeconds);

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
