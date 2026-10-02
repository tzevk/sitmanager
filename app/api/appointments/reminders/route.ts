import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { isCounsellor, markRemindersRead, pollReminders } from '@/lib/appointments/service';

/**
 * In-app 30-minute reminders for the logged-in counsellor — and, for users who
 * can manage all appointments, reminders for appointments with no counsellor.
 * GET  — materialise due reminders (idempotent) and return unread ones.
 * POST — { ids: number[] } mark as read (dismissed / opened).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const canManage = auth.permissions.includes('appointment.manage');
    const counsellor = await isCounsellor(auth.session.userId);
    if (!counsellor && !canManage) {
      return NextResponse.json({ success: true, reminders: [], isCounsellor: false });
    }
    const reminders = await pollReminders(auth.session.userId, { includeUnassigned: canManage });
    // isCounsellor = "keep polling every minute" for the popup.
    return NextResponse.json({ success: true, reminders, isCounsellor: true });
  } catch (err) {
    console.error('[appointments] reminders poll:', err);
    return NextResponse.json({ success: false, reminders: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 50) : [];
    await markRemindersRead(auth.session.userId, ids);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[appointments] reminders read:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
