/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPool } from '@/lib/db';
import { isSuperAdminRole } from '@/lib/super-admin';
import { ensureActivityTable } from '@/lib/activity-log';

const PAGE_SIZE = 50;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Proxy rows are hidden when the route wrote its own, more detailed row for the same
// request. VIEW rows don't count: a page load must not hide a nearby save.
const NOT_DUPLICATE = `NOT (l.action_type = 'REQUEST' AND EXISTS (
  SELECT 1 FROM system_activity_log r
  WHERE r.user_id = l.user_id AND r.endpoint = l.endpoint
    AND r.action_type NOT IN ('REQUEST', 'VIEW')
    AND r.created_at BETWEEN l.created_at - INTERVAL 30 SECOND AND l.created_at + INTERVAL 30 SECOND
))`;

const redact = (value: any): any => {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => (
      [k, /pass(word|wd)?|token|secret|otp/i.test(k) ? '[hidden]' : redact(v)]
    )));
  }
  return value;
};

function parseDetails(raw: string | null) {
  if (!raw) return null;
  try { return redact(JSON.parse(raw)); } catch { return raw; }
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const pool = getPool();
  if (!(await isSuperAdminRole(session.role, pool))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensureActivityTable();
    const run = async (sql: string, params: unknown[] = []) =>
      (await pool.query(`SET STATEMENT max_statement_time=15 FOR ${sql}`, params))[0] as any[];

    const url = new URL(req.url);
    if (url.searchParams.get('live')) {
      const online = await run(
        `SELECT user_id, user_name, page, last_click,
                DATE_FORMAT(last_click_at, '%Y-%m-%d %H:%i:%s') AS last_click_at,
                DATE_FORMAT(last_seen, '%Y-%m-%d %H:%i:%s') AS last_seen
         FROM activity_presence WHERE last_seen >= NOW() - INTERVAL 150 SECOND ORDER BY user_name`
      );
      return NextResponse.json({ online }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const param = (name: string) => url.searchParams.get(name)?.trim() ?? '';
    const from = DATE_RE.test(param('from')) ? param('from') : today;
    const to = DATE_RE.test(param('to')) ? param('to') : today;

    const where = ['l.created_at >= ?', 'l.created_at < DATE_ADD(?, INTERVAL 1 DAY)'];
    const params: unknown[] = [from, to];
    const userId = Number(param('userId'));
    if (Number.isInteger(userId) && userId > 0) { where.push('l.user_id = ?'); params.push(userId); }
    if (param('action')) { where.push('l.action_type = ?'); params.push(param('action')); }
    if (param('q')) {
      const like = `%${param('q')}%`;
      where.push('(l.user_name LIKE ? OR l.table_name LIKE ? OR l.record_id LIKE ? OR l.endpoint LIKE ?)');
      params.push(like, like, like, like);
    }
    const filter = where.join(' AND ');

    // Cheap check the page polls; it only reloads when this number changes.
    if (param('latest')) {
      const [row] = await run(`SELECT COALESCE(MAX(l.id), 0) AS latest FROM system_activity_log l WHERE ${filter}`, params);
      return NextResponse.json({ latest: Number(row.latest) }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const visible = `${filter} AND ${NOT_DUPLICATE}`;
    const page = Math.max(1, Number(param('page')) || 1);
    const sort = param('sort') === 'oldest' ? 'ASC' : 'DESC';

    // One at a time: this reloads often and must stay light on connections.
    const rows = await run(
        `SELECT l.id, l.table_name, l.action_type, l.record_id, l.user_id, l.user_name, l.endpoint, l.details_json,
                DATE_FORMAT(l.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
         FROM system_activity_log l WHERE ${visible}
         ORDER BY l.created_at ${sort}, l.id ${sort} LIMIT ? OFFSET ?`,
        [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]
    );
    const [summary] = await run(
        `SELECT COUNT(*) AS total, COUNT(DISTINCT l.user_id) AS accounts,
                SUM(l.action_type = 'LOGIN_FAILED') AS failedLogins, SUM(l.action_type = 'DELETE') AS deletes
         FROM system_activity_log l WHERE ${visible}`,
        params
    );
    const accounts = await run(
        `SELECT l.user_id AS id, MAX(l.user_name) AS name, COUNT(*) AS count
         FROM system_activity_log l WHERE ${where.slice(0, 2).join(' AND ')} AND l.user_id IS NOT NULL
         GROUP BY l.user_id ORDER BY count DESC`,
        [from, to]
    );
    const actions = await run(`SELECT DISTINCT action_type AS action FROM system_activity_log ORDER BY action_type`);
    const [max] = await run(`SELECT COALESCE(MAX(l.id), 0) AS latest FROM system_activity_log l WHERE ${filter}`, params);

    return NextResponse.json({
      rows: rows.map(({ details_json, ...r }) => ({ ...r, details: parseDetails(details_json) })),
      total: Number(summary.total),
      accountsActive: Number(summary.accounts),
      failedLogins: Number(summary.failedLogins ?? 0),
      deletes: Number(summary.deletes ?? 0),
      accounts,
      actions: actions.map((a) => a.action),
      latest: Number(max.latest),
      page,
      pageSize: PAGE_SIZE,
      from,
      to,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('Activity log GET error:', error);
    return NextResponse.json({ error: 'Failed to load activity log' }, { status: 500 });
  }
}
