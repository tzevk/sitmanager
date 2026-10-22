import * as XLSX from 'xlsx';

/**
 * Parses the sales team's SALES_PERFORMANCE_SCOREBOARD workbook into the weekly
 * Sales Tracker (one sheet per month, one table per week) and each salesperson's
 * daily prospect log (one sheet per employee). Columns are found by their header
 * text, since the employee sheets don't all share a layout. Prospect names are
 * never kept, only a per-employee reference (P01, P02…).
 */

export interface TrackerRow {
  month: string;
  week: number;
  week_key: string;
  week_label: string;
  week_start: string;
  course: string;
  course_as_entered: string;
  leads: number | null;
  qualified: number | null;
  meetings: number | null;
  proposals: number | null;
  negotiation: number | null;
  closures: number;
}

export interface ProspectRow {
  date: string;
  week_start: string;
  prospect_ref: string;
  course: string;
  temperature: 'Hot' | 'Warm' | 'Cold' | 'Not tagged';
  follow_up_connected: 'Yes' | 'No' | '';
  outcome: 'Admitted' | 'Not interested' | 'Open' | 'Other';
  outcome_note: string;
}

export interface Scoreboard {
  source: string;
  dataThrough: string;
  uploadedAt?: string;
  uploadedBy?: string;
  tracker: TrackerRow[];
  individuals: { employee: string; rows: ProspectRow[] }[];
}

const COURSES: [RegExp, string][] = [
  [/^mep/, 'MEP Engineering'],
  [/air ?conditioning|^hvac/, 'HVAC (Air Conditioning)'],
  [/rotat/, 'Rotating Equipment'],
  [/piping design|^pdd/, 'Piping Design & Drafting'],
  [/piping/, 'Piping Engineering'],
  [/pipe stress/, 'Advanced Pipe Stress Analysis'],
  [/instrument|process inst/, 'Process Instrumentation & Control'],
  [/electrical/, 'Electrical System Design'],
  [/mdpe|mped|mechanical design/, 'Mechanical Design of Process Equipment'],
  [/structural/, 'Structural Engineering'],
  [/^edd|engineering design/, 'Engineering Design & Drafting'],
  [/process/, 'Process Engineering'],
  [/water|^wwt/, 'Water & Waste Water'],
];

/** One name per course; a cell listing several ("Process Engineering, Piping…") counts as the first. */
export function normalizeCourse(value: unknown): string {
  const first = String(value ?? '').split(',')[0].trim();
  if (!first) return 'Not recorded';
  const n = first.toLowerCase();
  for (const [re, label] of COURSES) if (re.test(n)) return label;
  return first;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const monthIndex = (text: string) => MONTHS.findIndex((m) => text.toLowerCase().startsWith(m));
const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const text = (v: unknown) => (v == null ? '' : String(v).trim());
const isYes = (v: unknown) => text(v).toLowerCase() === 'yes';

function leadingInt(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null;
  const m = String(v).match(/^\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().slice(0, 10);
}

type Grid = unknown[][];

function sheetGrid(wb: XLSX.WorkBook, name: string): Grid {
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true, blankrows: true }) as Grid;
}

function findHeaderCol(header: unknown[], ...patterns: RegExp[]): number {
  for (const re of patterns) {
    const i = header.findIndex((h) => re.test(text(h).toLowerCase()));
    if (i !== -1) return i;
  }
  return -1;
}

/** "25th~31st August 2026" → 2026-08-25; falls back to the week's place in the month. */
function weekStartFrom(label: string, year: number, month: number, week: number): string {
  const m = label.match(/(\d{1,2})(?:st|nd|rd|th)?\s*[~\-–]\s*\d{1,2}(?:st|nd|rd|th)?\s+([a-z]+)\.?\s+(\d{4})/i);
  if (m) {
    const mi = monthIndex(m[2]);
    if (mi !== -1) return isoDate(Number(m[3]), mi + 1, Number(m[1]));
  }
  return isoDate(year, month, Math.min(28, 1 + (week - 1) * 7));
}

function parseTrackerSheet(grid: Grid, sheetName: string): TrackerRow[] {
  const nm = sheetName.match(/([a-z]+)\.?\s*(\d{4})/i);
  const mi = nm ? monthIndex(nm[1]) : -1;
  if (!nm || mi === -1) return [];
  const year = Number(nm[2]);
  const month = mi + 1;
  const monthKey = `${year}-${pad(month)}`;
  const out: TrackerRow[] = [];

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const weekCell = row.find((c) => /^week\s*\d+/i.test(text(c)));
    if (!weekCell) continue;
    const week = Number(text(weekCell).match(/\d+/)![0]);
    const weekCol = row.indexOf(weekCell);
    const label = text(grid[r + 1]?.[weekCol]);

    let h = -1;
    for (let k = r + 1; k <= r + 6 && k < grid.length; k++) {
      if ((grid[k] ?? []).some((c) => /product/i.test(text(c)))) { h = k; break; }
    }
    if (h === -1) continue;
    const header = grid[h];
    const col = {
      product: findHeaderCol(header, /product/),
      leads: findHeaderCol(header, /received|actual leads/),
      qualified: findHeaderCol(header, /qualified/),
      meetings: findHeaderCol(header, /actual meeting/),
      proposals: findHeaderCol(header, /proposal|recommendation/),
      negotiation: findHeaderCol(header, /negotiation|decision/),
      closures: findHeaderCol(header, /admission|closure/),
    };
    if (col.product === -1) continue;
    const weekStart = weekStartFrom(label, year, month, week);

    for (let k = h + 1; k < grid.length; k++) {
      const cells = grid[k] ?? [];
      if (cells.some((c) => /^week\s*\d+/i.test(text(c)))) break;
      if (/^note/i.test(text(cells[0]))) break;
      if (/^example/i.test(text(cells[0]))) continue;
      const product = text(cells[col.product]);
      if (!product) continue;
      const get = (i: number) => (i === -1 ? null : leadingInt(cells[i]));
      out.push({
        month: monthKey,
        week,
        week_key: `${monthKey}-W${week}`,
        week_label: label ? `Week ${week} (${label})` : `Week ${week}`,
        week_start: weekStart,
        course: normalizeCourse(product),
        course_as_entered: product,
        leads: get(col.leads),
        qualified: get(col.qualified),
        meetings: get(col.meetings),
        proposals: get(col.proposals),
        negotiation: get(col.negotiation),
        closures: get(col.closures) ?? 0,
      });
    }
  }
  return out;
}

const NOT_A_PROSPECT = /week ?off|out for|seminar|holiday|leave/i;
const ADMITTED = /^(yes|done|admitted|admission done|closed|enrolled|confirmed)\.?$/i;
const LOST = /not interest|irrelevant|not relevant/i;

function parseEmployeeSheet(grid: Grid, defaultYear: number): ProspectRow[] | null {
  let h = -1;
  for (let r = 0; r < Math.min(grid.length, 8); r++) {
    if ((grid[r] ?? []).some((c) => /prospect/i.test(text(c)))) { h = r; break; }
  }
  if (h === -1) return null;
  const header = grid[h];
  const col = {
    month: findHeaderCol(header, /^month/),
    day: findHeaderCol(header, /^day/),
    name: findHeaderCol(header, /prospect/),
    course: findHeaderCol(header, /training|program|course/),
    hot: findHeaderCol(header, /^hot/),
    warm: findHeaderCol(header, /^warm/),
    cold: findHeaderCol(header, /^cold/),
    followUp: findHeaderCol(header, /follow/),
    closure: findHeaderCol(header, /admission|closure/),
  };
  if (col.name === -1 || col.day === -1) return null;

  const refs = new Map<string, string>();
  const rows: ProspectRow[] = [];
  let year = defaultYear;
  let month: number | null = null;
  let day: number | null = null;

  for (let r = h + 1; r < grid.length; r++) {
    const cells = grid[r] ?? [];
    const monthCell = col.month === -1 ? null : cells[col.month];
    const hasMonth = monthCell != null && text(monthCell) !== '';
    if (monthCell instanceof Date) {
      year = monthCell.getFullYear();
      month = monthCell.getMonth() + 1;
    } else if (hasMonth && monthIndex(text(monthCell)) !== -1) {
      month = monthIndex(text(monthCell)) + 1;
    }
    const dayCell = leadingInt(cells[col.day]);
    if (dayCell != null) {
      // A day lower than the last one with no new month written means the log ran into the next month.
      if (day != null && dayCell < day && !hasMonth && month != null) {
        month = month === 12 ? 1 : month + 1;
        if (month === 1) year += 1;
      }
      day = dayCell;
    }

    const name = text(cells[col.name]);
    if (!name || NOT_A_PROSPECT.test(name) || month == null || day == null) continue;

    const key = name.toLowerCase().replace(/[^a-z]/g, '');
    if (!key) continue;
    if (!refs.has(key)) refs.set(key, `P${pad(refs.size + 1)}`);

    const date = isoDate(year, month, day);
    const temperature = isYes(cells[col.hot]) ? 'Hot'
      : isYes(cells[col.warm]) ? 'Warm'
        : isYes(cells[col.cold]) ? 'Cold'
          : 'Not tagged';
    const fu = col.followUp === -1 ? '' : text(cells[col.followUp]).toLowerCase();
    const closure = col.closure === -1 ? '' : text(cells[col.closure]);
    const outcome = !closure ? 'Open' : ADMITTED.test(closure) ? 'Admitted' : LOST.test(closure) ? 'Not interested' : 'Other';

    rows.push({
      date,
      week_start: mondayOf(date),
      prospect_ref: refs.get(key)!,
      course: col.course === -1 ? 'Not recorded' : normalizeCourse(cells[col.course]),
      temperature,
      follow_up_connected: fu === 'yes' ? 'Yes' : fu === 'no' ? 'No' : '',
      outcome,
      outcome_note: outcome === 'Other' ? closure.slice(0, 80) : '',
    });
  }
  return rows;
}

/** Parse the whole workbook. Throws a plain-language error when nothing usable is found. */
export function parseScoreboardWorkbook(buffer: Buffer, fileName: string): Scoreboard {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const tracker: TrackerRow[] = [];
  const individuals: Scoreboard['individuals'] = [];

  const trackerSheets = wb.SheetNames.filter((n) => /sales\s*tracker/i.test(n));
  for (const name of trackerSheets) tracker.push(...parseTrackerSheet(sheetGrid(wb, name), name));
  tracker.sort((a, b) => a.week_key.localeCompare(b.week_key, undefined, { numeric: true }));

  const defaultYear = Number(tracker[0]?.month.slice(0, 4)) || new Date().getFullYear();
  for (const name of wb.SheetNames) {
    if (trackerSheets.includes(name)) continue;
    const rows = parseEmployeeSheet(sheetGrid(wb, name), defaultYear);
    if (rows && rows.length) individuals.push({ employee: name.trim(), rows });
  }

  if (!tracker.length && !individuals.length) {
    throw new Error('No Sales Tracker sheets or employee prospect sheets were found. Upload the SALES_PERFORMANCE_SCOREBOARD workbook.');
  }

  const lastDates = [
    ...individuals.flatMap((i) => i.rows.map((r) => r.date)),
    ...tracker.map((t) => t.week_start),
  ].sort();
  return { source: fileName, dataThrough: lastDates[lastDates.length - 1] ?? '', tracker, individuals };
}

const nameTokens = (v: string) => v.toLowerCase().split(/[^a-z]+/).filter((t) => t.length > 1);

/**
 * The employee sheet belonging to a signed-in user: the sheet whose name contains both
 * the user's first and last name (in any order, so "Umar Shaikh" matches the sheet
 * "Shaikh Mohammed Umar"). Null when no sheet matches, or when more than one does.
 */
export function findEmployeeSheet(board: Scoreboard, firstName: string, lastName: string) {
  const wanted = [...nameTokens(firstName), ...nameTokens(lastName)];
  if (!nameTokens(firstName).length || !nameTokens(lastName).length) return null;
  const matches = board.individuals.filter((i) => {
    const have = new Set(nameTokens(i.employee));
    return wanted.every((t) => have.has(t));
  });
  return matches.length === 1 ? matches[0] : null;
}
