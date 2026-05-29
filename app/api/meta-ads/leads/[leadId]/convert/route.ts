import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { convertMetaLeadToInquiry } from '@/lib/services/meta-ads.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const auth = await requirePermission(req, ['inquiry.create', 'inquiry.update']);
    if (auth instanceof NextResponse) return auth;

    const { leadId } = await params;
    const lead = await convertMetaLeadToInquiry(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Meta lead not found' }, { status: 404 });
    }

    return NextResponse.json({ lead });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to convert Meta lead';
    console.error('Meta lead convert POST error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}