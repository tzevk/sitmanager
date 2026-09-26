/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { isValidEmail, sanitizeStringMax } from '@/lib/validation';
import { ensureAppointmentTables } from '@/lib/appointments/schema';
import { requireAuth } from '@/lib/api-auth';
import { requireSettingsAccess } from '@/lib/appointments/http';
import { isValidDateStr, isValidTimeStr, nowLocal, parseWeekdays, toMinutes, weekdaysToCsv } from '@/lib/appointments/time';

/**
 * Scheduling exceptions & counsellor configuration.
 *   /settings/breaks       POST (create/update) · DELETE ?id
 *   /settings/exceptions   POST (holiday / blocked date, whole-day or time range) · DELETE ?id
 *   /settings/counsellors  POST (enrol / update) · DELETE ?user_id (deactivate — history is kept)
 *   /settings/blocks       GET ?counsellor · POST · DELETE ?id
 *
 * Counsellors may manage THEIR OWN blocks (block time / leave) without the settings permission.
 * Every change here feeds the availability engine immediately — public slots update on next load.
 */

type Ctx = { params: Promise<{ kind: string }> };
const bad = (msg: string, status = 422) => NextResponse.json({ success: false, error: msg }, { status });
const BLOCK_TYPES = ['blocked', 'leave', 'task', 'unavailable'];

async function blocksAccess(req: NextRequest, counsellorId: number | null) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const admin = auth.permissions.includes('appointment_settings.manage');
  if (!admin && counsellorId !== null && counsellorId !== auth.session.userId) {
    return NextResponse.json({ success: false, error: 'You can only manage your own blocked time' }, { status: 403 });
  }
  return { ...auth, admin };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { kind } = await ctx.params;
  if (kind !== 'blocks') return bad('Not found', 404);
  const requested = Number(req.nextUrl.searchParams.get('counsellor')) || null;
  const auth = await blocksAccess(req, requested);
  if (auth instanceof NextResponse) return auth;
  await ensureAppointmentTables();
  const counsellorId = auth.admin ? requested : auth.session.userId;
  const [rows] = await getPool().query(
    `SELECT b.id, b.counsellor_user_id, c.display_name AS counsellor_name, b.start_at, b.end_at, b.block_type, b.reason
     FROM appt_counsellor_blocks b LEFT JOIN appt_counsellors c ON c.user_id = b.counsellor_user_id
     WHERE b.end_at >= ? ${counsellorId ? 'AND b.counsellor_user_id = ?' : ''}
     ORDER BY b.start_at LIMIT 500`,
    counsellorId ? [`${nowLocal().date} 00:00:00`, counsellorId] : [`${nowLocal().date} 00:00:00`]
  );
  return NextResponse.json({ success: true, blocks: rows });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { kind } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  await ensureAppointmentTables();
  const pool = getPool();

  if (kind === 'blocks') {
    const counsellorId = Number(body.counsellor_user_id);
    const auth = await blocksAccess(req, counsellorId || null);
    if (auth instanceof NextResponse) return auth;
    const targetId = auth.admin && counsellorId ? counsellorId : auth.session.userId;
    const startAt = `${body.start_date} ${body.start_time || '00:00'}:00`;
    const endAt = `${body.end_date || body.start_date} ${body.end_time || '23:59'}:00`;
    if (!isValidDateStr(body.start_date) || !isValidDateStr(body.end_date || body.start_date)) return bad('Select valid dates');
    if ((body.start_time && !isValidTimeStr(body.start_time)) || (body.end_time && !isValidTimeStr(body.end_time))) return bad('Enter valid times');
    if (endAt <= startAt) return bad('End must be after start');
    const type = BLOCK_TYPES.includes(body.block_type) ? body.block_type : 'blocked';
    const [exists] = await pool.query(`SELECT 1 FROM appt_counsellors WHERE user_id = ?`, [targetId]);
    if (!(exists as any[]).length) return bad('This user is not set up as a counsellor');
    const [res] = await pool.query(
      `INSERT INTO appt_counsellor_blocks (counsellor_user_id, start_at, end_at, block_type, reason, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [targetId, startAt, endAt, type, sanitizeStringMax(body.reason, 255) || null, auth.session.userId]
    );
    // Booked appointments inside the new block are NOT auto-cancelled — surface them so staff can reassign.
    const [clashes] = await pool.query(
      `SELECT id, appointment_code, first_name, last_name, DATE_FORMAT(appt_date, '%Y-%m-%d') AS appt_date, TIME_FORMAT(start_time, '%H:%i') AS start_time
       FROM appointments WHERE counsellor_user_id = ? AND status = 'Scheduled'
         AND TIMESTAMP(appt_date, start_time) < ? AND TIMESTAMP(appt_date, end_time) > ?`,
      [targetId, endAt, startAt]
    );
    return NextResponse.json({ success: true, id: (res as any).insertId, clashes });
  }

  const auth = await requireSettingsAccess(req, true);
  if (auth instanceof NextResponse) return auth;

  if (kind === 'breaks') {
    const start = String(body.start_time || '');
    const end = String(body.end_time || '');
    if (!isValidTimeStr(start) || !isValidTimeStr(end) || toMinutes(end) <= toMinutes(start)) return bad('End time must be after start time');
    const days = body.weekdays && (Array.isArray(body.weekdays) ? body.weekdays.length : String(body.weekdays).length)
      ? weekdaysToCsv(parseWeekdays(Array.isArray(body.weekdays) ? body.weekdays.join(',') : body.weekdays)) || null
      : null;
    const values = [sanitizeStringMax(body.label, 100) || 'Break', start, end, days, body.is_active === false ? 0 : 1];
    if (Number(body.id)) {
      await pool.query(`UPDATE appt_breaks SET label = ?, start_time = ?, end_time = ?, weekdays = ?, is_active = ? WHERE id = ?`, [...values, Number(body.id)]);
    } else {
      await pool.query(`INSERT INTO appt_breaks (label, start_time, end_time, weekdays, is_active) VALUES (?, ?, ?, ?, ?)`, values);
    }
    return NextResponse.json({ success: true });
  }

  if (kind === 'exceptions') {
    const from = String(body.date || '');
    const to = String(body.end_date || body.date || '');
    if (!isValidDateStr(from) || !isValidDateStr(to) || to < from) return bad('Select a valid date range');
    const partial = Boolean(body.start_time || body.end_time);
    if (partial && (!isValidTimeStr(body.start_time) || !isValidTimeStr(body.end_time) || toMinutes(body.end_time) <= toMinutes(body.start_time))) {
      return bad('End time must be after start time');
    }
    const type = body.exc_type === 'holiday' ? 'holiday' : 'blocked';
    const label = sanitizeStringMax(body.label, 150) || null;
    let count = 0;
    for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to && count < 366; d.setUTCDate(d.getUTCDate() + 1), count++) {
      await pool.query(
        `INSERT INTO appt_exceptions (exc_date, exc_type, label, start_time, end_time, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
        [d.toISOString().slice(0, 10), type, label, partial ? body.start_time : null, partial ? body.end_time : null, auth.session.userId]
      );
    }
    return NextResponse.json({ success: true, created: count });
  }

  if (kind === 'counsellors') {
    const userId = Number(body.user_id);
    if (!(userId > 0)) return bad('Select a user');
    const [users] = await pool.query(
      `SELECT id, TRIM(CONCAT(COALESCE(firstname, ''), ' ', COALESCE(lastname, ''))) AS name, email, mobile FROM awt_adminuser WHERE id = ? AND COALESCE(deleted, 0) = 0`,
      [userId]
    );
    const user = (users as any[])[0];
    if (!user) return bad('User not found');
    const custom = Boolean(body.use_custom_hours);
    if (custom) {
      if (!isValidTimeStr(body.start_time) || !isValidTimeStr(body.end_time) || toMinutes(body.end_time) <= toMinutes(body.start_time)) {
        return bad('Personal end time must be after start time');
      }
      if (!parseWeekdays(Array.isArray(body.working_days) ? body.working_days.join(',') : body.working_days).size) return bad('Select at least one personal working day');
    }
    const email = sanitizeStringMax(body.email, 150) || user.email || null;
    if (email && !isValidEmail(email)) return bad('Enter a valid email for notifications');
    const modes = ['both', 'online', 'offline'].includes(body.modes) ? body.modes : 'both';
    const days = custom ? weekdaysToCsv(parseWeekdays(Array.isArray(body.working_days) ? body.working_days.join(',') : body.working_days)) : null;

    await pool.query(
      `INSERT INTO appt_counsellors
         (user_id, emp_id, display_name, email, phone, is_active, modes, use_custom_hours, working_days, start_time, end_time, meeting_link)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE emp_id = VALUES(emp_id), display_name = VALUES(display_name), email = VALUES(email),
         phone = VALUES(phone), is_active = VALUES(is_active), modes = VALUES(modes), use_custom_hours = VALUES(use_custom_hours),
         working_days = VALUES(working_days), start_time = VALUES(start_time), end_time = VALUES(end_time), meeting_link = VALUES(meeting_link)`,
      [
        userId, Number(body.emp_id) || null, sanitizeStringMax(body.display_name, 150) || user.name || `User ${userId}`,
        email, sanitizeStringMax(body.phone, 40) || user.mobile || null, body.is_active === false ? 0 : 1, modes,
        custom ? 1 : 0, days, custom ? body.start_time : null, custom ? body.end_time : null,
        sanitizeStringMax(body.meeting_link, 500) || null,
      ]
    );
    return NextResponse.json({ success: true });
  }

  return bad('Not found', 404);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { kind } = await ctx.params;
  const p = req.nextUrl.searchParams;
  await ensureAppointmentTables();
  const pool = getPool();

  if (kind === 'blocks') {
    const id = Number(p.get('id'));
    const [rows] = await pool.query(`SELECT counsellor_user_id FROM appt_counsellor_blocks WHERE id = ?`, [id]);
    const row = (rows as any[])[0];
    if (!row) return bad('Not found', 404);
    const auth = await blocksAccess(req, Number(row.counsellor_user_id));
    if (auth instanceof NextResponse) return auth;
    await pool.query(`DELETE FROM appt_counsellor_blocks WHERE id = ?`, [id]);
    return NextResponse.json({ success: true });
  }

  const auth = await requireSettingsAccess(req, true);
  if (auth instanceof NextResponse) return auth;

  if (kind === 'breaks') {
    await pool.query(`DELETE FROM appt_breaks WHERE id = ?`, [Number(p.get('id'))]);
    return NextResponse.json({ success: true });
  }
  if (kind === 'exceptions') {
    await pool.query(`DELETE FROM appt_exceptions WHERE id = ?`, [Number(p.get('id'))]);
    return NextResponse.json({ success: true });
  }
  if (kind === 'counsellors') {
    // Deactivate only — appointments keep their counsellor reference and history.
    await pool.query(`UPDATE appt_counsellors SET is_active = 0 WHERE user_id = ?`, [Number(p.get('user_id'))]);
    return NextResponse.json({ success: true });
  }
  return bad('Not found', 404);
}
