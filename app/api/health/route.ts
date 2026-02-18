import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { checkEnv } from '@/lib/env';
import { healthRateLimiter } from '@/lib/rate-limit';

/**
 * GET /api/health
 * Quick health check for monitoring — tests env vars + DB connectivity.
 * Public endpoint (no auth required) but rate-limited.
 * SECURITY: Does not expose internal details (env var names, stack traces).
 */
export async function GET(request: NextRequest) {
  // Rate limit health checks to prevent abuse
  const rateLimited = healthRateLimiter(request);
  if (rateLimited) return rateLimited;

  const start = Date.now();

  // 1. Environment check
  const env = checkEnv();

  // 2. Database connectivity check
  let dbOk = false;
  let dbLatency = 0;
  try {
    const dbStart = Date.now();
    const pool = getPool();
    await pool.query('SELECT 1');
    dbLatency = Date.now() - dbStart;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const healthy = env.ok && dbOk;

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      latency: {
        total: Date.now() - start,
        db: dbOk ? dbLatency : null,
      },
      checks: {
        env: env.ok ? 'pass' : 'fail',
        database: dbOk ? 'pass' : 'fail',
      },
      // SECURITY: Never expose missing env var names or internal details publicly
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
    },
    { status: healthy ? 200 : 503 }
  );
}
