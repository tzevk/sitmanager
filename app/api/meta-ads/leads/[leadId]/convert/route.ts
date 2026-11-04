import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { convertMetaLeadToInquiry } from '@/lib/services/meta-ads.service';
import { autoAssignPending } from '@/lib/services/lead-allocation.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const auth = await requirePermission(req, ['inquiry.create', 'inquiry.update', 'meta_lead.create', 'meta_lead.update', 'meta_lead.convert']);
    if (auth instanceof NextResponse) return auth;

    const { leadId } = await params;
    const lead = await convertMetaLeadToInquiry(leadId, auth.session.userId);
    if (!lead) {
      return NextResponse.json({ error: 'Meta lead not found' }, { status: 404 });
    }

    // Converted leads join the normal allocation (the cron would pick them up within a minute anyway).
    await autoAssignPending({ limit: 20 }).catch((err) => console.error('Meta convert auto-assign:', err));
    return NextResponse.json({ lead });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to convert Meta lead';
    console.error('Meta lead convert POST error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}