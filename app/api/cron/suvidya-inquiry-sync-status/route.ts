import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getLatestSuvidyaSyncRuns } from '@/lib/services/suvidya-sync-run.service';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['inquiry.view', 'report_inquiry.view']);
    if (auth instanceof NextResponse) return auth;

    const runs = await getLatestSuvidyaSyncRuns();
    return NextResponse.json({ ok: true, runs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load Suvidya sync status';
    console.error('Suvidya sync status GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
