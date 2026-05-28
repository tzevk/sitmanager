import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { addMetaLeadDiscussionNote, getMetaLeadDiscussions } from '@/lib/services/meta-ads.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const auth = await requirePermission(req, ['inquiry.view', 'report_inquiry.view']);
    if (auth instanceof NextResponse) return auth;
    const { leadId } = await params;
    const entries = await getMetaLeadDiscussions(leadId);
    return NextResponse.json({ entries });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch discussions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const auth = await requirePermission(req, ['inquiry.update']);
    if (auth instanceof NextResponse) return auth;
    const { leadId } = await params;
    const body = await req.json().catch(() => ({}));
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    const nextDate = typeof body?.nextDate === 'string' ? body.nextDate : null;
    if (!note) return NextResponse.json({ error: 'Note is required' }, { status: 400 });
    await addMetaLeadDiscussionNote(leadId, note, nextDate);
    const entries = await getMetaLeadDiscussions(leadId);
    return NextResponse.json({ entries });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add note';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
