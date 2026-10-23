import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getPool } from '@/lib/db';
import { assignLeads, canSeeAllTasks, getMyTaskAppointments, getMyTaskLeads, getMyTasksMonth, getDailyActivity, unassignLeads } from '@/lib/services/my-tasks.service';

export const runtime = 'nodejs';

const list = (v: string | null) => (v ? v.split('|').map((x) => x.trim()).filter(Boolean) : undefined);

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'inquiry.view');
  if (auth instanceof NextResponse) return auth;
  try {
    const sp = req.nextUrl.searchParams;
    const date = sp.get('date') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    const scope = sp.get('scope') === 'initiated' ? 'initiated' : 'allocated';
    const canSeeAll = await canSeeAllTasks(auth.session);
    const rawOwner = sp.get('owner') || 'me';
    // Only Super Admin and the Mayur account may look at anyone else's leads.
    const owner = !canSeeAll || rawOwner === 'me' ? String(auth.session.userId) : rawOwner;
    if (owner !== 'all' && owner !== 'unowned' && !/^\d+$/.test(owner)) return NextResponse.json({ error: 'Invalid owner' }, { status: 400 });

    if (sp.get('view') === 'month') {
      const days = await getMyTasksMonth(date.slice(0, 7), owner, scope);
      return NextResponse.json({ days, me: auth.session.userId, owner, canSeeAll });
    }

    if (sp.get('view') === 'activity') {
      return NextResponse.json({ ...(await getDailyActivity(date.slice(0, 7), owner)), me: auth.session.userId, owner, canSeeAll });
    }

    const [leads, appointments, [staffRows]] = await Promise.all([
      getMyTaskLeads({
        date, owner, scope, all: sp.get('view') === 'all',
        statuses: list(sp.get('status')),
        courseIds: list(sp.get('course'))?.map(Number).filter(Number.isFinite),
        modes: list(sp.get('mode')),
        temps: list(sp.get('temp')),
        batches: list(sp.get('batch')),
        q: sp.get('q') || undefined,
      }),
      getMyTaskAppointments(date, owner, scope),
      getPool().query(
        `SELECT id, COALESCE(NULLIF(TRIM(CONCAT(COALESCE(firstname, ''), ' ', COALESCE(lastname, ''))), ''), username) AS name
           FROM awt_adminuser WHERE (deleted = 0 OR deleted IS NULL) ORDER BY name`
      ) as Promise<[{ id: number; name: string }[], unknown]>,
    ]);
    return NextResponse.json({ leads, appointments, staff: canSeeAll ? staffRows : staffRows.filter((u) => u.id === auth.session.userId), me: auth.session.userId, owner, scope, canSeeAll });
  } catch (error) {
    console.error('My tasks GET error:', error);
    return NextResponse.json({ error: 'Failed to load tasks', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

/** Bulk-assign leads to a counsellor: { inquiryIds, userId } — or { inquiryIds, action: 'unassign' } */
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'inquiry.update');
  if (auth instanceof NextResponse) return auth;
  if (!(await canSeeAllTasks(auth.session))) {
    return NextResponse.json({ error: 'Only the sales manager can allocate leads' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const ids = Array.isArray(body.inquiryIds) ? body.inquiryIds.map(Number) : [];
    if (body.action === 'unassign') {
      if (!ids.length) return NextResponse.json({ error: 'Pick leads to unassign' }, { status: 400 });
      return NextResponse.json({ success: true, unassigned: await unassignLeads(ids) });
    }
    const userId = Number(body.userId);
    if (!Number.isInteger(userId) || userId <= 0 || !ids.length) return NextResponse.json({ error: 'Pick leads and a counsellor' }, { status: 400 });
    const count = await assignLeads(ids, userId, auth.session.userId);
    return NextResponse.json({ success: true, assigned: count });
  } catch (error) {
    console.error('My tasks assign error:', error);
    return NextResponse.json({ error: 'Failed to assign leads' }, { status: 500 });
  }
}
