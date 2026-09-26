/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomBytes } from 'crypto';
import type mysql from 'mysql2/promise';
import { getPool } from '@/lib/db';
import { isValidEmail, sanitizeStringMax } from '@/lib/validation';
import { ensureAppointmentTables } from '@/lib/appointments/schema';
import {
  ApptMode, ApptSettings, BOOKABILITY_MESSAGES, isCounsellorFree, loadCounsellors, loadDayContext,
  loadSettings, pickCounsellor, validateSlot,
} from '@/lib/appointments/engine';
import { formatDateLong, formatTime12, fromMinutes, isValidDateStr, isValidTimeStr, nowLocal, toMinutes } from '@/lib/appointments/time';

/**
 * Appointment service — every write that touches slot occupancy goes through
 * withBookingLock(), which:
 *   1. opens a transaction
 *   2. takes SELECT … FOR UPDATE on appt_settings(id=1)  ← global booking mutex
 *   3. reloads availability from the DB (never trusts the client)
 *   4. writes, relying on the UNIQUE slot_guard as a final safety net
 */

export type ApptStatus = 'Scheduled' | 'Completed' | 'No Show' | 'Cancelled';
export const APPT_STATUSES: ApptStatus[] = ['Scheduled', 'Completed', 'No Show', 'Cancelled'];

/** Allowed status transitions. Reschedule/reassign are separate actions. */
export const STATUS_TRANSITIONS: Record<ApptStatus, ApptStatus[]> = {
  'Scheduled': ['Completed', 'No Show', 'Cancelled'],
  'Completed': ['No Show'],        // correction
  'No Show': ['Completed', 'Cancelled'], // correction / close out
  'Cancelled': [],
};

export interface AppointmentRow {
  id: number;
  appointment_code: string;
  public_token: string;
  first_name: string;
  last_name: string;
  mobile: string;
  email: string;
  qualification: string | null;
  experience: string | null;
  course_id: number | null;
  program_name: string | null;
  needs_guidance: number;
  mode: ApptMode;
  appt_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  counsellor_user_id: number | null;
  counsellor_name: string | null;
  status: ApptStatus;
  meeting_link: string | null;
  location: string | null;
  notes: string | null;
  reschedule_count: number;
  source: string;
  applicant_email_sent_at: string | null;
  counsellor_email_sent_at: string | null;
  email_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Actor { userId: number | null; name: string }

export class AppointmentError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'invalid') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const SELECT_APPT = `
  SELECT a.*, TIME_FORMAT(a.start_time, '%H:%i') AS start_time, TIME_FORMAT(a.end_time, '%H:%i') AS end_time,
         c.display_name AS counsellor_name
  FROM appointments a
  LEFT JOIN appt_counsellors c ON c.user_id = a.counsellor_user_id`;

function slotGuard(counsellorId: number, date: string, start: string) {
  return `${counsellorId}|${date}|${start.slice(0, 5)}`;
}

// ── Transaction + lock ────────────────────────────────────────────────

export async function withBookingLock<T>(fn: (conn: mysql.PoolConnection, settings: ApptSettings) => Promise<T>): Promise<T> {
  await ensureAppointmentTables();
  const conn = await getPool().getConnection();
  try {
    await conn.query('SET SESSION innodb_lock_wait_timeout = 15');
    await conn.beginTransaction();
    await conn.query('SELECT id FROM appt_settings WHERE id = 1 FOR UPDATE');
    const settings = await loadSettings(conn);
    const result = await fn(conn, settings);
    await conn.commit();
    return result;
  } catch (err: any) {
    await conn.rollback().catch(() => {});
    if (err?.code === 'ER_DUP_ENTRY' && String(err?.message || '').includes('slot_guard')) {
      throw new AppointmentError(BOOKABILITY_MESSAGES.no_counsellor, 409, 'slot_taken');
    }
    if (err?.code === 'ER_LOCK_WAIT_TIMEOUT') {
      throw new AppointmentError('The booking system is busy. Please try again in a moment.', 503, 'busy');
    }
    throw err;
  } finally {
    conn.release();
  }
}

export async function nextAppointmentCode(conn: mysql.PoolConnection): Promise<string> {
  const today = nowLocal().date;
  await conn.query(
    `INSERT INTO appt_code_counters (day, seq) VALUES (?, 1) ON DUPLICATE KEY UPDATE seq = seq + 1`,
    [today]
  );
  const [rows] = await conn.query(`SELECT seq FROM appt_code_counters WHERE day = ?`, [today]);
  const seq = Number((rows as any[])[0]?.seq ?? 1);
  return `APT-${today.replace(/-/g, '')}-${String(seq).padStart(3, '0')}`;
}

export async function addHistory(db: Pick<mysql.Pool, 'query'>, appointmentId: number, action: string, from: string | null, to: string | null, actor: Actor | null, note?: string | null) {
  await db.query(
    `INSERT INTO appointment_history (appointment_id, action, from_value, to_value, note, actor_user_id, actor_name)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [appointmentId, action, from, to, note ?? null, actor?.userId ?? null, actor?.name ?? 'Public booking']
  );
}

export async function fetchAppointment(db: Pick<mysql.Pool, 'query'>, id: number): Promise<AppointmentRow | null> {
  const [rows] = await db.query(`${SELECT_APPT} WHERE a.id = ? LIMIT 1`, [id]);
  return ((rows as any[])[0] as AppointmentRow) ?? null;
}

async function lockAppointment(conn: mysql.PoolConnection, id: number): Promise<AppointmentRow> {
  await conn.query(`SELECT id FROM appointments WHERE id = ? FOR UPDATE`, [id]);
  const appt = await fetchAppointment(conn, id);
  if (!appt) throw new AppointmentError('Appointment not found', 404, 'not_found');
  return appt;
}

// ── Task + counsellor bookkeeping ─────────────────────────────────────

/** Create / update the counsellor's staff_tasks entry mirroring this appointment. */
export async function syncTask(db: Pick<mysql.Pool, 'query'>, a: AppointmentRow, actor: Actor | null) {
  if (!a.counsellor_user_id) return;
  const program = a.needs_guidance ? 'Needs guidance' : (a.program_name || '—');
  const title = `Counselling Appointment – ${a.first_name} ${a.last_name}`;
  const details = [
    `Date: ${formatDateLong(a.appt_date)}`,
    `Time: ${formatTime12(a.start_time)}`,
    `Duration: ${a.duration_minutes} minutes`,
    `Program: ${program}`,
    `Mode: ${a.mode === 'online' ? 'Online' : 'Offline'}`,
    `Appointment ID: ${a.appointment_code}`,
    `Mobile: ${a.mobile}`,
  ].join('\n');
  const status = a.status === 'Scheduled' ? 'open' : a.status === 'Cancelled' ? 'cancelled' : 'done';

  const [rows] = await db.query(
    `SELECT id FROM staff_tasks WHERE source_type = 'appointment' AND source_id = ? LIMIT 1`,
    [a.id]
  );
  const existing = (rows as any[])[0];
  if (existing) {
    await db.query(
      `UPDATE staff_tasks SET owner_user_id = ?, title = ?, details = ?, due_date = ?, due_time = ?, duration_minutes = ?, status = ?
       WHERE id = ?`,
      [a.counsellor_user_id, title, details, a.appt_date, a.start_time, a.duration_minutes, status, existing.id]
    );
  } else {
    await db.query(
      `INSERT INTO staff_tasks (owner_user_id, title, details, due_date, due_time, duration_minutes, status, source_type, source_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'appointment', ?, ?)`,
      [a.counsellor_user_id, title, details, a.appt_date, a.start_time, a.duration_minutes, status, a.id, actor?.userId ?? null]
    );
  }
}

export async function touchCounsellor(db: Pick<mysql.Pool, 'query'>, userId: number) {
  await db.query(`UPDATE appt_counsellors SET last_assigned_at = NOW(6) WHERE user_id = ?`, [userId]);
}

async function counsellorEmail(db: Pick<mysql.Pool, 'query'>, userId: number | null): Promise<string | null> {
  if (!userId) return null;
  const [rows] = await db.query(`SELECT email FROM appt_counsellors WHERE user_id = ?`, [userId]);
  const email = (rows as any[])[0]?.email;
  return email && isValidEmail(email) ? String(email) : null;
}

// ── Input validation ──────────────────────────────────────────────────

export interface BookingInput {
  first_name: string;
  last_name: string;
  mobile: string;
  email: string;
  qualification: string;
  experience: string;
  course_id: number | null;
  needs_guidance: boolean;
  mode: ApptMode;
  date: string;
  time: string;
  notes?: string;
}

export function parseBookingInput(body: any): { input: BookingInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const mobile = sanitizeStringMax(body?.mobile, 20).replace(/[\s\-()]/g, '');
  const courseRaw = body?.course_id;
  const needsGuidance = body?.needs_guidance === true || courseRaw === 'guidance';
  const courseId = needsGuidance ? null : Number(courseRaw);
  const input: BookingInput = {
    first_name: sanitizeStringMax(body?.first_name, 80),
    last_name: sanitizeStringMax(body?.last_name, 80),
    mobile,
    email: sanitizeStringMax(body?.email, 150).toLowerCase(),
    qualification: sanitizeStringMax(body?.qualification, 120),
    experience: sanitizeStringMax(body?.experience, 80),
    course_id: Number.isInteger(courseId) && (courseId as number) > 0 ? (courseId as number) : null,
    needs_guidance: needsGuidance,
    mode: body?.mode === 'online' ? 'online' : 'offline',
    date: String(body?.date ?? ''),
    time: String(body?.time ?? '').slice(0, 5),
    notes: sanitizeStringMax(body?.notes, 1000) || undefined,
  };

  if (!input.first_name) errors.first_name = 'First name is required';
  if (!input.last_name) errors.last_name = 'Last name is required';
  if (!/^\+?\d{10,15}$/.test(input.mobile)) errors.mobile = 'Enter a valid mobile number';
  if (!isValidEmail(input.email)) errors.email = 'Enter a valid email address';
  if (!input.qualification) errors.qualification = 'Qualification is required';
  if (!input.experience) errors.experience = 'Work experience is required';
  if (!input.needs_guidance && !input.course_id) errors.course_id = 'Select a training program or "Need guidance"';
  if (body?.mode !== 'online' && body?.mode !== 'offline') errors.mode = 'Choose Online or Offline';
  if (!isValidDateStr(input.date)) errors.date = 'Select a date';
  if (!isValidTimeStr(input.time)) errors.time = 'Select a time slot';
  return { input, errors };
}

async function resolveProgram(db: Pick<mysql.Pool, 'query'>, courseId: number | null): Promise<string | null> {
  if (!courseId) return null;
  const [rows] = await db.query(
    `SELECT Course_Name FROM course_mst WHERE Course_Id = ? AND COALESCE(IsDelete, 0) = 0 LIMIT 1`,
    [courseId]
  );
  const name = (rows as any[])[0]?.Course_Name;
  if (!name) throw new AppointmentError('Selected training program is not available', 400, 'invalid_course');
  return String(name);
}

// ── Create ────────────────────────────────────────────────────────────

export async function createAppointment(
  input: BookingInput,
  opts: { source: 'public' | 'internal'; actor: Actor | null; clientIp?: string | null; counsellorUserId?: number | null }
): Promise<{ appointment: AppointmentRow; settings: ApptSettings; counsellorEmail: string | null }> {
  await ensureAppointmentTables();
  const programName = await resolveProgram(getPool(), input.course_id);
  const isPublic = opts.source === 'public';

  return withBookingLock(async (conn, settings) => {
    // 1. Re-validate the slot server-side against fresh data, inside the lock.
    const ctx = await loadDayContext(conn, input.date, { settings });
    const check = validateSlot(ctx, input.time, input.mode, { enforcePublicWindow: isPublic, enforceNotice: isPublic });
    if (!check.ok) throw new AppointmentError(BOOKABILITY_MESSAGES[check.error], 409, check.error);

    // 2–3. Eligible counsellors → fair pick (or an explicit internal choice).
    let counsellor = check.eligible[0];
    if (opts.counsellorUserId) {
      const chosen = check.eligible.find((c) => c.user_id === opts.counsellorUserId);
      if (!chosen) throw new AppointmentError('That counsellor is not available for this slot', 409, 'counsellor_busy');
      counsellor = chosen;
    } else {
      counsellor = await pickCounsellor(conn, input.date, check.eligible);
    }

    // 4–5. Create the appointment (slot_guard reserves the slot).
    const code = await nextAppointmentCode(conn);
    const start = fromMinutes(check.start);
    const end = fromMinutes(check.end);
    const meetingLink = input.mode === 'online' ? (counsellor.meeting_link || settings.default_meeting_link || null) : null;
    const location = input.mode === 'offline' ? (settings.office_address || null) : null;

    const [res] = await conn.query(
      `INSERT INTO appointments
        (appointment_code, public_token, first_name, last_name, mobile, email, qualification, experience,
         course_id, program_name, needs_guidance, mode, appt_date, start_time, end_time, duration_minutes,
         counsellor_user_id, status, slot_guard, meeting_link, location, notes, source, client_ip, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?, ?, ?, ?, ?, ?, ?)`,
      [
        code, randomBytes(16).toString('hex'), input.first_name, input.last_name, input.mobile, input.email,
        input.qualification || null, input.experience || null, input.course_id, programName,
        input.needs_guidance ? 1 : 0, input.mode, input.date, start, end, check.end - check.start,
        counsellor.user_id, slotGuard(counsellor.user_id, input.date, start), meetingLink, location,
        input.notes ?? null, opts.source, opts.clientIp ?? null, opts.actor?.userId ?? null,
      ]
    );
    const id = Number((res as any).insertId);

    await touchCounsellor(conn, counsellor.user_id);
    await addHistory(conn, id, 'created', null, `${input.date} ${start} · ${counsellor.display_name}`, opts.actor);

    const appointment = (await fetchAppointment(conn, id))!;
    // 6. Counsellor's calendar/task entry.
    await syncTask(conn, appointment, opts.actor);

    return { appointment, settings, counsellorEmail: counsellor.email && isValidEmail(counsellor.email) ? counsellor.email : null };
  });
}

// ── Read ──────────────────────────────────────────────────────────────

export interface Scope { all: boolean; userId: number }

export async function getAppointment(id: number, scope: Scope) {
  await ensureAppointmentTables();
  const pool = getPool();
  const appt = await fetchAppointment(pool, id);
  if (!appt || (!scope.all && appt.counsellor_user_id !== scope.userId)) return null;
  const [history] = await pool.query(
    `SELECT id, action, from_value, to_value, note, actor_name, created_at
     FROM appointment_history WHERE appointment_id = ? ORDER BY created_at DESC, id DESC`,
    [id]
  );
  return { appointment: appt, history: history as any[] };
}

export interface ListFilters {
  from?: string;
  to?: string;
  counsellor?: number;
  course_id?: number;
  mode?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listAppointments(filters: ListFilters, scope: Scope) {
  await ensureAppointmentTables();
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (!scope.all) { where.push('a.counsellor_user_id = ?'); params.push(scope.userId); }
  else if (filters.counsellor) { where.push('a.counsellor_user_id = ?'); params.push(filters.counsellor); }
  if (filters.from && isValidDateStr(filters.from)) { where.push('a.appt_date >= ?'); params.push(filters.from); }
  if (filters.to && isValidDateStr(filters.to)) { where.push('a.appt_date <= ?'); params.push(filters.to); }
  if (filters.course_id === -1) where.push('a.needs_guidance = 1');
  else if (filters.course_id) { where.push('a.course_id = ?'); params.push(filters.course_id); }
  if (filters.mode === 'online' || filters.mode === 'offline') { where.push('a.mode = ?'); params.push(filters.mode); }
  if (filters.status && (APPT_STATUSES as string[]).includes(filters.status)) { where.push('a.status = ?'); params.push(filters.status); }
  if (filters.search?.trim()) {
    const like = `%${filters.search.trim()}%`;
    where.push(`(a.appointment_code LIKE ? OR a.first_name LIKE ? OR a.last_name LIKE ? OR CONCAT(a.first_name, ' ', a.last_name) LIKE ? OR a.mobile LIKE ? OR a.email LIKE ?)`);
    params.push(like, like, like, like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 1000);
  const page = Math.max(filters.page ?? 1, 1);
  const pool = getPool();

  const [[countRows], [rows]] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS total FROM appointments a ${whereSql}`, params),
    pool.query(
      `${SELECT_APPT} ${whereSql} ORDER BY a.appt_date DESC, a.start_time DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params
    ),
  ]);
  return { rows: rows as AppointmentRow[], total: Number((countRows as any[])[0]?.total ?? 0), page, limit };
}

export async function calendarAppointments(from: string, to: string, filters: ListFilters, scope: Scope) {
  const { rows } = await listAppointments({ ...filters, from, to, page: 1, limit: 1000 }, scope);
  return rows.sort((a, b) => (a.appt_date + a.start_time).localeCompare(b.appt_date + b.start_time));
}

// ── Mutations ─────────────────────────────────────────────────────────

function assertOwned(appt: AppointmentRow, scope: Scope) {
  if (!scope.all && appt.counsellor_user_id !== scope.userId) {
    throw new AppointmentError('You can only change your own appointments', 403, 'forbidden');
  }
}

export async function rescheduleAppointment(
  id: number, date: string, time: string, mode: ApptMode | null, scope: Scope, actor: Actor, note?: string
) {
  if (!isValidDateStr(date) || !isValidTimeStr(time)) throw new AppointmentError('Select a valid date and time');

  const result = await withBookingLock(async (conn, settings) => {
    const appt = await lockAppointment(conn, id);
    assertOwned(appt, scope);
    if (!['Scheduled', 'No Show'].includes(appt.status)) {
      throw new AppointmentError(`A ${appt.status.toLowerCase()} appointment cannot be rescheduled`, 409, 'bad_state');
    }
    const newMode = mode ?? appt.mode;
    const ctx = await loadDayContext(conn, date, { settings, excludeAppointmentId: id });
    const check = validateSlot(ctx, time, newMode, { enforcePublicWindow: false, enforceNotice: false, duration: appt.duration_minutes });
    if (!check.ok) throw new AppointmentError(BOOKABILITY_MESSAGES[check.error], 409, check.error);

    // Keep the same counsellor when possible (continuity); otherwise fair-assign.
    const keep = check.eligible.find((c) => c.user_id === appt.counsellor_user_id);
    const counsellor = keep ?? (await pickCounsellor(conn, date, check.eligible));
    const start = fromMinutes(check.start);
    const end = fromMinutes(check.end);
    const meetingLink = newMode === 'online' ? (appt.meeting_link || counsellor.meeting_link || settings.default_meeting_link || null) : null;
    const location = newMode === 'offline' ? (appt.location || settings.office_address || null) : null;

    await conn.query(
      `UPDATE appointments SET appt_date = ?, start_time = ?, end_time = ?, mode = ?, counsellor_user_id = ?,
         status = 'Scheduled', slot_guard = ?, meeting_link = ?, location = ?, reschedule_count = reschedule_count + 1
       WHERE id = ?`,
      [date, start, end, newMode, counsellor.user_id, slotGuard(counsellor.user_id, date, start), meetingLink, location, id]
    );
    await addHistory(conn, id, 'rescheduled', `${appt.appt_date} ${appt.start_time}`, `${date} ${start}`, actor, note);
    if (newMode !== appt.mode) await addHistory(conn, id, 'edited', `mode: ${appt.mode}`, `mode: ${newMode}`, actor);
    if (appt.status !== 'Scheduled') await addHistory(conn, id, 'status', appt.status, 'Scheduled', actor);
    if (counsellor.user_id !== appt.counsellor_user_id) {
      await addHistory(conn, id, 'reassigned', appt.counsellor_name, counsellor.display_name, actor, 'Previous counsellor unavailable at new time');
      await touchCounsellor(conn, counsellor.user_id);
    }
    const updated = (await fetchAppointment(conn, id))!;
    await syncTask(conn, updated, actor);
    return { updated, previousCounsellor: appt.counsellor_user_id };
  });
  return result;
}

export async function reassignAppointment(id: number, counsellorUserId: number | 'auto', scope: Scope, actor: Actor, note?: string) {
  if (!scope.all) throw new AppointmentError('Only admins can reassign appointments', 403, 'forbidden');
  return withBookingLock(async (conn, settings) => {
    const appt = await lockAppointment(conn, id);
    if (appt.status !== 'Scheduled') throw new AppointmentError('Only scheduled appointments can be reassigned', 409, 'bad_state');

    const ctx = await loadDayContext(conn, appt.appt_date, { settings, excludeAppointmentId: id });
    const start = toMinutes(appt.start_time);
    const end = start + appt.duration_minutes;
    const eligible = ctx.counsellors.filter(
      (c) => c.user_id !== appt.counsellor_user_id && isCounsellorFree(ctx, c, start, end, appt.mode)
    );
    let target;
    if (counsellorUserId === 'auto') {
      if (!eligible.length) throw new AppointmentError('No other counsellor is free for this slot', 409, 'no_counsellor');
      target = await pickCounsellor(conn, appt.appt_date, eligible);
    } else {
      target = eligible.find((c) => c.user_id === counsellorUserId);
      if (!target) throw new AppointmentError('That counsellor is not available for this slot', 409, 'counsellor_busy');
    }

    const meetingLink = appt.mode === 'online' ? (target.meeting_link || settings.default_meeting_link || appt.meeting_link) : appt.meeting_link;
    await conn.query(
      `UPDATE appointments SET counsellor_user_id = ?, slot_guard = ?, meeting_link = ? WHERE id = ?`,
      [target.user_id, slotGuard(target.user_id, appt.appt_date, appt.start_time), meetingLink, id]
    );
    await touchCounsellor(conn, target.user_id);
    await addHistory(conn, id, 'reassigned', appt.counsellor_name, target.display_name, actor, note);
    const updated = (await fetchAppointment(conn, id))!;
    await syncTask(conn, updated, actor);
    return { updated, previousCounsellor: appt.counsellor_user_id };
  });
}

export async function setAppointmentStatus(id: number, status: ApptStatus, scope: Scope, actor: Actor, note?: string) {
  if (!APPT_STATUSES.includes(status)) throw new AppointmentError('Invalid status');
  await ensureAppointmentTables();
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const appt = await lockAppointment(conn, id);
    assertOwned(appt, scope);
    if (appt.status === status) { await conn.rollback(); return appt; }
    if (!STATUS_TRANSITIONS[appt.status].includes(status)) {
      throw new AppointmentError(`Cannot change status from ${appt.status} to ${status}`, 409, 'bad_transition');
    }
    if (status === 'No Show') {
      const now = nowLocal();
      if (appt.appt_date > now.date || (appt.appt_date === now.date && toMinutes(appt.start_time) > now.minutes)) {
        throw new AppointmentError('An appointment cannot be marked No Show before it starts', 409, 'too_early');
      }
    }
    // Cancelled releases the slot; other statuses keep occupying it.
    await conn.query(
      `UPDATE appointments SET status = ?, slot_guard = ${status === 'Cancelled' ? 'NULL' : 'slot_guard'} WHERE id = ?`,
      [status, id]
    );
    await addHistory(conn, id, 'status', appt.status, status, actor, note);
    const updated = (await fetchAppointment(conn, id))!;
    await syncTask(conn, updated, actor);
    await conn.commit();
    return updated;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

const EDITABLE_FIELDS = ['first_name', 'last_name', 'mobile', 'email', 'qualification', 'experience', 'notes', 'meeting_link', 'location'] as const;

export async function editAppointment(id: number, body: any, scope: Scope, actor: Actor) {
  await ensureAppointmentTables();
  const pool = getPool();
  const appt = await fetchAppointment(pool, id);
  if (!appt) throw new AppointmentError('Appointment not found', 404, 'not_found');
  assertOwned(appt, scope);

  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  const changed: string[] = [];
  for (const f of EDITABLE_FIELDS) {
    if (body?.[f] === undefined) continue;
    const value = sanitizeStringMax(body[f], f === 'notes' ? 2000 : 500) || null;
    if ((f === 'first_name' || f === 'last_name' || f === 'mobile' || f === 'email') && !value) {
      throw new AppointmentError(`${f.replace('_', ' ')} cannot be empty`);
    }
    if (f === 'email' && value && !isValidEmail(value)) throw new AppointmentError('Enter a valid email address');
    if (value !== ((appt as any)[f] ?? null)) { sets.push(`${f} = ?`); params.push(value); changed.push(f); }
  }
  if (body?.course_id !== undefined) {
    const guidance = body.course_id === 'guidance' || body.course_id === null;
    const courseId = guidance ? null : Number(body.course_id);
    const programName = guidance ? null : await resolveProgram(pool, courseId);
    if (courseId !== appt.course_id || (guidance ? 1 : 0) !== Number(appt.needs_guidance)) {
      sets.push('course_id = ?', 'program_name = ?', 'needs_guidance = ?');
      params.push(courseId, programName, guidance ? 1 : 0);
      changed.push('program');
    }
  }
  if (!sets.length) return appt;

  await pool.query(`UPDATE appointments SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  await addHistory(pool, id, 'edited', null, changed.join(', '), actor);
  const updated = (await fetchAppointment(pool, id))!;
  await syncTask(pool, updated, actor);
  return updated;
}

export { counsellorEmail as getCounsellorEmail };

// ── Widget summary ────────────────────────────────────────────────────

export async function appointmentSummary(scope: Scope) {
  await ensureAppointmentTables();
  const pool = getPool();
  const now = nowLocal();
  const nowTime = fromMinutes(now.minutes);
  const scopeSql = scope.all ? '' : 'AND a.counsellor_user_id = ?';
  const scopeParams = scope.all ? [] : [scope.userId];

  const [[countRows], [nextRows], [todayRows]] = await Promise.all([
    pool.query(
      `SELECT
         SUM(a.status <> 'Cancelled') AS total,
         SUM(a.status = 'Scheduled' AND a.start_time > ?) AS upcoming,
         SUM(a.status = 'Scheduled' AND a.start_time <= ?) AS pending,
         SUM(a.status = 'Completed') AS completed,
         SUM(a.status = 'No Show') AS no_show,
         SUM(a.status = 'Cancelled') AS cancelled
       FROM appointments a WHERE a.appt_date = ? ${scopeSql}`,
      [nowTime, nowTime, now.date, ...scopeParams]
    ),
    pool.query(
      `${SELECT_APPT}
       WHERE a.status = 'Scheduled' AND (a.appt_date > ? OR (a.appt_date = ? AND a.start_time >= ?)) ${scopeSql}
       ORDER BY a.appt_date, a.start_time LIMIT 1`,
      [now.date, now.date, nowTime, ...scopeParams]
    ),
    pool.query(
      `${SELECT_APPT} WHERE a.appt_date = ? AND a.status <> 'Cancelled' ${scopeSql} ORDER BY a.start_time LIMIT 12`,
      [now.date, ...scopeParams]
    ),
  ]);
  const c = (countRows as any[])[0] ?? {};
  return {
    date: now.date,
    now: nowTime,
    counts: {
      total: Number(c.total) || 0,
      upcoming: Number(c.upcoming) || 0,
      pending: Number(c.pending) || 0,
      completed: Number(c.completed) || 0,
      no_show: Number(c.no_show) || 0,
      cancelled: Number(c.cancelled) || 0,
    },
    next: ((nextRows as any[])[0] as AppointmentRow) ?? null,
    today: todayRows as AppointmentRow[],
  };
}

// ── Reminders (in-app, 30 minutes before) ─────────────────────────────

const REMINDER_LEAD_MINUTES = 30;

function reminderKey(a: { id: number; appt_date: string; start_time: string; counsellor_user_id: number | null }, channel = 'in_app') {
  return `appt:${a.id}:${a.appt_date}T${String(a.start_time).slice(0, 5)}:c${a.counsellor_user_id}:r${REMINDER_LEAD_MINUTES}:${channel}`;
}

/**
 * Materialise due reminders for a counsellor (idempotent via the UNIQUE
 * dedupe_key) and return the unread ones still relevant. The key embeds the
 * date/time/counsellor, so a reschedule or reassignment re-arms the reminder
 * while stale ones stop matching and disappear.
 *
 * Future email/SMS/WhatsApp reminders: insert rows with a different `channel`
 * and let a cron dispatcher send + set delivered_at.
 */
export async function pollReminders(userId: number) {
  await ensureAppointmentTables();
  const pool = getPool();
  const now = nowLocal();
  const nowTime = fromMinutes(now.minutes);
  const leadTime = fromMinutes(Math.min(now.minutes + REMINDER_LEAD_MINUTES, 1439));

  const [due] = await pool.query(
    `${SELECT_APPT}
     WHERE a.counsellor_user_id = ? AND a.status = 'Scheduled' AND a.appt_date = ?
       AND a.start_time >= ? AND a.start_time <= ?`,
    [userId, now.date, nowTime, leadTime]
  );
  for (const a of due as AppointmentRow[]) {
    const program = a.needs_guidance ? 'Needs guidance' : (a.program_name || '—');
    await pool.query(
      `INSERT IGNORE INTO staff_notifications
         (user_id, channel, kind, title, body, link, source_type, source_id, dedupe_key)
       VALUES (?, 'in_app', 'appointment_reminder', ?, ?, ?, 'appointment', ?, ?)`,
      [
        userId,
        'Upcoming Counselling Appointment',
        JSON.stringify({
          applicant: `${a.first_name} ${a.last_name}`,
          time: formatTime12(a.start_time),
          program,
          mode: a.mode === 'online' ? 'Online' : 'Offline',
          code: a.appointment_code,
        }),
        `/dashboard/appointments?open=${a.id}`,
        a.id,
        reminderKey(a),
      ]
    );
  }

  const [rows] = await pool.query(
    `SELECT n.id, n.title, n.body, n.link, n.source_id AS appointment_id, n.delivered_at
     FROM staff_notifications n
     JOIN appointments a ON a.id = n.source_id
     WHERE n.user_id = ? AND n.channel = 'in_app' AND n.kind = 'appointment_reminder' AND n.read_at IS NULL
       AND a.status = 'Scheduled' AND a.counsellor_user_id = n.user_id
       AND a.appt_date = ? AND a.end_time > ?
       AND n.dedupe_key = CONCAT('appt:', a.id, ':', a.appt_date, 'T', TIME_FORMAT(a.start_time, '%H:%i'),
                                 ':c', a.counsellor_user_id, ':r${REMINDER_LEAD_MINUTES}:in_app')
     ORDER BY a.start_time`,
    [userId, now.date, nowTime]
  );
  const list = rows as any[];
  const undelivered = list.filter((r) => !r.delivered_at).map((r) => r.id);
  if (undelivered.length) {
    await pool.query(`UPDATE staff_notifications SET delivered_at = NOW() WHERE id IN (?)`, [undelivered]);
  }
  return list.map((r) => {
    let body: any = {};
    try { body = JSON.parse(r.body || '{}'); } catch { /* ignore */ }
    return { id: r.id, title: r.title, link: r.link, appointment_id: r.appointment_id, ...body };
  });
}

export async function markRemindersRead(userId: number, ids: number[]) {
  if (!ids.length) return;
  await ensureAppointmentTables();
  await getPool().query(
    `UPDATE staff_notifications SET read_at = NOW() WHERE user_id = ? AND id IN (?) AND read_at IS NULL`,
    [userId, ids]
  );
}

// ── Counsellor helpers for routes ─────────────────────────────────────

export async function isCounsellor(userId: number): Promise<boolean> {
  await ensureAppointmentTables();
  const [rows] = await getPool().query(`SELECT 1 FROM appt_counsellors WHERE user_id = ? LIMIT 1`, [userId]);
  return (rows as any[]).length > 0;
}

export { loadCounsellors };
