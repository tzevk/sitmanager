import { NextRequest, NextResponse } from 'next/server';
import { persistMetaBatchRecommendations } from '@/lib/services/meta-batch-recommendation.service';

export const runtime = 'nodejs';
export const maxDuration = 120;

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

async function runPersist(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  const totalBudgetRaw = Number(
    req.nextUrl.searchParams.get('totalBudget')
    || process.env.META_ADS_RECOMMENDATION_BUDGET
    || '100000'
  );

  const totalBudget = Number.isFinite(totalBudgetRaw) && totalBudgetRaw > 0
    ? totalBudgetRaw
    : 100000;

  const summary = await persistMetaBatchRecommendations({ totalBudget });
  return NextResponse.json({ ok: true, summary });
}

export async function GET(req: NextRequest) {
  try {
    return await runPersist(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Meta batch recommendation cron failed';
    console.error('Meta batch recommendation cron GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await runPersist(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Meta batch recommendation cron failed';
    console.error('Meta batch recommendation cron POST error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
