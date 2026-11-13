import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getPool } from '@/lib/db';
import { notifyManualAssignment } from '@/lib/services/lead-allocation.service';
import { assignLeads, canSeeAllTasks, convertMetaTaskLeads, getUnconvertedMetaLeads, getMyTaskAppointments, getMyTaskLeads, getMyTasksMonth, getDailyActivity, unassignLeads } from '@/lib/services/my-tasks.service';

export const runtime = 'nodejs';

// Only these accounts (by username) may assign or unassign leads.
const ASSIGNER_USERNAMES = ['mayur'];

async function canAssignLeads(userId: number): Promise<boolean> {
  const [rows] = await getPool().query('SELECT username FROM awt_adminuser WHERE id = ? AND (deleted = 0 OR deleted IS NULL) LIMIT 1', [userId]);
  return ASSIGNER_USERNAMES.includes(String((rows as { username: string }[])[0]?.username || '').trim().toLowerCase());
}

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

    const filters = {
      date, owner, scope, all: sp.get('view') === 'all', days: Number(sp.get('days')) || undefined,
      statuses: list(sp.get('status')),
      courseIds: list(sp.get('course'))?.map(Number).filter(Number.isFinite),
      modes: list(sp.get('mode')),
      temps: list(sp.get('temp')),
      batches: list(sp.get('batch')),
      q: sp.get('q') || undefined,
    } as const;
    const [inquiryLeads, metaLeads, appointments, [staffRows], canAssign] = await Promise.all([
      getMyTaskLeads(filters),
      // Unconverted Meta leads; skipped when a filter they can't satisfy is set.
      filters.statuses?.length || filters.courseIds?.length || filters.temps?.length ? Promise.resolve([]) : getUnconvertedMetaLeads(filters),
      getMyTaskAppointments(date, owner, scope),
      getPool().query(
        `SELECT c.user_id AS id, COALESCE(NULLIF(TRIM(c.display_name), ''), u.username) AS name
           FROM appt_counsellors c JOIN awt_adminuser u ON u.id = c.user_id
          WHERE (u.deleted = 0 OR u.deleted IS NULL) ORDER BY name`
      ) as Promise<[{ id: number; name: string }[], unknown]>,
      canAssignLeads(auth.session.userId),
    ]);
    const leads = [...inquiryLeads, ...metaLeads];
    return NextResponse.json({
      leads, appointments,
      staff: canSeeAll ? staffRows : staffRows.filter((u) => u.id === auth.session.userId),
      canAssign, me: auth.session.userId, owner, scope, canSeeAll,
    });
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
    if (!(await canAssignLeads(auth.session.userId))) {
      return NextResponse.json({ error: 'Only the Mayur account can assign or unassign leads' }, { status: 403 });
    }
    const body = await req.json();
    let ids: number[] = Array.isArray(body.inquiryIds) ? body.inquiryIds.map(Number) : [];
    if (body.action === 'unassign') {
      if (!ids.length) return NextResponse.json({ error: 'Pick leads to unassign' }, { status: 400 });
      return NextResponse.json({ success: true, unassigned: await unassignLeads(ids) });
    }
    const userId = Number(body.userId);
    if (!Number.isInteger(userId) || userId <= 0 || !ids.length) return NextResponse.json({ error: 'Pick leads and a counsellor' }, { status: 400 });
    const [ok] = await getPool().query('SELECT 1 FROM appt_counsellors WHERE user_id = ? LIMIT 1', [userId]);
    if (!(ok as unknown[]).length) return NextResponse.json({ error: 'Leads can only be assigned to a counsellor' }, { status: 400 });
    // Negative ids are unconverted Meta leads: convert them to inquiries first, then assign.
    if (ids.some((n) => n < 0)) {
      const converted = await convertMetaTaskLeads(ids, auth.session.userId);
      ids = [...ids.filter((n) => n > 0), ...converted];
    }
    const count = await assignLeads(ids, userId, auth.session.userId);
    await notifyManualAssignment(ids, userId).catch((err) => console.error('Manual assign notify:', err));
    return NextResponse.json({ success: true, assigned: count });
  } catch (error) {
    console.error('My tasks assign error:', error);
    return NextResponse.json({ error: 'Failed to assign leads' }, { status: 500 });
  }
}
