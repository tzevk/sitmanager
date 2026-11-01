/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { ensureActivityTable, getActivityPool } from '@/lib/activity-log';

const MAX_EVENTS = 50;
const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Receives page visits and clicks from staff browsers, plus a presence heartbeat. */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await ensureActivityTable();
    const pool = getActivityPool();
    const body = await req.json();
    const page = clean(body?.page, 255);
    if (!page.startsWith('/dashboard')) return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
    const userName = [session.firstName, session.lastName].filter(Boolean).join(' ').trim() || null;
    const events = (Array.isArray(body?.events) ? body.events : []).slice(0, MAX_EVENTS);

    const rows = events
      .filter((e: any) => e?.type === 'PAGE' || e?.type === 'CLICK')
      .map((e: any) => {
        const path = clean(e.page, 255) || page;
        const label = clean(e.label, 80);
        return [path.slice(0, 120), e.type, session.userId, userName, path, label ? JSON.stringify({ clicked: label }) : null];
      });
    if (rows.length) {
      await pool.query(
        `INSERT INTO system_activity_log (table_name, action_type, user_id, user_name, endpoint, details_json) VALUES ?`,
        [rows]
      );
    }

    const lastClick = [...events].reverse().find((e: any) => e?.type === 'CLICK');
    await pool.query(
      `INSERT INTO activity_presence (user_id, user_name, page, last_click, last_click_at)
       VALUES (?, ?, ?, ?, IF(? IS NULL, NULL, NOW()))
       ON DUPLICATE KEY UPDATE user_name = VALUES(user_name), page = VALUES(page), last_seen = NOW(),
         last_click_at = IF(VALUES(last_click) IS NULL, last_click_at, NOW()),
         last_click = COALESCE(VALUES(last_click), last_click)`,
      [session.userId, userName, page, lastClick ? clean(lastClick.label, 80) : null, lastClick ? 1 : null]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Activity track error:', error);
    return NextResponse.json({ error: 'Failed to record activity' }, { status: 500 });
  }
}
