import { NextRequest, NextResponse } from 'next/server';
import { syncLiveMetaLeadsToDb } from '@/lib/services/meta-ads.service';

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-cron-secret')?.trim() || '';
  const querySecret = req.nextUrl.searchParams.get('secret')?.trim() || '';

  return bearer === secret || headerSecret === secret || querySecret === secret;
}

async function runRefresh(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  const sinceHoursRaw = Number(req.nextUrl.searchParams.get('sinceHours') || '6');
  const maxPagesRaw = Number(req.nextUrl.searchParams.get('maxPagesPerForm') || '3');
  const sinceHours = Number.isFinite(sinceHoursRaw) && sinceHoursRaw > 0 ? sinceHoursRaw : 6;
  const maxPagesPerForm = Number.isFinite(maxPagesRaw) && maxPagesRaw > 0 ? maxPagesRaw : 3;

  const summary = await syncLiveMetaLeadsToDb({ sinceHours, maxPagesPerForm });
  return NextResponse.json({ ok: true, summary });
}

export async function GET(req: NextRequest) {
  try {
    return await runRefresh(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Meta leads refresh failed';
    console.error('Meta leads cron GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await runRefresh(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Meta leads refresh failed';
    console.error('Meta leads cron POST error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}