/**
 * Time helpers for the appointment module.
 *
 * All scheduling is done in institute-local time (Asia/Kolkata). Servers (Vercel)
 * run in UTC, so never rely on `new Date().getHours()` — use nowLocal() instead.
 * Times are handled as "minutes since midnight" integers internally so overlap
 * checks are plain integer comparisons.
 */

export const APPT_TIMEZONE = 'Asia/Kolkata';

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Current local date (YYYY-MM-DD) and minutes-since-midnight in the institute timezone. */
export function nowLocal(): { date: string; minutes: number; iso: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APPT_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const hour = Number(get('hour')) % 24;
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  return {
    date,
    minutes: hour * 60 + Number(get('minute')),
    iso: `${date} ${String(hour).padStart(2, '0')}:${get('minute')}:${get('second')}`,
  };
}

export function isValidDateStr(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isValidTimeStr(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}

/** 'HH:MM' or 'HH:MM:SS' → minutes since midnight. */
export function toMinutes(time: string | null | undefined): number {
  if (!time) return 0;
  const [h, m] = String(time).split(':');
  return Number(h) * 60 + Number(m || 0);
}

/** minutes since midnight → 'HH:MM'. */
export function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 'HH:MM' → '10:30 AM'. */
export function formatTime12(time: string | number): string {
  const mins = typeof time === 'number' ? time : toMinutes(time);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** 'YYYY-MM-DD' → '28 September 2026'. */
export function formatDateLong(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Day of week (0=Sun) for a YYYY-MM-DD string, timezone-independent. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Half-open interval overlap: [aStart, aEnd) ∩ [bStart, bEnd) ≠ ∅ */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Parse a CSV of weekday numbers ('1,2,3') into a Set. Empty/invalid → empty set. */
export function parseWeekdays(csv: string | null | undefined): Set<number> {
  const out = new Set<number>();
  for (const part of String(csv ?? '').split(',')) {
    const n = Number(part.trim());
    if (part.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 6) out.add(n);
  }
  return out;
}

export function weekdaysToCsv(days: Iterable<number>): string {
  return Array.from(new Set(days)).filter((d) => d >= 0 && d <= 6).sort().join(',');
}
