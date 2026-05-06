/**
 * Finance Prediction Algorithms
 *
 * Pure TypeScript — no React, no side-effects.
 *
 * Algorithms used:
 *  - OLS Linear Regression   — baseline trend + R² confidence
 *  - Holt's Double Exponential Smoothing — level + trend, best for
 *    monotonically growing/shrinking financial series
 *  - Weighted Moving Average  — short-window smoothing
 *  - Loan Amortisation        — deterministic payoff date from EMI schedule
 */

// ─── Linear Regression ─────────────────────────────────────────────────────

export interface RegressionResult {
  slope: number;
  intercept: number;
  /** Coefficient of determination (0–1). Higher = better fit. */
  r2: number;
}

/**
 * Ordinary Least Squares regression over an ordered value array.
 * x is implicitly 0, 1, 2, … (month index).
 */
export function linearRegression(ys: number[]): RegressionResult {
  const n = ys.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0 };
  if (n === 1) return { slope: 0, intercept: ys[0], r2: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX  += i;
    sumY  += ys[i];
    sumXY += i * ys[i];
    sumX2 += i * i;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (ys[i] - meanY) ** 2;
    ssRes += (ys[i] - (intercept + slope * i)) ** 2;
  }

  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  return { slope, intercept, r2 };
}

/** Forecast the next `ahead` values using OLS linear regression. */
export function forecastLinear(ys: number[], ahead: number): number[] {
  const { slope, intercept } = linearRegression(ys);
  const n = ys.length;
  return Array.from({ length: ahead }, (_, i) =>
    Math.max(0, Math.round(intercept + slope * (n + i)))
  );
}

// ─── Holt's Double Exponential Smoothing ───────────────────────────────────

/**
 * Holt's method: captures level + linear trend.
 * Preferred over simple regression for financial series with momentum.
 *
 * α (0–1) — smoothing factor for level.  Higher = more weight on recent.
 * β (0–1) — smoothing factor for trend.  Higher = trend adapts faster.
 */
export function holtSmoothing(
  ys: number[],
  ahead: number,
  alpha = 0.4,
  beta  = 0.3
): number[] {
  if (ys.length === 0) return Array(ahead).fill(0);
  if (ys.length === 1) return Array(ahead).fill(Math.max(0, ys[0]));

  let level = ys[0];
  let trend = ys[1] - ys[0];

  for (let i = 1; i < ys.length; i++) {
    const prevLevel = level;
    level = alpha * ys[i] + (1 - alpha) * (level + trend);
    trend = beta  * (level - prevLevel) + (1 - beta) * trend;
  }

  return Array.from({ length: ahead }, (_, m) =>
    Math.max(0, Math.round(level + (m + 1) * trend))
  );
}

/**
 * Pick the better of linear regression vs Holt smoothing by choosing
 * whichever has a higher R² on the in-sample fitted values.
 * Falls back to Holt when R² is low (noisy data).
 */
export function forecastBest(ys: number[], ahead: number): { values: number[]; method: 'holt' | 'linear'; r2: number } {
  const { r2 } = linearRegression(ys);
  if (r2 >= 0.7) {
    return { values: forecastLinear(ys, ahead), method: 'linear', r2 };
  }
  return { values: holtSmoothing(ys, ahead), method: 'holt', r2 };
}

// ─── Weighted Moving Average ────────────────────────────────────────────────

/** Last-window weighted average; more recent values get higher weight. */
export function weightedMovingAvg(ys: number[], window = 3): number {
  const slice   = ys.slice(-window);
  const weights = slice.map((_, i) => i + 1);
  const wSum    = weights.reduce((a, b) => a + b, 0);
  return slice.reduce((s, y, i) => s + y * weights[i], 0) / wSum;
}

// ─── Loan Payoff Estimation ─────────────────────────────────────────────────

export interface LoanPayoff {
  bank:            string;
  outstanding:     number;
  paid:            number;
  remaining:       number;
  avgMonthlyEmi:   number;
  monthsLeft:      number;
  payoffDate:      string;  // "Apr 2028"
  payoffISO:       string;  // "2028-04"
  /** Confidence is driven by number of EMI data points available. */
  confidence:      'high' | 'medium' | 'low';
  /** How many EMI records were used to compute the average. */
  sampleSize:      number;
}

export function loanPayoffEstimates(
  loans:     { bank_name: string; outstanding: number; paid: number }[],
  debtPlans: { bank_name: string; emi_amount:  number; status: string }[]
): LoanPayoff[] {
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return loans
    .map(loan => {
      const remaining = Math.max(0, Number(loan.outstanding) - Number(loan.paid));
      const plans     = debtPlans.filter(p => p.bank_name === loan.bank_name);
      const emis      = plans.map(p => Number(p.emi_amount)).filter(e => e > 0);

      if (emis.length === 0 || remaining === 0) return null;

      // Use WMA so recent EMI changes are weighted more heavily
      const avgMonthlyEmi = emis.length >= 3
        ? weightedMovingAvg(emis, Math.min(emis.length, 6))
        : emis.reduce((a, b) => a + b, 0) / emis.length;

      const monthsLeft = Math.ceil(remaining / avgMonthlyEmi);

      const payoff = new Date();
      payoff.setMonth(payoff.getMonth() + monthsLeft);
      const payoffDate = `${MONTHS_SHORT[payoff.getMonth()]} ${payoff.getFullYear()}`;
      const payoffISO  = `${payoff.getFullYear()}-${String(payoff.getMonth() + 1).padStart(2, '0')}`;

      const confidence: LoanPayoff['confidence'] =
        emis.length >= 4 ? 'high' : emis.length >= 2 ? 'medium' : 'low';

      return {
        bank: loan.bank_name,
        outstanding: Number(loan.outstanding),
        paid:        Number(loan.paid),
        remaining,
        avgMonthlyEmi,
        monthsLeft,
        payoffDate,
        payoffISO,
        confidence,
        sampleSize: emis.length,
      };
    })
    .filter((x): x is LoanPayoff => x !== null)
    .sort((a, b) => a.monthsLeft - b.monthsLeft);
}

// ─── Cashflow Forecast ──────────────────────────────────────────────────────

export interface CashflowForecast {
  month:      string;  // "Apr 2026" — display label
  monthISO:   string;  // "2026-04"
  revenue:    number;
  expenses:   number;
  loan:       number;
  net:        number;
  isForecast: true;
  method:     'holt' | 'linear';
}

/**
 * Project the next `ahead` months of cashflow using the best available
 * algorithm per metric (revenue, expenses, loan repayment).
 *
 * rows must be pre-sorted by month ascending.
 */
export function forecastCashflow(
  rows: { month: string; revenue: number; expenses: number; loan_repayment: number }[],
  ahead = 3
): CashflowForecast[] {
  if (rows.length < 2) return [];

  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const revenues  = rows.map(r => Number(r.revenue));
  const expenses  = rows.map(r => Number(r.expenses));
  const loans     = rows.map(r => Number(r.loan_repayment));

  const fRev  = forecastBest(revenues, ahead);
  const fExp  = forecastBest(expenses, ahead);
  const fLoan = forecastBest(loans,    ahead);

  // Determine the last month from the last row
  const lastISO = rows[rows.length - 1].month;             // YYYY-MM
  const lastYr  = Number(lastISO.slice(0, 4));
  const lastMo  = Number(lastISO.slice(5, 7));             // 1-based

  return Array.from({ length: ahead }, (_, i) => {
    // Advance (i+1) months from lastMo/lastYr
    const totalMo  = lastMo + (i + 1);                     // may exceed 12
    const newMo    = ((totalMo - 1) % 12) + 1;             // 1-based, wraps
    const newYr    = lastYr + Math.floor((totalMo - 1) / 12);
    const monthISO = `${newYr}-${String(newMo).padStart(2, '0')}`;
    const month    = `${MONTHS_SHORT[newMo - 1]} ${newYr}`;

    const revenue  = fRev.values[i];
    const expenses = fExp.values[i];
    const loan     = fLoan.values[i];

    return {
      month,
      monthISO,
      revenue,
      expenses,
      loan,
      net: revenue - expenses - loan,
      isForecast: true as const,
      method: fRev.method,
    };
  });
}

// ─── Confidence label helper ─────────────────────────────────────────────────

export function confidenceLabel(c: 'high' | 'medium' | 'low'): string {
  return c === 'high' ? 'High confidence' : c === 'medium' ? 'Medium confidence' : 'Low confidence (few data points)';
}

export function confidenceColor(c: 'high' | 'medium' | 'low'): string {
  return c === 'high' ? 'text-emerald-700' : c === 'medium' ? 'text-amber-700' : 'text-red-500';
}

// ─── Target Attainment Trend ────────────────────────────────────────────────

export type TrendDirection = 'improving' | 'stable' | 'declining';

export interface AttainmentTrend {
  /** Latest period attainment (0–100). */
  latestPct:   number;
  /** Average attainment over all provided periods. */
  avgPct:      number;
  /** Trend direction derived from linear regression slope on attainment %. */
  direction:   TrendDirection;
  /** Per-period slope in percentage points per period. */
  slopePerPeriod: number;
  /** Forecast attainment % for the next period. */
  nextPeriodForecast: number;
}

/**
 * Computes attainment trend for any series of { actual, target } pairs
 * sorted oldest-first. Used by CT, Deputation, and Projects tabs.
 *
 * direction thresholds: slope > +1pp = improving, < -1pp = declining, else stable.
 */
export function targetAttainmentTrend(
  rows: { actual: number; target: number }[]
): AttainmentTrend | null {
  if (rows.length === 0) return null;

  const pcts = rows
    .map(r => (r.target > 0 ? (r.actual / r.target) * 100 : null))
    .filter((v): v is number => v !== null);

  if (pcts.length === 0) return null;

  const { slope, intercept } = linearRegression(pcts);
  const avgPct    = pcts.reduce((a, b) => a + b, 0) / pcts.length;
  const latestPct = pcts[pcts.length - 1];
  const nextPeriodForecast = Math.min(150, Math.max(0, intercept + slope * pcts.length));

  const direction: TrendDirection =
    slope > 1  ? 'improving' :
    slope < -1 ? 'declining' : 'stable';

  return { latestPct, avgPct, direction, slopePerPeriod: slope, nextPeriodForecast };
}

// ─── Z-Score Anomaly Detection ─────────────────────────────────────────────

export interface AnomalyResult<T> {
  row:     T;
  zScore:  number;
  isSpike: boolean;
}

/**
 * Flags statistical outliers in a numeric series using z-score.
 * |z| > threshold (default 2.0) = anomaly.
 * Works per-category when you group rows before calling.
 */
export function zScoreAnomalies<T>(
  rows:      T[],
  getValue:  (r: T) => number,
  threshold = 2.0
): AnomalyResult<T>[] {
  if (rows.length < 3) return rows.map(r => ({ row: r, zScore: 0, isSpike: false }));

  const vals = rows.map(getValue);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const std  = Math.sqrt(vals.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / vals.length);

  return rows.map((row, i) => {
    const zScore  = std === 0 ? 0 : (vals[i] - mean) / std;
    return { row, zScore, isSpike: Math.abs(zScore) > threshold };
  });
}

/**
 * Groups cashflow transactions by category and returns any spending spikes.
 * Only reports Payment anomalies (outflows).
 */
export interface CashflowAnomaly {
  category:    string;
  date:        string | null;
  description: string | null;
  amount:      number;
  zScore:      number;
  categoryAvg: number;
}

export function detectCashflowAnomalies(
  rows: { category: string; date: string | null; description: string | null; payment: number; type: string }[],
  threshold = 2.0
): CashflowAnomaly[] {
  // Group payments by category
  const byCat = new Map<string, typeof rows>();
  for (const r of rows) {
    if (r.type !== 'Payment' || r.payment <= 0) continue;
    const arr = byCat.get(r.category) ?? [];
    arr.push(r);
    byCat.set(r.category, arr);
  }

  const result: CashflowAnomaly[] = [];
  for (const [category, catRows] of byCat.entries()) {
    const vals    = catRows.map(r => r.payment);
    const mean    = vals.reduce((a, b) => a + b, 0) / vals.length;
    const anomalies = zScoreAnomalies(catRows, r => r.payment, threshold);
    for (const a of anomalies) {
      if (a.isSpike) {
        result.push({
          category,
          date:        a.row.date,
          description: a.row.description,
          amount:      a.row.payment,
          zScore:      a.zScore,
          categoryAvg: mean,
        });
      }
    }
  }

  return result.sort((a, b) => b.zScore - a.zScore);
}

// ─── Fee Recovery Priority Score ────────────────────────────────────────────

export interface FeeRecoveryItem<T> {
  row:           T;
  outstanding:   number;
  daysOverdue:   number;
  priorityScore: number;
  /** HIGH / MEDIUM / LOW based on score quantiles. */
  priority:      'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Ranks overdue fee records by urgency.
 *
 * Score = outstanding_amount × log₁₀(1 + days_overdue)
 * Logarithm smooths extreme outliers; outstanding amount is the primary driver.
 */
export function feeRecoveryPriority<T extends { total_fees: number; paid: number; due_date: string | null }>(
  rows:    T[],
  todayISO: string
): FeeRecoveryItem<T>[] {
  const scored = rows
    .map(r => {
      const outstanding = Math.max(0, Number(r.total_fees) - Number(r.paid));
      if (outstanding <= 0) return null;

      let daysOverdue = 0;
      if (r.due_date) {
        const due   = new Date(r.due_date);
        const today = new Date(todayISO);
        daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000));
      }

      const priorityScore = outstanding * Math.log10(1 + daysOverdue + 1); // +1 so log(1)=0 is for 0 days
      return { row: r, outstanding, daysOverdue, priorityScore, priority: 'LOW' as const };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  if (scored.length === 0) return [];

  // Assign priority bands by score quantile (top 25% = HIGH, mid 50% = MEDIUM, bottom 25% = LOW)
  const scores = scored.map(s => s.priorityScore).sort((a, b) => b - a);
  const p75    = scores[Math.floor(scores.length * 0.25)];
  const p25    = scores[Math.floor(scores.length * 0.75)];

  return scored.map(s => ({
    ...s,
    priority: s.priorityScore >= p75 ? 'HIGH' : s.priorityScore >= p25 ? 'MEDIUM' : 'LOW',
  }));
}

// ─── Month-on-Month Category Growth ─────────────────────────────────────────

export interface CategoryGrowth {
  category:     string;
  currentMonth: string;
  currentAmt:   number;
  prevAmt:      number;
  growthPct:    number;
  direction:    'up' | 'down' | 'flat';
}

/**
 * Computes MoM growth rate per cashflow category for the two most recent months.
 * Useful for surfacing which expense categories are accelerating.
 */
export function categoryMoMGrowth(
  rows: { date: string | null; category: string; payment: number; type: string }[]
): CategoryGrowth[] {
  // Build month → category → total map
  const map = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (r.type !== 'Payment' || !r.date) continue;
    const mo = r.date.slice(0, 7); // YYYY-MM
    if (!map.has(mo)) map.set(mo, new Map());
    const catMap = map.get(mo)!;
    catMap.set(r.category, (catMap.get(r.category) ?? 0) + r.payment);
  }

  const months = Array.from(map.keys()).sort();
  if (months.length < 2) return [];

  const curMo  = months[months.length - 1];
  const prevMo = months[months.length - 2];
  const curMap  = map.get(curMo)  ?? new Map<string, number>();
  const prevMap = map.get(prevMo) ?? new Map<string, number>();

  const categories = new Set([...curMap.keys(), ...prevMap.keys()]);
  const result: CategoryGrowth[] = [];

  for (const category of categories) {
    const currentAmt = curMap.get(category)  ?? 0;
    const prevAmt    = prevMap.get(category) ?? 0;
    const growthPct  = prevAmt > 0 ? ((currentAmt - prevAmt) / prevAmt) * 100 : 0;
    result.push({
      category,
      currentMonth: curMo,
      currentAmt,
      prevAmt,
      growthPct,
      direction: growthPct > 2 ? 'up' : growthPct < -2 ? 'down' : 'flat',
    });
  }

  return result.sort((a, b) => b.growthPct - a.growthPct);
}

// ─── Department Risk Flags ───────────────────────────────────────────────────

export type DeptRisk = 'at-risk' | 'watch' | 'on-track';

export interface DeptRiskResult {
  department:   string;
  avgAttainment: number;
  trend:        TrendDirection;
  risk:         DeptRisk;
  /** Recommended action string. */
  recommendation: string;
}

/**
 * Aggregates multi-month DeptPerf records and flags underperforming departments.
 *
 * Risk thresholds:
 *   at-risk: avgAttainment < 50% OR (declining AND latestPct < 70%)
 *   watch:   avgAttainment < 75% OR declining trend
 *   on-track: everything else
 */
export function deptRiskFlags(
  rows: { department: string; amount_achieved: number; target_amount: number }[]
): DeptRiskResult[] {
  // Group by department
  const byDept = new Map<string, { actual: number; target: number }[]>();
  for (const r of rows) {
    const arr = byDept.get(r.department) ?? [];
    arr.push({ actual: Number(r.amount_achieved), target: Number(r.target_amount) });
    byDept.set(r.department, arr);
  }

  const results: DeptRiskResult[] = [];
  for (const [department, dRows] of byDept.entries()) {
    const trend = targetAttainmentTrend(dRows);
    if (!trend) continue;

    const { avgPct, direction } = trend;
    let risk: DeptRisk;
    let recommendation: string;

    if (avgPct < 50 || (direction === 'declining' && trend.latestPct < 70)) {
      risk           = 'at-risk';
      recommendation = 'Immediate review required — consistently below 50% target or declining sharply.';
    } else if (avgPct < 75 || direction === 'declining') {
      risk           = 'watch';
      recommendation = 'Monitor closely — performance below 75% target or showing downward trend.';
    } else {
      risk           = 'on-track';
      recommendation = 'Performing well. Continue current strategy.';
    }

    results.push({ department, avgAttainment: avgPct, trend: direction, risk, recommendation });
  }

  return results.sort((a, b) => a.avgAttainment - b.avgAttainment);
}

// ─── Generic Next-Month Forecast ────────────────────────────────────────────

/**
 * Given a sorted oldest-first array of monthly values, forecasts the next N months.
 * Uses forecastBest() — automatically selects Holt or Linear.
 */
export function forecastNextMonths(
  values: number[],
  ahead  = 3
): { index: number; value: number; method: 'holt' | 'linear' }[] {
  const { values: fc, method } = forecastBest(values, ahead);
  return fc.map((value, index) => ({ index: index + 1, value, method }));
}
