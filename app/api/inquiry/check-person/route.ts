import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { checkExistingPerson } from '@/lib/services/person.service';
import { findSameLead } from '@/lib/services/inquiry-dedupe.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'inquiry.view');
    if (auth instanceof NextResponse) return auth;

    const mobile = req.nextUrl.searchParams.get('mobile') || '';
    const email = req.nextUrl.searchParams.get('email') || '';

    const courseId = req.nextUrl.searchParams.get('courseId') || '';
    const excludeId = Number(req.nextUrl.searchParams.get('excludeId') || 0);
    const [result, same] = await Promise.all([
      checkExistingPerson(mobile, email),
      courseId ? findSameLead({ mobile, email, courseId }) : Promise.resolve(null),
    ]);
    // sameLead = this person already has a live lead for this training programme (not allowed twice).
    const sameLead = same && same.inquiryId !== excludeId ? same : null;
    return NextResponse.json({ ...result, sameLead });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Check-person error:', error);
    return NextResponse.json({ error: 'Failed to check existing person', details: message }, { status: 500 });
  }
}
