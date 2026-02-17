import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { checkEnv } from '@/lib/env';

/**
 * GET /api/health
 * Quick health check for monitoring — tests env vars + DB connectivity.
 * Public endpoint (no auth required).
 */
export async function GET() {
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
      ...(env.missing.length > 0 && { missingEnv: env.missing }),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
      region: process.env.VERCEL_REGION || 'local',
    },
    { status: healthy ? 200 : 503 }
  );
}
