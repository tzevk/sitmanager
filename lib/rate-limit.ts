/**
 * In-memory rate limiter for API routes.
 *
 * Uses a sliding-window counter per IP. Works well for single-instance
 * deployments and provides basic protection in serverless (per-instance).
 * For distributed rate limiting at scale, consider Upstash Redis or similar.
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

// Periodic cleanup to prevent memory leaks (every 60 seconds)
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [, store] of stores) {
      for (const [key, entry] of store) {
        if (entry.resetAt <= now) {
          store.delete(key);
        }
      }
    }
  }, 60_000);
  // Allow process to exit cleanly
  if (cleanupInterval && typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
    cleanupInterval.unref();
  }
}

/**
 * Create a rate limiter instance.
 *
 * @example
 * const loginLimiter = createRateLimiter({ maxRequests: 5, windowSeconds: 60 });
 *
 * export async function POST(req: NextRequest) {
 *   const blocked = loginLimiter(req);
 *   if (blocked) return blocked;
 *   // ... handle request
 * }
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { maxRequests, windowSeconds } = options;
  const storeKey = `${maxRequests}:${windowSeconds}`;

  if (!stores.has(storeKey)) {
    stores.set(storeKey, new Map());
  }
  const store = stores.get(storeKey)!;
  ensureCleanup();

  /**
   * Check rate limit for a request. Returns null if allowed,
   * or a 429 NextResponse if rate-limited.
   */
  return function checkRateLimit(request: NextRequest): NextResponse | null {
    const ip = getClientIp(request);
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    const entry = store.get(ip);

    if (!entry || entry.resetAt <= now) {
      // New window
      store.set(ip, { count: 1, resetAt: now + windowMs });
      return null;
    }

    entry.count++;

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
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
            'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
          },
        }
      );
    }

    return null;
  };
}

/**
 * Extract client IP from request, handling proxies/load balancers.
 */
function getClientIp(request: NextRequest): string {
  // Vercel/Cloudflare set these headers
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; leftmost is the client
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  // Fallback
  return '127.0.0.1';
}

// ── Pre-configured limiters for common use cases ──────────────────

/** Strict limiter for authentication endpoints: 5 attempts per 60 seconds */
export const loginRateLimiter = createRateLimiter({
  maxRequests: 5,
  windowSeconds: 60,
});

/** General API limiter: 100 requests per 60 seconds */
export const apiRateLimiter = createRateLimiter({
  maxRequests: 100,
  windowSeconds: 60,
});

/** Health check limiter: 10 requests per 60 seconds */
export const healthRateLimiter = createRateLimiter({
  maxRequests: 10,
  windowSeconds: 60,
});
