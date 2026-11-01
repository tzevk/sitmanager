import { NextRequest, NextResponse } from 'next/server';
import { ensureActivityTable, getActivityPool } from '@/lib/activity-log';

export const runtime = 'nodejs';
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get('x-vercel-cron')) return true;
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return bearer === secret || req.headers.get('x-cron-secret')?.trim() === secret;
}

/**
 * Scheduled: save per-person weekly totals (Monday to Sunday) permanently, so the
 * report survives activity-log-cleanup. Re-counts the last two finished weeks, so
 * one missed run repairs itself. Well inside the 90 days cleanup keeps.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await ensureActivityTable();
    const [result] = await getActivityPool().query(
      `REPLACE INTO activity_weekly_summary (week_start, user_id, user_name, action_type, events)
       SELECT DATE_SUB(DATE(created_at), INTERVAL WEEKDAY(created_at) DAY) AS week_start,
              COALESCE(user_id, 0), IF(user_id IS NULL, 'Unknown / failed sign-ins', MAX(user_name)), action_type, COUNT(*)
       FROM system_activity_log
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) + 14 DAY)
         AND created_at < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
       GROUP BY week_start, COALESCE(user_id, 0), action_type`
    );
    return NextResponse.json({ ok: true, rows: (result as { affectedRows: number }).affectedRows });
  } catch (error) {
    console.error('Activity weekly summary error:', error);
    return NextResponse.json({ ok: false, error: 'Weekly summary failed' }, { status: 500 });
  }
}
