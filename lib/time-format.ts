/**
 * Shared time-parsing/formatting helpers for the Trainer Portal attendance flow.
 * Extracted so client display (dashboard page) and server-side matching logic
 * (attendance route) can't drift apart.
 */

export function parseTimeToMinutes(t?: string | null): number | null {
  if (!t) return null;
  const raw = String(t).trim();
  if (!raw) return null;
  const m = raw
    .replace(/\./g, '')
    .trim()
    .match(/^\s*(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?\s*([aApP])?\s*([mM])?\s*$/);
  if (!m) return null;
  let hh = Number(m[1]);
  const mm2 = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm2)) return null;
  if (mm2 < 0 || mm2 > 59) return null;
  const hasMeridiem = Boolean(m[4]);
  if (hasMeridiem) {
    const ap = String(m[4]).toLowerCase();
    if (hh < 1 || hh > 12) return null;
    if (ap === 'a') { if (hh === 12) hh = 0; }
    else if (ap === 'p') { if (hh !== 12) hh += 12; }
  }
  if (hh < 0 || hh > 23) return null;
  return hh * 60 + mm2;
}

export function formatTimeAmPm(t?: string | null): string {
  if (!t) return '—';
  const minutes = parseTimeToMinutes(t);
  if (minutes == null) return String(t).trim() || '—';
  const hh24 = Math.floor(minutes / 60);
  const mm2 = minutes % 60;
  const suffix = hh24 >= 12 ? 'pm' : 'am';
  const hh12 = (hh24 % 12) || 12;
  return `${hh12}:${String(mm2).padStart(2, '0')} ${suffix}`;
}

/**
 * Splits a day's lecture-plan rows into a "first half" (starts before 13:00)
 * and "second half" (starts at/after 13:00) row, matching the client's
 * historical fallback behavior of picking the first/second row by array order
 * when start times are missing or ambiguous.
 */
export function splitFirstSecondHalf<T extends { starttime?: string | null }>(
  rows: T[]
): { firstHalf: T | null; secondHalf: T | null } {
  const firstHalf = rows.find(l => {
    const mins = parseTimeToMinutes(l.starttime || null);
    return mins != null ? mins < 13 * 60 : true;
  }) || rows[0] || null;
  const secondHalf = rows.find(l => {
    const mins = parseTimeToMinutes(l.starttime || null);
    return mins != null ? mins >= 13 * 60 : false;
  }) || rows[1] || null;
  return { firstHalf, secondHalf };
}
