import { NextRequest, NextResponse } from 'next/server';
import { syncLegacyBatchData } from '@/lib/services/legacy-batch-sync.service';
import { destroyAllPools } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get('x-vercel-cron')) return true;

  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';

  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-cron-secret')?.trim() || '';
  const querySecret = req.nextUrl.searchParams.get('secret')?.trim() || '';

  return bearer === secret || headerSecret === secret || querySecret === secret;
}

// Temporarily disable the legacy sync for now. Set to false to re-enable.
const LEGACY_SYNC_PAUSED: boolean = true;

async function runSync(req: NextRequest) {
  if (LEGACY_SYNC_PAUSED) {
    return NextResponse.json({ ok: false, disabled: true, message: 'Legacy batch sync temporarily disabled' });
  }

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRunRaw = (req.nextUrl.searchParams.get('dryRun') || '').toLowerCase();
  const dryRun = dryRunRaw === '1' || dryRunRaw === 'true' || dryRunRaw === 'yes';

  const batchSizeRaw = Number(req.nextUrl.searchParams.get('batchSize') || process.env.LEGACY_BATCH_SYNC_BATCH_SIZE || '500');
  const batchSize = Number.isFinite(batchSizeRaw) && batchSizeRaw > 0 ? Math.trunc(batchSizeRaw) : 500;

  const summary = await syncLegacyBatchData({ dryRun, batchSize });

  if (!summary.configured) {
    return NextResponse.json({
      ok: false,
      message: 'OLD_DB_HOST is not configured — legacy batch sync skipped',
    });
  }

  return NextResponse.json({ ok: true, summary });
}

export async function GET(req: NextRequest) {
  try {
    return await runSync(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Legacy batch sync failed';
    console.error('Legacy batch sync GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await destroyAllPools();
  }
}

export async function POST(req: NextRequest) {
  try {
    return await runSync(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Legacy batch sync failed';
    console.error('Legacy batch sync POST error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await destroyAllPools();
  }
}
