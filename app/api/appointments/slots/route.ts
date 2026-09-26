import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { freeCounsellorsFor, generateSlots, loadDayContext, type ApptMode } from '@/lib/appointments/engine';
import { apptErrorResponse, requireAppointmentAccess } from '@/lib/appointments/http';
import { isValidDateStr, toMinutes } from '@/lib/appointments/time';

/**
 * Internal slot lookup (reschedule / staff booking). Unlike the public endpoint
 * it ignores the booking window + notice period, can exclude the appointment
 * being moved, and lists which counsellors are free for each slot.
 */
export async function GET(req: NextRequest) {
  const access = await requireAppointmentAccess(req, 'update');
  if (access instanceof NextResponse) return access;
  try {
    const p = req.nextUrl.searchParams;
    const date = p.get('date') || '';
    if (!isValidDateStr(date)) return NextResponse.json({ success: false, error: 'Invalid date' }, { status: 400 });
    const mode: ApptMode = p.get('mode') === 'online' ? 'online' : 'offline';
    const excludeId = Number(p.get('exclude')) || undefined;
    const duration = Number(p.get('duration')) || undefined;

    const ctx = await loadDayContext(getPool(), date, { excludeAppointmentId: excludeId });
    const slots = generateSlots(ctx, mode, { enforceNotice: false, duration }).map((s) => {
      const start = toMinutes(s.time);
      const free = s.available ? freeCounsellorsFor(ctx, start, toMinutes(s.end), mode) : [];
      return { ...s, counsellors: free.map((c) => ({ user_id: c.user_id, name: c.display_name })) };
    });
    return NextResponse.json({ success: true, date, mode, closedReason: ctx.closure?.label ?? null, slots });
  } catch (err) {
    return apptErrorResponse(err, 'slots');
  }
}
