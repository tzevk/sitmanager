import { NextRequest, NextResponse } from 'next/server';
import { syncLegacyInquiries } from '@/lib/services/legacy-inquiry-sync.service';

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

async function runSync(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sinceHoursRaw = Number(
    req.nextUrl.searchParams.get('sinceHours') ||
    process.env.LEGACY_INQUIRY_SYNC_SINCE_HOURS ||
    '48'
  );
  const sinceHours = Number.isFinite(sinceHoursRaw) && sinceHoursRaw > 0 ? sinceHoursRaw : 48;

  const summary = await syncLegacyInquiries({ sinceHours });

  if (!summary.configured) {
    return NextResponse.json({
      ok: false,
      message: 'OLD_DB_HOST is not configured — legacy sync skipped',
    });
  }

  return NextResponse.json({ ok: true, summary });
}

export async function GET(req: NextRequest) {
  try {
    return await runSync(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Legacy inquiry sync failed';
    console.error('Legacy inquiry sync GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await runSync(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Legacy inquiry sync failed';
    console.error('Legacy inquiry sync POST error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
