import { NextRequest, NextResponse } from 'next/server';
import { syncSuvidyaInquiries } from '@/lib/services/suvidya-inquiry.service';
import { recordSuvidyaSyncRun } from '@/lib/services/suvidya-sync-run.service';

export const runtime = 'nodejs';
export const maxDuration = 300;

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

async function runSync(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  const sinceHoursRaw = Number(req.nextUrl.searchParams.get('sinceHours') || process.env.SUVIDYA_PUNE_INQUIRY_SYNC_SINCE_HOURS || process.env.SUVIDYA_INQUIRY_SYNC_SINCE_HOURS || '0');
  const maxRecordsRaw = Number(req.nextUrl.searchParams.get('maxRecords') || process.env.SUVIDYA_PUNE_INQUIRY_SYNC_MAX_RECORDS || process.env.SUVIDYA_INQUIRY_SYNC_MAX_RECORDS || '250');

  const sinceHours = Number.isFinite(sinceHoursRaw) && sinceHoursRaw > 0 ? sinceHoursRaw : undefined;
  const maxRecords = Number.isFinite(maxRecordsRaw) && maxRecordsRaw > 0 ? Math.trunc(maxRecordsRaw) : undefined;

  const summary = await syncSuvidyaInquiries({ sinceHours, maxRecords, puneOnly: true });
  await recordSuvidyaSyncRun({ scope: 'pune', status: 'success', summary });
  return NextResponse.json({ ok: true, scope: 'pune', summary });
}

export async function GET(req: NextRequest) {
  try {
    return await runSync(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Suvidya Pune inquiry sync failed';
    await recordSuvidyaSyncRun({ scope: 'pune', status: 'failed', errorMessage: message });
    console.error('Suvidya Pune inquiry sync GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await runSync(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Suvidya Pune inquiry sync failed';
    await recordSuvidyaSyncRun({ scope: 'pune', status: 'failed', errorMessage: message });
    console.error('Suvidya Pune inquiry sync POST error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
