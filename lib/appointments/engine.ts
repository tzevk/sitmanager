/* eslint-disable @typescript-eslint/no-explicit-any */
import type mysql from 'mysql2/promise';
import {
  addDays, fromMinutes, nowLocal, overlaps, parseWeekdays, toMinutes, weekdayOf, WEEKDAY_NAMES,
} from '@/lib/appointments/time';

/**
 * Availability engine.
 *
 * Single source of truth for "who is free when". Used by:
 *  - the public landing page (slot list — only slots with ≥1 free counsellor)
 *  - the booking transaction (re-validation + fair assignment, inside the lock)
 *  - internal reschedule / reassign
 *  - the internal calendar's free-time view
 *
 * A counsellor is NOT free for [start, end) on a date when any of these hold:
 *  - counsellor inactive, or doesn't take the requested mode
 *  - date is not one of their working days (personal days if custom hours, else global)
 *  - date is their weekly off (emp_weekly_off, when linked to an employee)
 *  - date is a holiday (Holiday_master) or a whole-day global exception
 *  - interval falls outside their working hours
 *  - interval overlaps a global break, a partial global block, a personal block
 *    (blocked / leave / task / unavailable), or another non-cancelled appointment
 */

export type Db = Pick<mysql.Pool, 'query'> | Pick<mysql.PoolConnection, 'query'>;
export type ApptMode = 'online' | 'offline';

export interface ApptSettings {
  working_days: string;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  booking_window_days: number;
  min_notice_minutes: number;
  use_holiday_master: number;
  office_address: string | null;
  default_meeting_link: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

export interface CounsellorRow {
  user_id: number;
  emp_id: number | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  is_active: number;
  modes: string;
  use_custom_hours: number;
  working_days: string | null;
  start_time: string | null;
  end_time: string | null;
  meeting_link: string | null;
  last_assigned_at: string | null;
}

interface Interval { start: number; end: number; label?: string; kind?: string; id?: number }

export interface DayContext {
  date: string;
  weekday: number;
  settings: ApptSettings;
  counsellors: CounsellorRow[];
  /** Whole-day closure for everyone (holiday / blocked date) — null if open. */
  closure: { label: string; kind: string } | null;
  /** Global partial blocks + breaks applying to this date. */
  globalBusy: Interval[];
  /** Per-counsellor personal blocks + appointments. */
  counsellorBusy: Map<number, Interval[]>;
  /** Counsellors whose weekly off falls on this date. */
  weeklyOff: Set<number>;
}

export async function loadSettings(db: Db): Promise<ApptSettings> {
  const [rows] = await db.query(`SELECT * FROM appt_settings WHERE id = 1`);
  const row = (rows as any[])[0] ?? {};
  return {
    working_days: row.working_days ?? '0,1,2,3,4,5,6',
    start_time: String(row.start_time ?? '09:00:00').slice(0, 5),
    end_time: String(row.end_time ?? '16:00:00').slice(0, 5),
    slot_minutes: Number(row.slot_minutes) || 30,
    booking_window_days: Number(row.booking_window_days) || 30,
    min_notice_minutes: Number(row.min_notice_minutes ?? 60),
    use_holiday_master: Number(row.use_holiday_master ?? 1),
    office_address: row.office_address ?? null,
    default_meeting_link: row.default_meeting_link ?? null,
    contact_phone: row.contact_phone ?? null,
    contact_email: row.contact_email ?? null,
  };
}

export async function loadCounsellors(db: Db, activeOnly = true): Promise<CounsellorRow[]> {
  const [rows] = await db.query(
    `SELECT * FROM appt_counsellors ${activeOnly ? 'WHERE is_active = 1' : ''} ORDER BY display_name`
  );
  return (rows as any[]).map((r) => ({
    ...r,
    start_time: r.start_time ? String(r.start_time).slice(0, 5) : null,
    end_time: r.end_time ? String(r.end_time).slice(0, 5) : null,
  }));
}

async function loadHolidays(db: Db, from: string, to: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const [rows] = await db.query(
      `SELECT DATE_FORMAT(Date_of_Holiday, '%Y-%m-%d') AS d, Holiday FROM Holiday_master
       WHERE Date_of_Holiday BETWEEN ? AND ? AND COALESCE(IsDelete, 0) = 0 AND COALESCE(IsActive, 1) = 1`,
      [from, to]
    );
    for (const r of rows as any[]) if (r.d && !out.has(r.d)) out.set(r.d, String(r.Holiday || 'Holiday'));
  } catch {
    // Holiday master missing on this install — not fatal.
  }
  return out;
}

async function loadWeeklyOffRows(db: Db, from: string, to: string, counsellors: CounsellorRow[]) {
  const linked = counsellors.filter((c) => c.emp_id);
  if (!linked.length) return [] as { empId: number; weekday: string; from: string; to: string }[];
  try {
    const [rows] = await db.query(
      `SELECT Emp_Id, WeekDay, DATE_FORMAT(DateFrom, '%Y-%m-%d') AS df, DATE_FORMAT(ToDate, '%Y-%m-%d') AS dt
       FROM emp_weekly_off WHERE Emp_Id IN (?) AND DateFrom <= ? AND ToDate >= ?`,
      [linked.map((c) => c.emp_id), to, from]
    );
    return (rows as any[]).map((r) => ({ empId: Number(r.Emp_Id), weekday: String(r.WeekDay ?? '').trim().toLowerCase(), from: r.df, to: r.dt }));
  } catch {
    return []; // emp_weekly_off not present — ignore.
  }
}

function weekdayMatches(value: string, weekday: number) {
  return value === String(weekday) || (value.length >= 3 && WEEKDAY_NAMES[weekday].toLowerCase().startsWith(value.slice(0, 3)));
}

/** Clip a DATETIME range to minutes within `date`. Returns null if no overlap. */
function clipToDay(date: string, startAt: string, endAt: string): Interval | null {
  const sDate = String(startAt).slice(0, 10);
  const eDate = String(endAt).slice(0, 10);
  const start = sDate < date ? 0 : sDate > date ? 1440 : toMinutes(String(startAt).slice(11, 16));
  const end = eDate > date ? 1440 : eDate < date ? 0 : toMinutes(String(endAt).slice(11, 16));
  return end > start ? { start, end } : null;
}

export interface LoadOptions {
  /** Ignore this appointment's own occupancy (used when rescheduling / reassigning it). */
  excludeAppointmentId?: number;
  settings?: ApptSettings;
  counsellors?: CounsellorRow[];
}

/**
 * Load availability contexts for every date in [from, to] with a fixed number
 * of queries (not one batch per day) — the public date strip needs ~30 days.
 */
export async function loadRangeContexts(db: Db, from: string, to: string, opts: LoadOptions = {}): Promise<Map<string, DayContext>> {
  const settings = opts.settings ?? (await loadSettings(db));
  const counsellors = opts.counsellors ?? (await loadCounsellors(db));
  const toNext = addDays(to, 1);

  const [holidays, weeklyOffRows, [excRows], [breakRows], [blockRows], [apptRows]] = await Promise.all([
    settings.use_holiday_master ? loadHolidays(db, from, to) : Promise.resolve(new Map<string, string>()),
    loadWeeklyOffRows(db, from, to, counsellors),
    db.query(
      `SELECT DATE_FORMAT(exc_date, '%Y-%m-%d') AS exc_date, exc_type, label, start_time, end_time
       FROM appt_exceptions WHERE exc_date BETWEEN ? AND ?`,
      [from, to]
    ),
    db.query(`SELECT * FROM appt_breaks WHERE is_active = 1`),
    db.query(
      `SELECT id, counsellor_user_id, start_at, end_at, block_type, reason FROM appt_counsellor_blocks
       WHERE start_at < ? AND end_at > ?`,
      [`${toNext} 00:00:00`, `${from} 00:00:00`]
    ),
    db.query(
      `SELECT id, DATE_FORMAT(appt_date, '%Y-%m-%d') AS appt_date, counsellor_user_id, start_time, end_time FROM appointments
       WHERE appt_date BETWEEN ? AND ? AND status <> 'Cancelled' AND counsellor_user_id IS NOT NULL
         ${opts.excludeAppointmentId ? 'AND id <> ?' : ''}`,
      opts.excludeAppointmentId ? [from, to, opts.excludeAppointmentId] : [from, to]
    ),
  ]);

  const out = new Map<string, DayContext>();
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const weekday = weekdayOf(date);
    const holiday = holidays.get(date);
    let closure: DayContext['closure'] = holiday ? { label: holiday, kind: 'holiday' } : null;
    const globalBusy: Interval[] = [];

    for (const e of excRows as any[]) {
      if (e.exc_date !== date) continue;
      if (!e.start_time || !e.end_time) {
        closure = closure ?? { label: e.label || (e.exc_type === 'holiday' ? 'Holiday' : 'Blocked'), kind: e.exc_type };
      } else {
        globalBusy.push({ start: toMinutes(e.start_time), end: toMinutes(e.end_time), label: e.label || 'Blocked', kind: 'blocked' });
      }
    }
    for (const b of breakRows as any[]) {
      const days = b.weekdays ? parseWeekdays(b.weekdays) : null;
      if (days && !days.has(weekday)) continue;
      globalBusy.push({ start: toMinutes(b.start_time), end: toMinutes(b.end_time), label: b.label || 'Break', kind: 'break' });
    }

    const counsellorBusy = new Map<number, Interval[]>();
    const push = (id: number, iv: Interval) => {
      const list = counsellorBusy.get(id) ?? [];
      list.push(iv);
      counsellorBusy.set(id, list);
    };
    for (const b of blockRows as any[]) {
      const iv = clipToDay(date, b.start_at, b.end_at);
      if (iv) push(Number(b.counsellor_user_id), { ...iv, kind: b.block_type, label: b.reason || b.block_type, id: b.id });
    }
    for (const a of apptRows as any[]) {
      if (a.appt_date !== date) continue;
      push(Number(a.counsellor_user_id), { start: toMinutes(a.start_time), end: toMinutes(a.end_time), kind: 'appointment', id: a.id });
    }

    const weeklyOff = new Set<number>();
    for (const w of weeklyOffRows) {
      if (w.from > date || w.to < date || !weekdayMatches(w.weekday, weekday)) continue;
      for (const c of counsellors) if (Number(c.emp_id) === w.empId) weeklyOff.add(c.user_id);
    }

    out.set(date, { date, weekday, settings, counsellors, closure, globalBusy, counsellorBusy, weeklyOff });
  }
  return out;
}

export async function loadDayContext(db: Db, date: string, opts: LoadOptions = {}): Promise<DayContext> {
  return (await loadRangeContexts(db, date, date, opts)).get(date)!;
}

/** Working window for a counsellor on the context date, or null if not working. */
export function counsellorWindow(ctx: DayContext, c: CounsellorRow): { start: number; end: number } | null {
  if (!c.is_active || ctx.closure || ctx.weeklyOff.has(c.user_id)) return null;
  const custom = Boolean(c.use_custom_hours);
  const days = parseWeekdays(custom && c.working_days != null ? c.working_days : ctx.settings.working_days);
  if (!days.has(ctx.weekday)) return null;
  const start = toMinutes(custom && c.start_time ? c.start_time : ctx.settings.start_time);
  const end = toMinutes(custom && c.end_time ? c.end_time : ctx.settings.end_time);
  return end > start ? { start, end } : null;
}

export function supportsMode(c: CounsellorRow, mode: ApptMode | null | undefined): boolean {
  if (!mode) return true;
  const m = String(c.modes || 'both').toLowerCase();
  return m === 'both' || m === mode;
}

export function isCounsellorFree(ctx: DayContext, c: CounsellorRow, start: number, end: number, mode?: ApptMode | null): boolean {
  if (!supportsMode(c, mode)) return false;
  const win = counsellorWindow(ctx, c);
  if (!win || start < win.start || end > win.end) return false;
  if (ctx.globalBusy.some((iv) => overlaps(start, end, iv.start, iv.end))) return false;
  const busy = ctx.counsellorBusy.get(c.user_id) ?? [];
  return !busy.some((iv) => overlaps(start, end, iv.start, iv.end));
}

export function overlapsAny(list: { start: number; end: number }[], start: number, end: number): boolean {
  return list.some((iv) => overlaps(start, end, iv.start, iv.end));
}

export function freeCounsellorsFor(ctx: DayContext, start: number, end: number, mode?: ApptMode | null): CounsellorRow[] {
  return ctx.counsellors.filter((c) => isCounsellorFree(ctx, c, start, end, mode));
}

export type BookabilityError =
  | 'past' | 'too_soon' | 'beyond_window' | 'closed' | 'invalid_slot' | 'no_counsellor';

/** Is `date` bookable at all from the public side (window / past checks)? */
export function checkDateWindow(ctx: DayContext, enforcePublicWindow: boolean): BookabilityError | null {
  const now = nowLocal();
  if (ctx.date < now.date) return 'past';
  if (enforcePublicWindow && ctx.date > addDays(now.date, ctx.settings.booking_window_days)) return 'beyond_window';
  if (ctx.closure) return 'closed';
  return null;
}

/** Earliest start minute still bookable on the context date. */
function earliestStart(ctx: DayContext, enforceNotice: boolean): number {
  const now = nowLocal();
  if (ctx.date > now.date) return 0;
  if (ctx.date < now.date) return Infinity;
  return now.minutes + (enforceNotice ? ctx.settings.min_notice_minutes : 0);
}

export interface Slot {
  time: string;      // 'HH:MM'
  end: string;       // 'HH:MM'
  available: boolean;
  freeCount: number;
}

/**
 * Generate slots for a date. Candidate start times step by the configured
 * duration from each counsellor's working-window start (union across
 * counsellors), so personal hours that start at e.g. 10:15 still get a grid.
 */
export function generateSlots(ctx: DayContext, mode: ApptMode | null, opts: { enforceNotice?: boolean; duration?: number } = {}): Slot[] {
  const duration = opts.duration ?? ctx.settings.slot_minutes;
  if (ctx.closure || duration <= 0) return [];
  const minStart = earliestStart(ctx, opts.enforceNotice ?? true);

  const starts = new Set<number>();
  for (const c of ctx.counsellors) {
    if (!supportsMode(c, mode)) continue;
    const win = counsellorWindow(ctx, c);
    if (!win) continue;
    for (let s = win.start; s + duration <= win.end; s += duration) starts.add(s);
  }

  return Array.from(starts)
    .sort((a, b) => a - b)
    .map((s) => {
      const freeCount = s < minStart ? 0 : freeCounsellorsFor(ctx, s, s + duration, mode).length;
      return { time: fromMinutes(s), end: fromMinutes(s + duration), available: freeCount > 0, freeCount };
    });
}

/**
 * Validate a specific slot for booking and return the eligible counsellors.
 * Always call this INSIDE the booking lock with a freshly loaded context.
 */
export function validateSlot(
  ctx: DayContext,
  startTime: string,
  mode: ApptMode | null,
  opts: { enforcePublicWindow: boolean; enforceNotice: boolean; duration?: number }
): { ok: true; start: number; end: number; eligible: CounsellorRow[] } | { ok: false; error: BookabilityError } {
  const dateErr = checkDateWindow(ctx, opts.enforcePublicWindow);
  if (dateErr) return { ok: false, error: dateErr };

  const duration = opts.duration ?? ctx.settings.slot_minutes;
  const start = toMinutes(startTime);
  const end = start + duration;
  if (start < earliestStart(ctx, opts.enforceNotice)) return { ok: false, error: ctx.date === nowLocal().date ? 'too_soon' : 'past' };

  if (opts.enforcePublicWindow) {
    // Public bookings must land exactly on a generated slot boundary.
    const onGrid = generateSlots(ctx, mode, { enforceNotice: opts.enforceNotice, duration }).some((s) => s.time === fromMinutes(start));
    if (!onGrid) return { ok: false, error: 'invalid_slot' };
  }

  const eligible = freeCounsellorsFor(ctx, start, end, mode);
  if (!eligible.length) return { ok: false, error: 'no_counsellor' };
  return { ok: true, start, end, eligible };
}

export const BOOKABILITY_MESSAGES: Record<BookabilityError, string> = {
  past: 'That time has already passed. Please choose another slot.',
  too_soon: 'That slot is too close to the current time. Please choose a later slot.',
  beyond_window: 'Bookings are not yet open for that date.',
  closed: 'The institute is closed on that date.',
  invalid_slot: 'That time is not a valid appointment slot.',
  no_counsellor: 'Sorry, that slot was just taken. Please choose another time.',
};

/**
 * Fair assignment: lowest same-day load → lowest load in the surrounding week →
 * least recently assigned → lowest id (deterministic).
 */
export async function pickCounsellor(db: Db, date: string, eligible: CounsellorRow[]): Promise<CounsellorRow> {
  if (eligible.length === 1) return eligible[0];
  const ids = eligible.map((c) => c.user_id);
  const [rows] = await db.query(
    `SELECT counsellor_user_id AS id,
            SUM(appt_date = ?) AS day_load,
            COUNT(*) AS week_load
     FROM appointments
     WHERE status <> 'Cancelled' AND counsellor_user_id IN (?)
       AND appt_date BETWEEN ? AND ?
     GROUP BY counsellor_user_id`,
    [date, ids, addDays(date, -3), addDays(date, 3)]
  );
  const load = new Map<number, { day: number; week: number }>();
  for (const r of rows as any[]) load.set(Number(r.id), { day: Number(r.day_load) || 0, week: Number(r.week_load) || 0 });

  return [...eligible].sort((a, b) => {
    const la = load.get(a.user_id) ?? { day: 0, week: 0 };
    const lb = load.get(b.user_id) ?? { day: 0, week: 0 };
    if (la.day !== lb.day) return la.day - lb.day;
    if (la.week !== lb.week) return la.week - lb.week;
    const ta = a.last_assigned_at ? String(a.last_assigned_at) : '';
    const tb = b.last_assigned_at ? String(b.last_assigned_at) : '';
    if (ta !== tb) return ta < tb ? -1 : 1; // never-assigned ('') first
    return a.user_id - b.user_id;
  })[0];
}

/** Per-counsellor timeline for the internal calendar's availability view. */
export function counsellorDayTimeline(ctx: DayContext, c: CounsellorRow) {
  const win = counsellorWindow(ctx, c);
  const busy = ctx.counsellorBusy.get(c.user_id) ?? [];
  return {
    user_id: c.user_id,
    name: c.display_name,
    modes: c.modes,
    working: win ? { start: fromMinutes(win.start), end: fromMinutes(win.end) } : null,
    offReason: !c.is_active ? 'Inactive' : ctx.closure ? ctx.closure.label : ctx.weeklyOff.has(c.user_id) ? 'Weekly off' : !win ? 'Non-working day' : null,
    breaks: ctx.globalBusy.map((iv) => ({ start: fromMinutes(iv.start), end: fromMinutes(iv.end), kind: iv.kind, label: iv.label })),
    blocks: busy.filter((iv) => iv.kind !== 'appointment').map((iv) => ({ id: iv.id, start: fromMinutes(iv.start), end: fromMinutes(Math.min(iv.end, 1439)), kind: iv.kind, label: iv.label })),
    appointments: busy.filter((iv) => iv.kind === 'appointment').map((iv) => ({ id: iv.id, start: fromMinutes(iv.start), end: fromMinutes(iv.end) })),
  };
}
