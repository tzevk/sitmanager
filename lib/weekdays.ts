export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Expands a weekday range (inclusive, wraps cyclically) into an ordered list of weekday names. */
export function getDayRange(start: string | null | undefined, end: string | null | undefined): string[] {
  const startIdx = start ? WEEKDAYS.indexOf(start) : -1;
  const endIdx = end ? WEEKDAYS.indexOf(end) : -1;
  if (startIdx === -1 || endIdx === -1) return WEEKDAYS;

  const days: string[] = [];
  let i = startIdx;
  for (let n = 0; n < 7; n++) {
    days.push(WEEKDAYS[i]);
    if (i === endIdx) break;
    i = (i + 1) % 7;
  }
  return days;
}
