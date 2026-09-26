import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { createRateLimiter } from '@/lib/rate-limit';
import { ensureAppointmentTables } from '@/lib/appointments/schema';
import { checkDateWindow, generateSlots, loadRangeContexts, type ApptMode } from '@/lib/appointments/engine';
import { addDays, isValidDateStr, nowLocal } from '@/lib/appointments/time';

// Slot browsing is chattier than a form submit — allow more than publicFormRateLimiter.
const availabilityRateLimiter = createRateLimiter({ maxRequests: 60, windowSeconds: 60, scope: 'public-appt-availability' });

/**
 * Public availability.
 *   GET ?mode=online|offline               → date strip for the booking window
 *   GET ?mode=online|offline&date=YYYY-MM-DD → bookable slots for that date
 *
 * Only returns times where ≥1 counsellor can actually take the appointment;
 * counsellor identities are never exposed. Final validation happens again at booking.
 */
export async function GET(req: NextRequest) {
  const limited = await availabilityRateLimiter(req);
  if (limited) return limited;

  try {
    await ensureAppointmentTables();
    const params = req.nextUrl.searchParams;
    const mode: ApptMode = params.get('mode') === 'online' ? 'online' : 'offline';
    const date = params.get('date');
    const pool = getPool();

    if (date) {
      if (!isValidDateStr(date)) return NextResponse.json({ success: false, error: 'Invalid date' }, { status: 400 });
      const ctx = (await loadRangeContexts(pool, date, date)).get(date)!;
      const blocked = checkDateWindow(ctx, true);
      const slots = blocked ? [] : generateSlots(ctx, mode).filter((s) => s.available).map((s) => ({ time: s.time, end: s.end }));
      return NextResponse.json({ success: true, date, mode, closedReason: ctx.closure?.label ?? null, slots });
    }

    const today = nowLocal().date;
    const contexts = await loadRangeContexts(pool, today, addDays(today, 60));
    const windowDays = contexts.get(today)!.settings.booking_window_days;
    const last = addDays(today, windowDays);
    const dates = [];
    for (const [d, ctx] of contexts) {
      if (d > last) break;
      const slots = checkDateWindow(ctx, true) ? [] : generateSlots(ctx, mode).filter((s) => s.available);
      dates.push({ date: d, available: slots.length > 0, slotCount: slots.length, closedReason: ctx.closure?.label ?? null });
    }
    return NextResponse.json({ success: true, mode, dates });
  } catch (err) {
    console.error('[appointments] public availability:', err);
    return NextResponse.json({ success: false, error: 'Unable to load availability' }, { status: 500 });
  }
}
