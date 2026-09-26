import { NextRequest, NextResponse, after } from 'next/server';
import { createAppointment, listAppointments, parseBookingInput } from '@/lib/appointments/service';
import { sendBookingEmails } from '@/lib/appointments/notify';
import { apptErrorResponse, requireAppointmentAccess } from '@/lib/appointments/http';

/** GET — appointment management table (own appointments unless appointment.manage). */
export async function GET(req: NextRequest) {
  const access = await requireAppointmentAccess(req, 'view');
  if (access instanceof NextResponse) return access;
  try {
    const p = req.nextUrl.searchParams;
    const result = await listAppointments(
      {
        from: p.get('from') || undefined,
        to: p.get('to') || undefined,
        counsellor: Number(p.get('counsellor')) || undefined,
        course_id: p.get('course') === 'guidance' ? -1 : Number(p.get('course')) || undefined,
        mode: p.get('mode') || undefined,
        status: p.get('status') || undefined,
        search: p.get('search') || undefined,
        page: Number(p.get('page')) || 1,
        limit: Number(p.get('limit')) || 50,
      },
      access.scope
    );
    return NextResponse.json({ success: true, ...result, canManage: access.canManage });
  } catch (err) {
    return apptErrorResponse(err, 'list');
  }
}

/** POST — staff books on behalf of an applicant (walk-in / phone). Same engine + lock as public. */
export async function POST(req: NextRequest) {
  const access = await requireAppointmentAccess(req, 'create');
  if (access instanceof NextResponse) return access;
  try {
    const body = await req.json().catch(() => ({}));
    const { input, errors } = parseBookingInput(body);
    if (Object.keys(errors).length) {
      return NextResponse.json({ success: false, error: 'Please correct the highlighted fields', fields: errors }, { status: 422 });
    }
    const counsellorUserId = access.canManage ? Number(body.counsellor_user_id) || null : null;
    const { appointment, settings, counsellorEmail } = await createAppointment(input, {
      source: 'internal',
      actor: access.actor,
      counsellorUserId,
    });
    if (body.send_email !== false) after(() => sendBookingEmails(appointment, settings, counsellorEmail));
    return NextResponse.json({ success: true, appointment });
  } catch (err) {
    return apptErrorResponse(err, 'create');
  }
}
