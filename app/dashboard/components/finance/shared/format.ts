/** Indian-format rupee, treating null/undefined/NaN as em-dash. ₹0 is a real value. */
export function fmt(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '—';
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return '—';
  return `₹${v.toLocaleString('en-IN')}`;
}

export function pct(numerator: number | string, denominator: number | string): string {
  const a = Number(numerator), b = Number(denominator);
  return Number.isFinite(a) && b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '—';
}

const MONTH_NAMES_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const MONTHS_FULL = MONTH_NAMES_FULL;

/** Convert a stored ISO month string (YYYY-MM) to display label "Apr 2026". */
export function monthLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = String(iso).match(/^(\d{4})-(\d{2})/);
  if (!m) return String(iso);
  const idx = Number(m[2]) - 1;
  if (idx < 0 || idx > 11) return String(iso);
  return `${MONTH_NAMES_SHORT[idx]} ${m[1]}`;
}

/**
 * Best-effort parser for legacy free-text month strings.
 * Returns ISO YYYY-MM, or the original string unchanged if it can't parse.
 */
export function parseMonth(value: string | null | undefined): string {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}`;
  const named = s.match(/^([A-Za-z]+)\s*[,\-]?\s*(\d{4})?/);
  if (named) {
    const idx = MONTH_NAMES_FULL.findIndex(m => m.toLowerCase().startsWith(named[1].toLowerCase().slice(0, 3)));
    if (idx >= 0) {
      const yr = named[2] || String(new Date().getFullYear());
      return `${yr}-${String(idx + 1).padStart(2, '0')}`;
    }
  }
  return s;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * Format an ISO date string (YYYY-MM-DD) as DD-Mon-YY (e.g. 21-May-26).
 * Returns '—' for null/undefined/empty.
 */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '\u2014';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  const day = m[3].replace(/^0/, '');
  const mon = MONTH_NAMES_SHORT[Number(m[2]) - 1] ?? m[2];
  const yr  = m[1].slice(2);
  return `${day.padStart(2, '0')}-${mon}-${yr}`;
}

/** Add `n` days to today and return ISO YYYY-MM-DD. */
export function isoOffsetDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * Whether a cashflow row should count toward totals/aggregates.
 * Internal Transfer moves cash between the org's own accounts (not real
 * income/expense), and a "Loan" receipt is borrowed money, not revenue —
 * both would otherwise inflate reported totals.
 */
export function isCountableCashflow(r: { type: string; category: string }): boolean {
  if (r.category === 'Internal Transfer') return false;
  if (r.type === 'Receipt' && r.category === 'Loan') return false;
  return true;
}

export interface YearSelectOption { value: string; label: string }

/**
 * Builds Year <select> options spanning `span` years on either side of
 * `centerYear` — both calendar years ("2026") and Indian financial years
 * ("FY2026" = Apr 2026 – Mar 2027, labelled "FY 2026-27").
 */
export function buildYearOptions(centerYear: number, span = 2): { calendar: YearSelectOption[]; financial: YearSelectOption[] } {
  const calendar: YearSelectOption[] = [];
  const financial: YearSelectOption[] = [];
  for (let i = -span; i <= span; i++) {
    const y = centerYear + i;
    calendar.push({ value: String(y), label: String(y) });
    financial.push({ value: `FY${y}`, label: `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}` });
  }
  return { calendar, financial };
}

/** Whether a Year-select value represents a financial year ("FY2026"). */
export function isFinancialYearValue(year: string): boolean {
  return year.startsWith('FY');
}

/** Converts a Year-select value (calendar "2026" or financial "FY2026") into an inclusive date range. */
export function yearValueToRange(year: string): { from: string; to: string } | null {
  if (!year) return null;
  if (isFinancialYearValue(year)) {
    const y = Number(year.slice(2));
    if (!Number.isFinite(y)) return null;
    return { from: `${y}-04-01`, to: `${y + 1}-03-31` };
  }
  const y = Number(year);
  if (!Number.isFinite(y)) return null;
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

/** Month <select> options (value = "YYYY-MM") for a given Year-select value — handles financial years crossing Dec/Jan. */
export function monthOptionsForYear(year: string, fallbackYear: number): { value: string; label: string }[] {
  if (isFinancialYearValue(year)) {
    const y = Number(year.slice(2));
    const FY_MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];
    return FY_MONTHS.map((label, i) => {
      const calMonth = ((i + 3) % 12) + 1; // index 0 → April(4) ... index 11 → March(3)
      const calYear = i <= 8 ? y : y + 1;  // Apr–Dec stay in y; Jan–Mar roll into y+1
      return { value: `${calYear}-${String(calMonth).padStart(2, '0')}`, label };
    });
  }
  const y = year ? Number(year) : fallbackYear;
  return MONTH_NAMES_FULL.map((label, i) => ({ value: `${y}-${String(i + 1).padStart(2, '0')}`, label }));
}
