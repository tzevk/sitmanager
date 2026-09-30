import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { FOLLOW_UP_DUE_WINDOW_DAYS, getDueFollowUps } from '@/lib/services/inquiry.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'inquiry.view');
    if (auth instanceof NextResponse) return auth;

    const followUps = await getDueFollowUps();
    return NextResponse.json({ followUps, windowDays: FOLLOW_UP_DUE_WINDOW_DAYS });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Due follow-ups GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch due follow-ups', details: message }, { status: 500 });
  }
}
