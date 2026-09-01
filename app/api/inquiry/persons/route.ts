import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { cached } from '@/lib/db';
import { listInquiryPersons } from '@/lib/services/inquiry.service';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'inquiry.view');
    if (auth instanceof NextResponse) return auth;

    const url = req.nextUrl;
    const queryKey = url.searchParams.toString();
    const result = await cached(`api:inquiry:persons:${queryKey}`, 20_000, () => listInquiryPersons({
      page: Math.max(1, parseInt(url.searchParams.get('page') || '1')),
      limit: Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') || '25'))),
      pinnedInquiryId: Math.max(0, parseInt(url.searchParams.get('pinnedInquiryId') || '0')),
      search: url.searchParams.get('search')?.trim() || '',
      discipline: url.searchParams.get('discipline') || '',
      inquiryType: url.searchParams.get('inquiryType') || '',
      training: url.searchParams.get('training') || '',
      batchCategory: url.searchParams.get('batchCategory') || '',
      statusId: url.searchParams.get('status') || '',
      dateFrom: url.searchParams.get('dateFrom') || '',
      dateTo: url.searchParams.get('dateTo') || '',
    }));

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Inquiry persons GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch enquiry persons', details: message }, { status: 500 });
  }
}
