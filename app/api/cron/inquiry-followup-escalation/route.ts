import { NextRequest, NextResponse } from 'next/server';
import { escalateStaleInterestedInquiries } from '@/lib/services/inquiry.service';

export const runtime = 'nodejs';
export const maxDuration = 300;

/*
 * GET /api/cron/inquiry-followup-escalation
 * Runs periodically (see vercel.json). Any inquiry marked "Contacted (interested)"
 * whose status hasn't changed in 24+ hours is automatically flipped to
 * "Follow up pending", so it surfaces at the top of the CBD inquiry list
 * (see the status-priority ORDER BY in listOnlineAdmissions/listInquiries)
 * instead of silently going cold.
 */

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-cron-secret')?.trim() || '';
  const querySecret = req.nextUrl.searchParams.get('secret')?.trim() || '';
  return bearer === secret || headerSecret === secret || querySecret === secret;
}

function errorMessage(error: unknown, fallback = 'Unknown error') {
  return error instanceof Error ? error.message : fallback;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hoursParam = req.nextUrl.searchParams.get('hours');
    const hours = hoursParam ? Number(hoursParam) : 24;
    const result = await escalateStaleInterestedInquiries(Number.isFinite(hours) && hours > 0 ? hours : 24);

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error('Inquiry follow-up escalation cron error:', error);
    return NextResponse.json(
      { success: false, error: errorMessage(error, 'Failed to run follow-up escalation') },
      { status: 500 }
    );
  }
}
