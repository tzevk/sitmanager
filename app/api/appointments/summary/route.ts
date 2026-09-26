import { NextRequest, NextResponse } from 'next/server';
import { appointmentSummary } from '@/lib/appointments/service';
import { requireAppointmentAccess } from '@/lib/appointments/http';

/** Dashboard widget data — today's counts, next appointment, today's list. */
export async function GET(req: NextRequest) {
  const access = await requireAppointmentAccess(req, 'view');
  if (access instanceof NextResponse) return access;
  try {
    const summary = await appointmentSummary(access.scope);
    return NextResponse.json(
      { success: true, ...summary, canManage: access.canManage, isCounsellor: access.isCounsellor },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    console.error('[appointments] summary:', err);
    return NextResponse.json({ success: false, error: 'Unable to load appointments' }, { status: 500 });
  }
}
