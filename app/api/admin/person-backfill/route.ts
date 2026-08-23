import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { backfillPersonMaster } from '@/lib/services/person-backfill.service';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * One-off backfill: links every existing student_inquiry row with no Person_Id to a
 * person_master row, using the same matching logic as live inserts. Gated on the
 * highest-tier inquiry permission since this is a bulk data-mutation tool, not a
 * routine endpoint. Always run with ?dryRun=1 first and review the counts.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'inquiry.delete');
    if (auth instanceof NextResponse) return auth;

    const dryRun = req.nextUrl.searchParams.get('dryRun') !== '0';
    const summary = await backfillPersonMaster({ dryRun });

    return NextResponse.json({ success: true, summary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Person backfill error:', error);
    return NextResponse.json({ error: 'Backfill failed', details: message }, { status: 500 });
  }
}
