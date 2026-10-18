import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import scoreboard from '@/lib/data/sales-scoreboard.json';

/**
 * Sales scoreboard figures for the dashboard widgets, taken from the sales team's
 * SALES_PERFORMANCE_SCOREBOARD sheet. ?view=tracker → weekly Sales Tracker rows
 * (sales_tracker.view); ?view=individual → per-employee prospect logs
 * (individual_sales_tracker.view). Prospect names are not stored, only a reference.
 */
export async function GET(req: NextRequest) {
  const view = req.nextUrl.searchParams.get('view');

  if (view === 'tracker') {
    const auth = await requirePermission(req, 'sales_tracker.view');
    if (auth instanceof NextResponse) return auth;
    return NextResponse.json({ source: scoreboard.source, dataThrough: scoreboard.dataThrough, rows: scoreboard.tracker });
  }

  if (view === 'individual') {
    const auth = await requirePermission(req, 'individual_sales_tracker.view');
    if (auth instanceof NextResponse) return auth;
    return NextResponse.json({ source: scoreboard.source, dataThrough: scoreboard.dataThrough, individuals: scoreboard.individuals });
  }

  return NextResponse.json({ error: 'view must be "tracker" or "individual"' }, { status: 400 });
}
