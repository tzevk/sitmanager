/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { sanitizeStringMax } from '@/lib/validation';
import { ensureAppointmentTables } from '@/lib/appointments/schema';
import { loadCounsellors, loadSettings } from '@/lib/appointments/engine';
import { requireSettingsAccess } from '@/lib/appointments/http';
import { isValidTimeStr, nowLocal, parseWeekdays, toMinutes, weekdaysToCsv } from '@/lib/appointments/time';

/** GET — everything the Scheduling Settings page needs in one round-trip. */
export async function GET(req: NextRequest) {
  const auth = await requireSettingsAccess(req, false);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureAppointmentTables();
    const pool = getPool();
    const today = nowLocal().date;
    const [settings, counsellors, [breaks], [exceptions], [users], [employees]] = await Promise.all([
      loadSettings(pool),
      loadCounsellors(pool, false),
      pool.query(`SELECT id, label, TIME_FORMAT(start_time, '%H:%i') AS start_time, TIME_FORMAT(end_time, '%H:%i') AS end_time, weekdays, is_active FROM appt_breaks ORDER BY start_time`),
      pool.query(
        `SELECT id, DATE_FORMAT(exc_date, '%Y-%m-%d') AS exc_date, exc_type, label,
                TIME_FORMAT(start_time, '%H:%i') AS start_time, TIME_FORMAT(end_time, '%H:%i') AS end_time
         FROM appt_exceptions WHERE exc_date >= ? ORDER BY exc_date, start_time`,
        [today]
      ),
      pool.query(
        `SELECT id, TRIM(CONCAT(COALESCE(firstname, ''), ' ', COALESCE(lastname, ''))) AS name, email, mobile
         FROM awt_adminuser WHERE COALESCE(deleted, 0) = 0 ORDER BY firstname, lastname`
      ),
      pool.query(
        `SELECT Emp_Id, COALESCE(NULLIF(Employee_Name, ''), TRIM(CONCAT(COALESCE(FName, ''), ' ', COALESCE(LName, '')))) AS name
         FROM office_employee_mst WHERE COALESCE(IsDelete, 0) = 0 AND COALESCE(IsActive, 1) = 1 ORDER BY name`
      ).catch(() => [[]]),
    ]);
    return NextResponse.json({
      success: true,
      settings,
      counsellors,
      breaks,
      exceptions,
      users,
      employees: (employees as any[]).map((e) => ({ emp_id: e.Emp_Id, name: e.name })),
      canWrite: auth.permissions.includes('appointment_settings.manage'),
    });
  } catch (err) {
    console.error('[appointments] settings get:', err);
    return NextResponse.json({ success: false, error: 'Unable to load settings' }, { status: 500 });
  }
}

/** PUT — general availability. Takes the booking lock row so it can't interleave with a booking. */
export async function PUT(req: NextRequest) {
  const auth = await requireSettingsAccess(req, true);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureAppointmentTables();
    const body = await req.json().catch(() => ({}));
    const days = parseWeekdays(Array.isArray(body.working_days) ? body.working_days.join(',') : body.working_days);
    const start = String(body.start_time || '');
    const end = String(body.end_time || '');
    const slot = Number(body.slot_minutes);
    const windowDays = Number(body.booking_window_days);
    const notice = Number(body.min_notice_minutes);

    const errors: string[] = [];
    if (!days.size) errors.push('Select at least one working day');
    if (!isValidTimeStr(start) || !isValidTimeStr(end) || toMinutes(end) <= toMinutes(start)) errors.push('End time must be after start time');
    if (!Number.isInteger(slot) || slot < 10 || slot > 240) errors.push('Appointment duration must be 10–240 minutes');
    if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 180) errors.push('Booking window must be 1–180 days');
    if (!Number.isInteger(notice) || notice < 0 || notice > 2880) errors.push('Minimum notice must be 0–2880 minutes');
    if (errors.length) return NextResponse.json({ success: false, error: errors.join('. ') }, { status: 422 });

    await getPool().query(
      `UPDATE appt_settings SET working_days = ?, start_time = ?, end_time = ?, slot_minutes = ?, booking_window_days = ?,
         min_notice_minutes = ?, use_holiday_master = ?, office_address = ?, default_meeting_link = ?,
         contact_phone = ?, contact_email = ?, updated_by = ?
       WHERE id = 1`,
      [
        weekdaysToCsv(days), start, end, slot, windowDays, notice, body.use_holiday_master === false ? 0 : 1,
        sanitizeStringMax(body.office_address, 500) || null,
        sanitizeStringMax(body.default_meeting_link, 500) || null,
        sanitizeStringMax(body.contact_phone, 40) || null,
        sanitizeStringMax(body.contact_email, 120) || null,
        auth.session.userId,
      ]
    );
    return NextResponse.json({ success: true, settings: await loadSettings(getPool()) });
  } catch (err) {
    console.error('[appointments] settings put:', err);
    return NextResponse.json({ success: false, error: 'Unable to save settings' }, { status: 500 });
  }
}
