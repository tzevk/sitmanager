import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { listMetaLeads } from '@/lib/services/meta-ads.service';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['inquiry.view', 'report_inquiry.view', 'meta_lead.view']);
    if (auth instanceof NextResponse) return auth;

    const url = req.nextUrl;
    const untouchedOnly = url.searchParams.get('untouchedOnly') === '1';
    // Untouched-only is a narrow, action-focused list (leads with zero
    // follow-up logged) rather than the main browsable table, so it's allowed
    // a higher cap — the point is showing ALL of them, not a page of them.
    const maxLimit = untouchedOnly ? 1000 : 100;
    const result = await listMetaLeads({
      page: Math.max(1, parseInt(url.searchParams.get('page') || '1')),
      limit: Math.min(maxLimit, Math.max(10, parseInt(url.searchParams.get('limit') || '25'))),
      search: url.searchParams.get('search')?.trim() || '',
      leadTag: url.searchParams.get('leadTag')?.trim() || '',
      source: url.searchParams.get('source')?.trim() || '',
      statusId: url.searchParams.get('status') || '',
      dateFrom: url.searchParams.get('dateFrom') || '',
      dateTo: url.searchParams.get('dateTo') || '',
      training: url.searchParams.get('training') || '',
      duplicatesOnly: url.searchParams.get('duplicatesOnly') === '1',
      untouchedOnly,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch Meta leads';
    console.error('Meta leads GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}