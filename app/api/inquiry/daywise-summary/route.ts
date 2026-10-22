import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getDaywiseSummary } from '@/lib/services/my-tasks.service';

export const runtime = 'nodejs';

const MAX_DAYS = 400;

/** Day-wise contacted / followed up / admitted per counsellor: ?from=YYYY-MM-DD&to=YYYY-MM-DD[&owner=all|<userId>] */
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'inquiry.view');
  if (auth instanceof NextResponse) return auth;
  const sp = req.nextUrl.searchParams;
  const from = sp.get('from') || '';
  const to = sp.get('to') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
  }
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > MAX_DAYS) {
    return NextResponse.json({ error: `Date range is limited to ${MAX_DAYS} days` }, { status: 400 });
  }
  const owner = sp.get('owner') || 'all';
  if (owner !== 'all' && owner !== 'unowned' && !/^\d+$/.test(owner)) return NextResponse.json({ error: 'Invalid owner' }, { status: 400 });
  try {
    return NextResponse.json(await getDaywiseSummary(from, to, owner));
  } catch (error) {
    console.error('Daywise summary error:', error);
    return NextResponse.json({ error: 'Failed to load the summary' }, { status: 500 });
  }
}
