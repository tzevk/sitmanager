import { getPool } from '@/lib/db';
import { sendAdmissionFormEmail, withEmailSignature } from '@/lib/mailer';
import { formatDateLong, formatTime12 } from '@/lib/appointments/time';
import type { AppointmentRow } from '@/lib/appointments/service';
import type { ApptSettings } from '@/lib/appointments/engine';

/**
 * Appointment emails. Always called AFTER the booking transaction commits —
 * a mail failure is recorded on the appointment but never rolls back the booking.
 * Uses the shared mailer (SMTP / SES per ADMISSION_MAIL_PROVIDER).
 */

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function row(label: string, value: string) {
  return `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;white-space:nowrap;vertical-align:top;">${esc(label)}</td>
    <td style="padding:6px 0;font-weight:600;color:#111827;">${value}</td></tr>`;
}

function programLabel(a: AppointmentRow) {
  return a.needs_guidance ? 'Needs guidance (counsellor will recommend)' : (a.program_name || '—');
}

function whereLines(a: AppointmentRow): { html: string; text: string } {
  if (a.mode === 'online') {
    return a.meeting_link
      ? { html: row('Meeting link', `<a href="${esc(a.meeting_link)}" style="color:#2E3093;">${esc(a.meeting_link)}</a>`), text: `Meeting link: ${a.meeting_link}` }
      : { html: row('Meeting link', 'Will be shared by your counsellor before the session'), text: 'Meeting link: will be shared before the session' };
  }
  return { html: row('Location', esc(a.location || 'Suvidya Institute of Technology')), text: `Location: ${a.location || 'Suvidya Institute of Technology'}` };
}

export async function sendApplicantConfirmation(a: AppointmentRow, settings: ApptSettings) {
  const date = formatDateLong(a.appt_date);
  const time = formatTime12(a.start_time);
  const where = whereLines(a);
  const contact = [settings.contact_phone, settings.contact_email].filter(Boolean).join(' / ');

  const html = withEmailSignature(`
    <h2 style="margin:0 0 8px;color:#2E3093;font-size:20px;">Appointment Confirmed</h2>
    <p>Dear ${esc(a.first_name)} ${esc(a.last_name)},</p>
    <p>Thank you for booking a counselling appointment with Suvidya Institute of Technology. Your appointment details are below.</p>
    <table style="border-collapse:collapse;margin:12px 0;font-size:14px;">
      ${row('Appointment ID', esc(a.appointment_code))}
      ${row('Training program', esc(programLabel(a)))}
      ${row('Date', esc(date))}
      ${row('Time', `${esc(time)} (${a.duration_minutes} minutes)`)}
      ${row('Mode', a.mode === 'online' ? 'Online' : 'Offline (in person)')}
      ${a.counsellor_name ? row('Counsellor', esc(a.counsellor_name)) : ''}
      ${where.html}
    </table>
    <p>If you need to change or cancel this appointment, please contact us${contact ? ` at <strong>${esc(contact)}</strong>` : ''} and quote your Appointment ID.</p>`);

  const text = [
    `Appointment Confirmed`, '',
    `Dear ${a.first_name} ${a.last_name},`, '',
    `Appointment ID: ${a.appointment_code}`,
    `Training program: ${programLabel(a)}`,
    `Date: ${date}`,
    `Time: ${time} (${a.duration_minutes} minutes)`,
    `Mode: ${a.mode === 'online' ? 'Online' : 'Offline'}`,
    a.counsellor_name ? `Counsellor: ${a.counsellor_name}` : '',
    where.text, '',
    `To change or cancel, contact us${contact ? ` at ${contact}` : ''} quoting your Appointment ID.`,
  ].filter((l) => l !== null).join('\n');

  await sendAdmissionFormEmail({
    toEmail: a.email,
    studentName: `${a.first_name} ${a.last_name}`,
    admissionFormUrl: '',
    subject: `Appointment Confirmed – ${a.appointment_code} on ${date} at ${time}`,
    text,
    html,
  });
}

export async function sendCounsellorNotification(a: AppointmentRow, counsellorEmail: string, kind: 'assigned' | 'rescheduled' | 'cancelled' = 'assigned') {
  const date = formatDateLong(a.appt_date);
  const time = formatTime12(a.start_time);
  const where = whereLines(a);
  const heading = kind === 'cancelled' ? 'Appointment Cancelled' : kind === 'rescheduled' ? 'Appointment Rescheduled' : 'New Counselling Appointment';

  const html = withEmailSignature(`
    <h2 style="margin:0 0 8px;color:#2E3093;font-size:20px;">${heading}</h2>
    <p>${kind === 'cancelled' ? 'The following appointment has been cancelled.' : 'A counselling appointment has been assigned to you.'}</p>
    <table style="border-collapse:collapse;margin:12px 0;font-size:14px;">
      ${row('Appointment ID', esc(a.appointment_code))}
      ${row('Applicant', esc(`${a.first_name} ${a.last_name}`))}
      ${row('Mobile', esc(a.mobile))}
      ${row('Email', esc(a.email))}
      ${row('Qualification', esc(a.qualification || '—'))}
      ${row('Experience', esc(a.experience || '—'))}
      ${row('Training program', esc(programLabel(a)))}
      ${row('Date', esc(date))}
      ${row('Time', `${esc(time)} (${a.duration_minutes} minutes)`)}
      ${row('Mode', a.mode === 'online' ? 'Online' : 'Offline')}
      ${where.html}
    </table>`);

  await sendAdmissionFormEmail({
    toEmail: counsellorEmail,
    admissionFormUrl: '',
    subject: `${heading} – ${a.first_name} ${a.last_name}, ${date} ${time}`,
    text: `${heading}\n\n${a.appointment_code}\n${a.first_name} ${a.last_name} (${a.mobile})\n${programLabel(a)}\n${date} ${time}\n${a.mode}\n${where.text}`,
    html,
  });
}

/** Send booking emails and record the outcome on the appointment row. */
export async function sendBookingEmails(a: AppointmentRow, settings: ApptSettings, counsellorEmail: string | null) {
  const pool = getPool();
  const errors: string[] = [];

  try {
    await sendApplicantConfirmation(a, settings);
    await pool.query(`UPDATE appointments SET applicant_email_sent_at = NOW() WHERE id = ?`, [a.id]);
  } catch (err) {
    errors.push(`applicant: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (counsellorEmail) {
    try {
      await sendCounsellorNotification(a, counsellorEmail, 'assigned');
      await pool.query(`UPDATE appointments SET counsellor_email_sent_at = NOW() WHERE id = ?`, [a.id]);
    } catch (err) {
      errors.push(`counsellor: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (errors.length) {
    console.error('[appointments] email failure', a.appointment_code, errors);
    await pool.query(`UPDATE appointments SET email_error = ? WHERE id = ?`, [errors.join(' | ').slice(0, 500), a.id]).catch(() => {});
  }
}
