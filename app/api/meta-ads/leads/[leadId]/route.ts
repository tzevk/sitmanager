import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getMetaLeadDetail, updateMetaLeadDetail } from '@/lib/services/meta-ads.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const auth = await requirePermission(req, ['inquiry.view', 'report_inquiry.view']);
    if (auth instanceof NextResponse) return auth;

    const { leadId } = await params;
    const detail = await getMetaLeadDetail(leadId);
    if (!detail) {
      return NextResponse.json({ error: 'Meta lead not found' }, { status: 404 });
    }

    return NextResponse.json({ lead: detail });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch Meta lead';
    console.error('Meta lead detail GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const auth = await requirePermission(req, ['inquiry.update']);
    if (auth instanceof NextResponse) return auth;

    const { leadId } = await params;
    const body = await req.json().catch(() => ({}));
    const detail = await updateMetaLeadDetail(leadId, {
      studentName: typeof body?.studentName === 'string' ? body.studentName : null,
      courseName: typeof body?.courseName === 'string' ? body.courseName : null,
      mobile: typeof body?.mobile === 'string' ? body.mobile : null,
      email: typeof body?.email === 'string' ? body.email : null,
      city: typeof body?.city === 'string' ? body.city : undefined,
      discussion: typeof body?.discussion === 'string' ? body.discussion : null,
      fields: body?.fields && typeof body.fields === 'object' ? body.fields : undefined,
      utm: body?.utm && typeof body.utm === 'object' ? body.utm : undefined,
      statusId: typeof body?.statusId === 'number' ? body.statusId : undefined,
    });

    if (!detail) {
      return NextResponse.json({ error: 'Meta lead not found' }, { status: 404 });
    }

    return NextResponse.json({ lead: detail });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update Meta lead';
    console.error('Meta lead detail PATCH error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}