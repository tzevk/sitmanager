import { NextRequest, NextResponse, after } from 'next/server';
import {
  AppointmentError, editAppointment, getAppointment, getCounsellorEmail, reassignAppointment,
  rescheduleAppointment, setAppointmentStatus, type ApptStatus,
} from '@/lib/appointments/service';
import { sendCounsellorNotification } from '@/lib/appointments/notify';
import { apptErrorResponse, requireAppointmentAccess } from '@/lib/appointments/http';
import { getPool } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

async function parseId(ctx: Ctx) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) throw new AppointmentError('Invalid appointment id', 400);
  return id;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const access = await requireAppointmentAccess(req, 'view');
  if (access instanceof NextResponse) return access;
  try {
    const data = await getAppointment(await parseId(ctx), access.scope);
    if (!data) return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    return NextResponse.json({ success: true, ...data, canManage: access.canManage });
  } catch (err) {
    return apptErrorResponse(err, 'get');
  }
}

/**
 * PATCH { action, ... }
 *   edit        — applicant details / program / notes / meeting link / location
 *   reschedule  — { date, time, mode?, note? }   (re-validated inside the booking lock)
 *   reassign    — { counsellor_user_id | 'auto', note? }   (admins only)
 *   status      — { status: Completed | No Show | Cancelled, note? }
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const access = await requireAppointmentAccess(req, 'update');
  if (access instanceof NextResponse) return access;
  try {
    const id = await parseId(ctx);
    const body = await req.json().catch(() => ({}));
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) || undefined : undefined;

    switch (body.action) {
      case 'edit': {
        const appointment = await editAppointment(id, body, access.scope, access.actor);
        return NextResponse.json({ success: true, appointment });
      }
      case 'reschedule': {
        const mode = body.mode === 'online' || body.mode === 'offline' ? body.mode : null;
        const { updated } = await rescheduleAppointment(id, String(body.date || ''), String(body.time || '').slice(0, 5), mode, access.scope, access.actor, note);
        after(async () => {
          const email = await getCounsellorEmail(getPool(), updated.counsellor_user_id);
          if (email) await sendCounsellorNotification(updated, email, 'rescheduled').catch((e) => console.error('[appointments] reschedule mail', e));
        });
        return NextResponse.json({ success: true, appointment: updated });
      }
      case 'reassign': {
        const target = body.counsellor_user_id === 'auto' ? 'auto' : Number(body.counsellor_user_id);
        if (target !== 'auto' && !(target > 0)) throw new AppointmentError('Choose a counsellor');
        const { updated } = await reassignAppointment(id, target, access.scope, access.actor, note);
        after(async () => {
          const email = await getCounsellorEmail(getPool(), updated.counsellor_user_id);
          if (email) await sendCounsellorNotification(updated, email, 'assigned').catch((e) => console.error('[appointments] reassign mail', e));
        });
        return NextResponse.json({ success: true, appointment: updated });
      }
      case 'status': {
        if (body.status === 'Cancelled' && !access.canManage && !access.permissions.includes('appointment.delete') && !access.isCounsellor) {
          throw new AppointmentError('You do not have permission to cancel appointments', 403);
        }
        const updated = await setAppointmentStatus(id, body.status as ApptStatus, access.scope, access.actor, note);
        if (body.status === 'Cancelled') {
          after(async () => {
            const email = await getCounsellorEmail(getPool(), updated.counsellor_user_id);
            if (email) await sendCounsellorNotification(updated, email, 'cancelled').catch((e) => console.error('[appointments] cancel mail', e));
          });
        }
        return NextResponse.json({ success: true, appointment: updated });
      }
      default:
        throw new AppointmentError('Unknown action');
    }
  } catch (err) {
    return apptErrorResponse(err, 'update');
  }
}
