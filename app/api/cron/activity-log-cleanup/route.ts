import { NextRequest, NextResponse } from 'next/server';
import { getActivityPool } from '@/lib/activity-log';

export const runtime = 'nodejs';
export const maxDuration = 300;

const KEEP_DAYS = 90;
const BATCH = 5000;
const BUDGET_MS = 240_000;

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get('x-vercel-cron')) return true;
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return bearer === secret || req.headers.get('x-cron-secret')?.trim() === secret;
}

/**
 * Scheduled: delete click and page-visit rows older than KEEP_DAYS. Real changes,
 * sign-ins and submitted actions are kept. Small batches keep the table usable.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const pool = getActivityPool();
    const deadline = Date.now() + BUDGET_MS;
    let deleted = 0;
    while (Date.now() < deadline) {
      const [result] = await pool.query(
        `DELETE FROM system_activity_log
         WHERE action_type IN ('CLICK', 'PAGE') AND created_at < NOW() - INTERVAL ? DAY
         LIMIT ?`,
        [KEEP_DAYS, BATCH]
      );
      const affected = (result as { affectedRows: number }).affectedRows;
      deleted += affected;
      if (affected < BATCH) break;
    }
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    console.error('Activity log cleanup error:', error);
    return NextResponse.json({ ok: false, error: 'Cleanup failed' }, { status: 500 });
  }
}
