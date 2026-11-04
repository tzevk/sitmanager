import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getLeadResponseReport } from '@/lib/services/lead-response-report.service';

export const runtime = 'nodejs';

/** GET /api/reports/lead-response?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'report_inquiry.view');
  if (auth instanceof NextResponse) return auth;
  try {
    const sp = req.nextUrl.searchParams;
    return NextResponse.json(await getLeadResponseReport(sp.get('from') || '', sp.get('to') || ''));
  } catch (error: unknown) {
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : 'Failed';
    if (status === 400) return NextResponse.json({ error: message }, { status });
    console.error('Lead response report error:', error);
    return NextResponse.json({ error: 'Failed to build the report' }, { status: 500 });
  }
}
