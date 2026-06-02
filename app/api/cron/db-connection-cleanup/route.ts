import { NextRequest, NextResponse } from 'next/server';
import { cleanupNoisyDbConnections } from '@/lib/services/db-maintenance.service';

export const runtime = 'nodejs';
export const maxDuration = 60;

function isAuthorizedCronRequest(req: NextRequest): boolean {
  if (req.headers.get('x-vercel-cron')) return true;

  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';

  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-cron-secret')?.trim() || '';
  const querySecret = req.nextUrl.searchParams.get('secret')?.trim() || '';

  return bearer === secret || headerSecret === secret || querySecret === secret;
}

async function runCleanup(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  const longRunningSecondsRaw = Number(
    req.nextUrl.searchParams.get('longRunningSeconds')
    || process.env.DB_CONNECTION_CLEANUP_LONG_RUNNING_SECONDS
    || '60'
  );

  const longRunningSeconds = Number.isFinite(longRunningSecondsRaw) && longRunningSecondsRaw > 0
    ? Math.trunc(longRunningSecondsRaw)
    : 60;

  const summary = await cleanupNoisyDbConnections({ longRunningSeconds });
  return NextResponse.json({ ok: true, summary });
}

export async function GET(req: NextRequest) {
  try {
    return await runCleanup(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'DB connection cleanup failed';
    console.error('DB connection cleanup GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await runCleanup(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'DB connection cleanup failed';
    console.error('DB connection cleanup POST error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}