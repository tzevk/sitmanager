import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { listMetaLeads } from '@/lib/services/meta-ads.service';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['inquiry.view', 'report_inquiry.view', 'meta_lead.view']);
    if (auth instanceof NextResponse) return auth;

    const url = req.nextUrl;
    const untouchedOnly = url.searchParams.get('untouchedOnly') === '1';
    // The Meta Leads page shows everything matching the current filters in
    // one go (no pagination) — cap is a safety ceiling, not a real page size.
    const result = await listMetaLeads({
      page: 1,
      limit: Math.min(20000, Math.max(10, parseInt(url.searchParams.get('limit') || '20000'))),
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