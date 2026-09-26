import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { calendarAppointments } from '@/lib/appointments/service';
import { counsellorDayTimeline, loadCounsellors, loadRangeContexts } from '@/lib/appointments/engine';
import { apptErrorResponse, requireAppointmentAccess } from '@/lib/appointments/http';
import { addDays, isValidDateStr } from '@/lib/appointments/time';

/**
 * GET ?from&to[&counsellor&course&mode&status][&availability=1]
 * Appointments in range; with availability=1 (range ≤ 7 days) also returns each
 * counsellor's working hours, breaks, blocks/leave and booked time per day —
 * the same data the public slot engine uses.
 */
export async function GET(req: NextRequest) {
  const access = await requireAppointmentAccess(req, 'view');
  if (access instanceof NextResponse) return access;
  try {
    const p = req.nextUrl.searchParams;
    const from = p.get('from') || '';
    const to = p.get('to') || '';
    if (!isValidDateStr(from) || !isValidDateStr(to) || to < from || to > addDays(from, 62)) {
      return NextResponse.json({ success: false, error: 'Invalid date range' }, { status: 400 });
    }
    const counsellorFilter = Number(p.get('counsellor')) || undefined;
    const appointments = await calendarAppointments(from, to, {
      counsellor: counsellorFilter,
      course_id: p.get('course') === 'guidance' ? -1 : Number(p.get('course')) || undefined,
      mode: p.get('mode') || undefined,
      status: p.get('status') || undefined,
    }, access.scope);

    const pool = getPool();
    const allCounsellors = await loadCounsellors(pool, false);
    const visibleCounsellors = access.canManage
      ? allCounsellors.filter((c) => !counsellorFilter || c.user_id === counsellorFilter)
      : allCounsellors.filter((c) => c.user_id === access.session.userId);

    let availability: Record<string, ReturnType<typeof counsellorDayTimeline>[]> | null = null;
    if (p.get('availability') === '1' && to <= addDays(from, 6)) {
      const contexts = await loadRangeContexts(pool, from, to, { counsellors: allCounsellors });
      availability = {};
      for (const [date, ctx] of contexts) {
        availability[date] = visibleCounsellors.map((c) => counsellorDayTimeline(ctx, c));
      }
    }

    return NextResponse.json({
      success: true,
      appointments,
      availability,
      // Dropdown options — the full list for admins, regardless of the active filter.
      counsellors: (access.canManage ? allCounsellors : visibleCounsellors)
        .map((c) => ({ user_id: c.user_id, name: c.display_name, is_active: c.is_active })),
      canManage: access.canManage,
    });
  } catch (err) {
    return apptErrorResponse(err, 'calendar');
  }
}
