/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool } from '@/lib/db';
import { fetchMetaCampaignPerformance } from '@/lib/services/meta-ads.service';
import { resolveInquiryTableName } from '@/lib/services/inquiry.service';

const SCORE_TABLE = 'meta_ads_batch_scores';
const DEFAULT_TOTAL_BUDGET = 300;
const MAX_DAILY_TOTAL_BUDGET = 300;
const COURSE_HISTORY_WINDOW_DAYS = 180;
const CAMPAIGN_PERF_WINDOW_DAYS = 90;
const SMOOTH_ALPHA = 2;
const SMOOTH_BETA = 8;
const URGENCY_TAU_DAYS = 21;
const SOFTMAX_TEMPERATURE = 0.7;
const ADMITTED_STATUS_IDS = [7, 8, 10, 27];
const BATCHWISE_SCORE_FLOOR = 0.75;
const BATCHWISE_SCORE_CEIL = 1.35;
const PREVIOUS_ADS_COMPARISON_FLOOR = 0.75;
const PREVIOUS_ADS_COMPARISON_CEIL = 1.25;

type NumberLike = number | string | null | undefined;

interface UpcomingBatchRow {
  Batch_Id: NumberLike;
  Batch_code: string | null;
  Course_Id: NumberLike;
  Course_Name: string | null;
  SDate: string | null;
  EDate: string | null;
  INR_Basic: NumberLike;
  Max_Students: NumberLike;
  NoStudent: NumberLike;
}

interface CourseHistoryRow {
  Course_Id: NumberLike;
  meta_leads: NumberLike;
  admitted: NumberLike;
}

interface CampaignCourseLeadRow {
  campaign_key: string | null;
  Course_Id: NumberLike;
  leads: NumberLike;
}

interface CourseSignals {
  metaLeads: number;
  admitted: number;
  estimatedSpend: number;
  estimatedPaidLeads: number;
}

interface WorkingRecommendation {
  scoreDate: string;
  batchId: number;
  batchCode: string;
  courseId: number | null;
  courseName: string;
  startDate: string | null;
  endDate: string | null;
  daysToStart: number;
  maxStudents: number;
  studentsAdmitted: number;
  seatGap: number;
  gapRatio: number;
  urgency: number;
  leadToAdmissionRate: number;
  estimatedCpl: number | null;
  efficiencyScore: number;
  valueScore: number;
  priorityScore: number;
  confidenceScore: number;
  recommendedBudget: number;
  adAngle: string;
  effectivePlanStructured: EffectivePlanStructured;
  effectivePlan: string[];
  budgetWeight: number;
}

type EffectivePlanObjective = 'urgency' | 'conversion' | 'awareness';

export interface EffectivePlanStructured {
  objective: EffectivePlanObjective;
  audience: string;
  creativeTheme: string;
  cta: string;
  followUpSlaMinutes: number;
  cplGuardrail: number | null;
  dailyBudget: number;
}

export interface MetaBatchRecommendationRow {
  scoreDate: string;
  batchId: number;
  batchCode: string;
  courseId: number | null;
  courseName: string;
  startDate: string | null;
  endDate: string | null;
  daysToStart: number;
  maxStudents: number;
  studentsAdmitted: number;
  seatGap: number;
  gapRatio: number;
  urgency: number;
  leadToAdmissionRate: number;
  estimatedCpl: number | null;
  efficiencyScore: number;
  valueScore: number;
  priorityScore: number;
  confidenceScore: number;
  recommendedBudget: number;
  adAngle: string;
  effectivePlanStructured: EffectivePlanStructured;
  effectivePlan: string[];
}

export interface MetaBatchRecommendationResult {
  scoreDate: string;
  totalBudget: number;
  recommendations: MetaBatchRecommendationRow[];
  formula: string;
}

export const META_BATCH_SCORE_FORMULA =
  'score = (0.35*gap_ratio + 0.25*urgency + 0.20*lead_to_admission_rate + 0.10*efficiency_score + 0.10*value_score) * previous_ads_comparison * batchwise_multiplier * previous_budget_multiplier; total_daily_budget <= 300';

function derivePreviousAdsComparisonScore(params: {
  rowLeadToAdmissionRate: number;
  rowEstimatedCpl: number | null;
  benchmarkLeadToAdmissionRate: number;
  benchmarkCpl: number | null;
}): number {
  const convBase = Math.max(0.01, params.benchmarkLeadToAdmissionRate);
  const conversionDelta = clamp((params.rowLeadToAdmissionRate - convBase) / convBase, -1, 1);
  const conversionScore = clamp(0.5 + (0.5 * conversionDelta), 0, 1);

  let cplScore = 0.45;
  if (params.rowEstimatedCpl != null && params.rowEstimatedCpl > 0 && params.benchmarkCpl != null && params.benchmarkCpl > 0) {
    const cplRatio = params.benchmarkCpl / params.rowEstimatedCpl;
    cplScore = clamp((cplRatio - 0.5) / 1.5, 0, 1);
  }

  const blended = clamp((0.55 * conversionScore) + (0.45 * cplScore), 0, 1);
  return clamp(
    PREVIOUS_ADS_COMPARISON_FLOOR + (blended * (PREVIOUS_ADS_COMPARISON_CEIL - PREVIOUS_ADS_COMPARISON_FLOOR)),
    PREVIOUS_ADS_COMPARISON_FLOOR,
    PREVIOUS_ADS_COMPARISON_CEIL,
  );
}

function deriveBatchwiseMultiplier(params: {
  seatGap: number;
  maxStudents: number;
  daysToStart: number;
  metaLeads: number;
}): number {
  const seatPressure = params.maxStudents > 0
    ? clamp(params.seatGap / Math.max(1, params.maxStudents), 0, 1)
    : (params.seatGap > 0 ? 1 : 0);

  // Boost near-start batches so budgets shift faster to urgent intakes.
  const startWindowBoost = clamp(1 - (Math.max(0, params.daysToStart) / 45), 0, 1);

  // Penalize low-history courses so noisy rates do not dominate allocation.
  const dataConfidence = clamp(params.metaLeads / 50, 0, 1);

  const multiplier =
    1
    + (0.18 * seatPressure)
    + (0.12 * startWindowBoost)
    - (0.10 * (1 - dataConfidence));

  return clamp(multiplier, BATCHWISE_SCORE_FLOOR, BATCHWISE_SCORE_CEIL);
}

async function loadPreviousBudgetMap(scoreDate: string): Promise<Map<number, number>> {
  await ensureScoreTable();
  const pool = getPool();
  const [rows] = await pool.query<any[]>(
    `SELECT batch_id, recommended_budget
     FROM ${SCORE_TABLE}
     WHERE score_date = (
       SELECT MAX(score_date)
       FROM ${SCORE_TABLE}
       WHERE score_date < ?
     )`,
    [scoreDate]
  );

  const out = new Map<number, number>();
  for (const row of rows as any[]) {
    const batchId = Math.trunc(asNumber(row.batch_id));
    if (batchId <= 0) continue;
    out.set(batchId, Math.max(0, asNumber(row.recommended_budget)));
  }
  return out;
}

function normalizeBudgetHistory(previousBudgetMap: Map<number, number>): Map<number, number> {
  const values = Array.from(previousBudgetMap.values());
  if (values.length === 0) return new Map<number, number>();

  let min = values[0];
  let max = values[0];
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const range = max - min;
  const out = new Map<number, number>();
  for (const [batchId, budget] of previousBudgetMap.entries()) {
    out.set(batchId, range <= 0 ? 0.5 : (budget - min) / range);
  }
  return out;
}

function asNumber(value: NumberLike): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalizeCampaignKey(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function toDaysToStart(startDate: string | null): number {
  if (!startDate) return 999;
  const today = new Date();
  const start = new Date(`${startDate}T00:00:00`);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diff = start.getTime() - base;
  return Number.isFinite(diff) ? Math.round(diff / 86_400_000) : 999;
}

function minMaxNormalize(values: number[]): Map<number, number> {
  const out = new Map<number, number>();
  if (values.length === 0) return out;

  let min = values[0];
  let max = values[0];
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const range = max - min;
  values.forEach((value, index) => {
    out.set(index, range <= 0 ? 0.5 : (value - min) / range);
  });
  return out;
}

function chooseAdAngle(row: {
  daysToStart: number;
  seatGap: number;
  gapRatio: number;
  leadToAdmissionRate: number;
  efficiencyScore: number;
}): string {
  if (row.daysToStart <= 10 && row.seatGap > 0) {
    return 'Urgency push: limited seats + start-date CTA + fast counsellor callback';
  }
  if (row.leadToAdmissionRate >= 0.22 && row.efficiencyScore >= 0.6) {
    return 'High-intent conversion: testimonials + placement proof + direct apply CTA';
  }
  if (row.gapRatio >= 0.45) {
    return 'Admissions drive: syllabus clarity + fee plans + counselling session CTA';
  }
  return 'Awareness nurture: career outcomes + faculty credibility + lead form objective';
}

function deriveConfidenceScore(params: {
  metaLeads: number;
  admitted: number;
  estimatedCpl: number | null;
  daysToStart: number;
}): number {
  const leadEvidence = clamp(Math.log1p(Math.max(0, params.metaLeads)) / Math.log1p(80), 0, 1);
  const admissionEvidence = clamp(Math.max(0, params.admitted) / 15, 0, 1);
  const cplEvidence = params.estimatedCpl != null && params.estimatedCpl > 0 ? 1 : 0.4;
  const timelineStability = params.daysToStart <= 3 ? 0.7 : 1;
  return clamp(
    (0.45 * leadEvidence)
    + (0.30 * admissionEvidence)
    + (0.15 * cplEvidence)
    + (0.10 * timelineStability),
    0,
    1,
  );
}

function buildStructuredEffectivePlan(row: {
  daysToStart: number;
  gapRatio: number;
  leadToAdmissionRate: number;
  estimatedCpl: number | null;
  recommendedBudget: number;
}): EffectivePlanStructured {
  if (row.daysToStart <= 10) {
    return {
      objective: 'urgency',
      audience: 'Recent engagers + high-intent prospects from last 30 days',
      creativeTheme: 'Limited seats, start-date countdown, immediate counselor access',
      cta: 'Apply today / Book counseling now',
      followUpSlaMinutes: 15,
      cplGuardrail: row.estimatedCpl && row.estimatedCpl > 0 ? Math.round(row.estimatedCpl) : null,
      dailyBudget: Math.max(0, Math.round(row.recommendedBudget)),
    };
  }

  if (row.leadToAdmissionRate >= 0.12 || row.gapRatio >= 0.4) {
    return {
      objective: 'conversion',
      audience: 'Qualified lead pools, website visitors, and lookalike of admitted students',
      creativeTheme: 'Placement proof, alumni results, fee-plan clarity, counselor support',
      cta: 'Schedule a call / Start application',
      followUpSlaMinutes: 30,
      cplGuardrail: row.estimatedCpl && row.estimatedCpl > 0 ? Math.round(row.estimatedCpl) : null,
      dailyBudget: Math.max(0, Math.round(row.recommendedBudget)),
    };
  }

  return {
    objective: 'awareness',
    audience: 'Broad interest audiences and early-stage career explorers',
    creativeTheme: 'Career outcomes, curriculum highlights, faculty credibility',
    cta: 'Download brochure / Know more',
    followUpSlaMinutes: 60,
    cplGuardrail: row.estimatedCpl && row.estimatedCpl > 0 ? Math.round(row.estimatedCpl) : null,
    dailyBudget: Math.max(0, Math.round(row.recommendedBudget)),
  };
}

function buildEffectivePlan(row: {
  courseName: string;
  batchCode: string;
  daysToStart: number;
  seatGap: number;
  maxStudents: number;
  gapRatio: number;
  leadToAdmissionRate: number;
  estimatedCpl: number | null;
  recommendedBudget: number;
  structured: EffectivePlanStructured;
}): string[] {
  const plan: string[] = [];
  const budget = Math.max(0, Math.round(row.recommendedBudget));
  const cpl = row.structured.cplGuardrail && row.structured.cplGuardrail > 0
    ? row.structured.cplGuardrail
    : (row.estimatedCpl && row.estimatedCpl > 0 ? Math.round(row.estimatedCpl) : 300);

  const split = row.structured.objective === 'urgency'
    ? { prospecting: 35, remarketing: 65 }
    : row.structured.objective === 'conversion'
      ? { prospecting: 55, remarketing: 45 }
      : { prospecting: 75, remarketing: 25 };

  const prospectingBudget = Math.round((budget * split.prospecting) / 100);
  const remarketingBudget = Math.max(0, budget - prospectingBudget);

  const leadsPerDay = cpl > 0 ? (budget / cpl) : 0;
  const leadsPerWeek = leadsPerDay * 7;
  const admissionsPerWeek = leadsPerWeek * Math.max(0, row.leadToAdmissionRate);

  const creativeCount = row.structured.objective === 'urgency' ? 4 : row.structured.objective === 'conversion' ? 5 : 6;
  const refreshDays = row.structured.objective === 'urgency' ? 3 : 5;

  plan.push(`Execution window: ${Math.max(0, row.daysToStart)} days to batch ${row.batchCode}; fill ${Math.round(row.seatGap)} seats (gap ${Math.round(row.gapRatio * 100)}%).`);
  plan.push(`Daily budget split: ₹${budget} -> Prospecting ${split.prospecting}% (₹${prospectingBudget}) + Remarketing ${split.remarketing}% (₹${remarketingBudget}).`);
  plan.push(`Creative plan: ${creativeCount} active ads (${row.structured.creativeTheme}) with refresh every ${refreshDays} days; CTA: ${row.structured.cta}.`);
  plan.push(`Ops plan: callback SLA ${row.structured.followUpSlaMinutes} min, 3-attempt cadence at 0h/24h/72h, and qualify lead intent before counselor assignment.`);
  plan.push(`Target metrics: CPL <= ₹${Math.round(cpl)}, ~${Math.round(leadsPerDay)} leads/day (~${Math.round(leadsPerWeek)}/week), ~${admissionsPerWeek.toFixed(1)} admissions/week.`);

  return plan;
}

function parseSnapshotPayload(snapshotJson: unknown): {
  effectivePlan: string[];
  effectivePlanStructured: EffectivePlanStructured | null;
  confidenceScore: number | null;
} {
  const fallback = {
    effectivePlan: [] as string[],
    effectivePlanStructured: null as EffectivePlanStructured | null,
    confidenceScore: null as number | null,
  };

  if (!snapshotJson) return fallback;

  try {
    const parsed = JSON.parse(String(snapshotJson || '{}')) as {
      effectivePlan?: unknown;
      effectivePlanStructured?: Partial<EffectivePlanStructured> | null;
      confidenceScore?: unknown;
    };

    const effectivePlan = Array.isArray(parsed.effectivePlan)
      ? parsed.effectivePlan.map((item) => String(item).trim()).filter(Boolean)
      : [];

    let effectivePlanStructured: EffectivePlanStructured | null = null;
    if (parsed.effectivePlanStructured && typeof parsed.effectivePlanStructured === 'object') {
      const objectiveRaw = String(parsed.effectivePlanStructured.objective || '').toLowerCase();
      const objective: EffectivePlanObjective = objectiveRaw === 'urgency' || objectiveRaw === 'conversion' || objectiveRaw === 'awareness'
        ? objectiveRaw
        : 'awareness';

      effectivePlanStructured = {
        objective,
        audience: String(parsed.effectivePlanStructured.audience || '').trim(),
        creativeTheme: String(parsed.effectivePlanStructured.creativeTheme || '').trim(),
        cta: String(parsed.effectivePlanStructured.cta || '').trim(),
        followUpSlaMinutes: Math.max(5, Math.trunc(asNumber(parsed.effectivePlanStructured.followUpSlaMinutes as NumberLike))),
        cplGuardrail: parsed.effectivePlanStructured.cplGuardrail == null ? null : Math.max(0, asNumber(parsed.effectivePlanStructured.cplGuardrail as NumberLike)),
        dailyBudget: Math.max(0, Math.round(asNumber(parsed.effectivePlanStructured.dailyBudget as NumberLike))),
      };
    }

    const confidenceRaw = asNumber(parsed.confidenceScore as NumberLike);
    const confidenceScore = Number.isFinite(confidenceRaw) ? clamp(confidenceRaw, 0, 1) : null;

    return {
      effectivePlan,
      effectivePlanStructured,
      confidenceScore,
    };
  } catch {
    return fallback;
  }
}

async function ensureScoreTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${SCORE_TABLE} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      score_date DATE NOT NULL,
      batch_id INT NOT NULL,
      batch_code VARCHAR(120) NOT NULL DEFAULT '',
      course_id INT NULL,
      course_name VARCHAR(255) NOT NULL DEFAULT '',
      start_date DATE NULL,
      end_date DATE NULL,
      days_to_start INT NOT NULL DEFAULT 0,
      max_students DECIMAL(12,2) NOT NULL DEFAULT 0,
      students_admitted DECIMAL(12,2) NOT NULL DEFAULT 0,
      seat_gap DECIMAL(12,2) NOT NULL DEFAULT 0,
      gap_ratio DECIMAL(10,6) NOT NULL DEFAULT 0,
      urgency DECIMAL(10,6) NOT NULL DEFAULT 0,
      lead_to_admission_rate DECIMAL(10,6) NOT NULL DEFAULT 0,
      estimated_cpl DECIMAL(12,2) NULL,
      efficiency_score DECIMAL(10,6) NOT NULL DEFAULT 0,
      value_score DECIMAL(10,6) NOT NULL DEFAULT 0,
      priority_score DECIMAL(10,6) NOT NULL DEFAULT 0,
      budget_weight DECIMAL(12,8) NOT NULL DEFAULT 0,
      recommended_budget DECIMAL(12,2) NOT NULL DEFAULT 0,
      ad_angle VARCHAR(255) NOT NULL DEFAULT '',
      snapshot_json LONGTEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_meta_ads_batch_scores (score_date, batch_id),
      KEY idx_meta_ads_batch_score_date (score_date),
      KEY idx_meta_ads_batch_course (course_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function loadUpcomingBatches(): Promise<UpcomingBatchRow[]> {
  const pool = getPool();
  const [rows] = await pool.query<any[]>(
    `SELECT
       b.Batch_Id,
       b.Batch_code,
       b.Course_Id,
       COALESCE(NULLIF(TRIM(c.Course_Name), ''), NULLIF(TRIM(b.CourseName), ''), 'Unknown Course') AS Course_Name,
       DATE_FORMAT(b.SDate, '%Y-%m-%d') AS SDate,
       DATE_FORMAT(b.EDate, '%Y-%m-%d') AS EDate,
       b.INR_Basic,
       b.Max_Students,
       b.NoStudent
     FROM batch_mst b
     LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
     WHERE (b.IsDelete IS NULL OR b.IsDelete = 0)
       AND (b.Cancel IS NULL OR b.Cancel = 0)
       AND b.SDate >= CURDATE()
     ORDER BY b.SDate ASC
     LIMIT 300`
  );
  return rows as UpcomingBatchRow[];
}

async function loadCourseHistorySignals(): Promise<Map<number, CourseSignals>> {
  const pool = getPool();
  const sinceDate = isoDateDaysAgo(COURSE_HISTORY_WINDOW_DAYS);
  const perfDateFrom = isoDateDaysAgo(CAMPAIGN_PERF_WINDOW_DAYS);
  const perfDateTo = isoToday();

  const inquiryTable = await resolveInquiryTableName(pool);

  const [courseRows, campaignCourseRows, campaigns] = await Promise.all([
    pool.query<any[]>(
      `SELECT
         si.Course_Id,
         COUNT(*) AS meta_leads,
         SUM(CASE WHEN CAST(NULLIF(si.OnlineState,'') AS UNSIGNED) IN (${ADMITTED_STATUS_IDS.join(',')}) THEN 1 ELSE 0 END) AS admitted
       FROM meta_ads_lead_sync m
       INNER JOIN \`${inquiryTable}\` si ON si.Inquiry_Id = m.inquiry_id
       WHERE m.created_at >= ?
         AND (si.IsDelete IS NULL OR si.IsDelete = 0)
         AND si.Course_Id IS NOT NULL
       GROUP BY si.Course_Id`,
      [sinceDate]
    ),
    pool.query<any[]>(
      `SELECT
         LOWER(TRIM(m.campaign_name)) AS campaign_key,
         si.Course_Id,
         COUNT(*) AS leads
       FROM meta_ads_lead_sync m
       INNER JOIN \`${inquiryTable}\` si ON si.Inquiry_Id = m.inquiry_id
       WHERE m.created_at >= ?
         AND (si.IsDelete IS NULL OR si.IsDelete = 0)
         AND si.Course_Id IS NOT NULL
         AND m.campaign_name IS NOT NULL
         AND TRIM(m.campaign_name) <> ''
       GROUP BY LOWER(TRIM(m.campaign_name)), si.Course_Id`,
      [perfDateFrom]
    ),
    fetchMetaCampaignPerformance({ dateFrom: perfDateFrom, dateTo: perfDateTo }),
  ]);

  const baseSignals = new Map<number, CourseSignals>();
  for (const row of (courseRows[0] as CourseHistoryRow[])) {
    const courseId = Math.trunc(asNumber(row.Course_Id));
    if (courseId <= 0) continue;
    baseSignals.set(courseId, {
      metaLeads: Math.max(0, asNumber(row.meta_leads)),
      admitted: Math.max(0, asNumber(row.admitted)),
      estimatedSpend: 0,
      estimatedPaidLeads: 0,
    });
  }

  const campaignTotals = new Map<string, { spend: number; leads: number }>();
  for (const campaign of campaigns) {
    const key = normalizeCampaignKey(String(campaign.campaignName ?? campaign.campaignId ?? ''));
    if (!key) continue;
    campaignTotals.set(key, {
      spend: Math.max(0, asNumber(campaign.spend)),
      leads: Math.max(0, asNumber(campaign.leads)),
    });
  }

  const campaignCourseLeads = new Map<string, Map<number, number>>();
  for (const row of (campaignCourseRows[0] as CampaignCourseLeadRow[])) {
    const key = normalizeCampaignKey(row.campaign_key);
    const courseId = Math.trunc(asNumber(row.Course_Id));
    const leads = Math.max(0, asNumber(row.leads));
    if (!key || courseId <= 0 || leads <= 0) continue;
    if (!campaignCourseLeads.has(key)) campaignCourseLeads.set(key, new Map());
    const bucket = campaignCourseLeads.get(key)!;
    bucket.set(courseId, (bucket.get(courseId) || 0) + leads);
  }

  for (const [campaignKey, courseLeadMap] of campaignCourseLeads.entries()) {
    const totals = campaignTotals.get(campaignKey);
    if (!totals) continue;

    let campaignLeadsForSplit = 0;
    for (const leads of courseLeadMap.values()) campaignLeadsForSplit += leads;
    if (campaignLeadsForSplit <= 0) continue;

    for (const [courseId, leads] of courseLeadMap.entries()) {
      const share = leads / campaignLeadsForSplit;
      const signal = baseSignals.get(courseId) || {
        metaLeads: 0,
        admitted: 0,
        estimatedSpend: 0,
        estimatedPaidLeads: 0,
      };
      signal.estimatedSpend += totals.spend * share;
      signal.estimatedPaidLeads += totals.leads * share;
      baseSignals.set(courseId, signal);
    }
  }

  return baseSignals;
}

function mapPublicRow(row: WorkingRecommendation): MetaBatchRecommendationRow {
  return {
    scoreDate: row.scoreDate,
    batchId: row.batchId,
    batchCode: row.batchCode,
    courseId: row.courseId,
    courseName: row.courseName,
    startDate: row.startDate,
    endDate: row.endDate,
    daysToStart: row.daysToStart,
    maxStudents: row.maxStudents,
    studentsAdmitted: row.studentsAdmitted,
    seatGap: row.seatGap,
    gapRatio: row.gapRatio,
    urgency: row.urgency,
    leadToAdmissionRate: row.leadToAdmissionRate,
    estimatedCpl: row.estimatedCpl,
    efficiencyScore: row.efficiencyScore,
    valueScore: row.valueScore,
    priorityScore: row.priorityScore,
    confidenceScore: row.confidenceScore,
    recommendedBudget: row.recommendedBudget,
    adAngle: row.adAngle,
    effectivePlanStructured: row.effectivePlanStructured,
    effectivePlan: row.effectivePlan,
  };
}

function deriveBudgetWeights(scores: number[]): number[] {
  if (!scores.length) return [];
  const maxScore = Math.max(...scores);
  const exps = scores.map((score) => Math.exp((score - maxScore) / SOFTMAX_TEMPERATURE));
  const sum = exps.reduce((acc, curr) => acc + curr, 0);
  if (sum <= 0) return scores.map(() => 1 / scores.length);
  return exps.map((value) => value / sum);
}

export async function generateMetaBatchRecommendations(options?: {
  totalBudget?: number;
  scoreDate?: string;
}): Promise<MetaBatchRecommendationResult> {
  const totalBudgetRaw = asNumber(options?.totalBudget ?? process.env.META_ADS_RECOMMENDATION_BUDGET ?? DEFAULT_TOTAL_BUDGET);
  const totalBudgetRequested = totalBudgetRaw > 0 ? totalBudgetRaw : DEFAULT_TOTAL_BUDGET;
  const totalBudget = clamp(totalBudgetRequested, 1, MAX_DAILY_TOTAL_BUDGET);
  const scoreDate = options?.scoreDate || isoToday();

  const [batches, courseSignals, previousBudgetMap] = await Promise.all([
    loadUpcomingBatches(),
    loadCourseHistorySignals(),
    loadPreviousBudgetMap(scoreDate),
  ]);
  const normalizedBudgetHistory = normalizeBudgetHistory(previousBudgetMap);

  const workingRows: WorkingRecommendation[] = [];

  for (const batch of batches) {
    const batchId = Math.trunc(asNumber(batch.Batch_Id));
    if (batchId <= 0) continue;

    const courseIdRaw = Math.trunc(asNumber(batch.Course_Id));
    const courseId = courseIdRaw > 0 ? courseIdRaw : null;
    const courseName = String(batch.Course_Name || 'Unknown Course').trim() || 'Unknown Course';
    const maxStudents = Math.max(0, asNumber(batch.Max_Students));
    const studentsAdmitted = Math.max(0, asNumber(batch.NoStudent));
    const seatGap = Math.max(0, maxStudents - studentsAdmitted);
    const gapRatio = maxStudents > 0 ? clamp(seatGap / maxStudents, 0, 1) : (seatGap > 0 ? 1 : 0);
    const daysToStart = toDaysToStart(batch.SDate || null);
    const urgency = clamp(Math.exp(-Math.max(0, daysToStart) / URGENCY_TAU_DAYS), 0, 1);

    const signals = courseId ? courseSignals.get(courseId) : undefined;
    const metaLeads = signals?.metaLeads ?? 0;
    const admitted = signals?.admitted ?? 0;
    const leadToAdmissionRate = clamp((admitted + SMOOTH_ALPHA) / (metaLeads + SMOOTH_ALPHA + SMOOTH_BETA), 0, 1);
    const estimatedCpl =
      signals && signals.estimatedSpend > 0 && signals.estimatedPaidLeads > 0
        ? signals.estimatedSpend / signals.estimatedPaidLeads
        : null;
    const inrBasic = Math.max(0, asNumber(batch.INR_Basic));
    const valueRaw = Math.log1p(seatGap * inrBasic);

    workingRows.push({
      scoreDate,
      batchId,
      batchCode: String(batch.Batch_code || '').trim() || `Batch ${batchId}`,
      courseId,
      courseName,
      startDate: batch.SDate || null,
      endDate: batch.EDate || null,
      daysToStart,
      maxStudents,
      studentsAdmitted,
      seatGap,
      gapRatio,
      urgency,
      leadToAdmissionRate,
      estimatedCpl,
      efficiencyScore: 0,
      valueScore: valueRaw,
      priorityScore: 0,
      confidenceScore: 0,
      recommendedBudget: 0,
      adAngle: '',
      effectivePlanStructured: {
        objective: 'awareness',
        audience: '',
        creativeTheme: '',
        cta: '',
        followUpSlaMinutes: 60,
        cplGuardrail: null,
        dailyBudget: 0,
      },
      effectivePlan: [],
      budgetWeight: 0,
    });
  }

  const valueNormMap = minMaxNormalize(workingRows.map((row) => row.valueScore));

  const cplValues = workingRows
    .map((row) => row.estimatedCpl)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  let cplMin = Number.POSITIVE_INFINITY;
  let cplMax = Number.NEGATIVE_INFINITY;
  for (const cpl of cplValues) {
    if (cpl < cplMin) cplMin = cpl;
    if (cpl > cplMax) cplMax = cpl;
  }
  const cplRange = cplMax - cplMin;
  const benchmarkLeadToAdmissionRate = workingRows.length > 0
    ? workingRows.reduce((sum, row) => sum + row.leadToAdmissionRate, 0) / workingRows.length
    : 0;
  const benchmarkCpl = cplValues.length > 0
    ? cplValues.reduce((sum, value) => sum + value, 0) / cplValues.length
    : null;

  workingRows.forEach((row, index) => {
    row.valueScore = valueNormMap.get(index) ?? 0.5;
    if (row.estimatedCpl === null || !Number.isFinite(row.estimatedCpl)) {
      row.efficiencyScore = 0.35;
    } else if (cplRange <= 0) {
      row.efficiencyScore = 0.5;
    } else {
      row.efficiencyScore = clamp(1 - ((row.estimatedCpl - cplMin) / cplRange), 0, 1);
    }

    const baseScore = clamp(
      (0.35 * row.gapRatio)
      + (0.25 * row.urgency)
      + (0.20 * row.leadToAdmissionRate)
      + (0.10 * row.efficiencyScore)
      + (0.10 * row.valueScore),
      0,
      1,
    );

    const previousAdsComparison = derivePreviousAdsComparisonScore({
      rowLeadToAdmissionRate: row.leadToAdmissionRate,
      rowEstimatedCpl: row.estimatedCpl,
      benchmarkLeadToAdmissionRate,
      benchmarkCpl,
    });

    const previousBudgetNorm = normalizedBudgetHistory.get(row.batchId) ?? 0.5;
    const previousBudgetMultiplier = clamp(0.9 + (0.2 * previousBudgetNorm), 0.9, 1.1);

    const signals = row.courseId ? courseSignals.get(row.courseId) : undefined;
    row.confidenceScore = deriveConfidenceScore({
      metaLeads: signals?.metaLeads ?? 0,
      admitted: signals?.admitted ?? 0,
      estimatedCpl: row.estimatedCpl,
      daysToStart: row.daysToStart,
    });

    const batchwiseMultiplier = deriveBatchwiseMultiplier({
      seatGap: row.seatGap,
      maxStudents: row.maxStudents,
      daysToStart: row.daysToStart,
      metaLeads: signals?.metaLeads ?? 0,
    });

    row.priorityScore = Math.max(0, baseScore * previousAdsComparison * batchwiseMultiplier * previousBudgetMultiplier);

    row.adAngle = chooseAdAngle(row);
  });

  const budgetEligible = workingRows.filter((row) => row.seatGap > 0);
  const weights = deriveBudgetWeights(budgetEligible.map((row) => row.priorityScore));
  budgetEligible.forEach((row, idx) => {
    row.budgetWeight = weights[idx] ?? 0;
    row.recommendedBudget = Math.min(MAX_DAILY_TOTAL_BUDGET, Math.round(totalBudget * row.budgetWeight));
  });

  workingRows.forEach((row) => {
    row.effectivePlanStructured = buildStructuredEffectivePlan({
      daysToStart: row.daysToStart,
      gapRatio: row.gapRatio,
      leadToAdmissionRate: row.leadToAdmissionRate,
      estimatedCpl: row.estimatedCpl,
      recommendedBudget: row.recommendedBudget,
    });

    row.effectivePlan = buildEffectivePlan({
      courseName: row.courseName,
      batchCode: row.batchCode,
      daysToStart: row.daysToStart,
      seatGap: row.seatGap,
      maxStudents: row.maxStudents,
      gapRatio: row.gapRatio,
      leadToAdmissionRate: row.leadToAdmissionRate,
      estimatedCpl: row.estimatedCpl,
      recommendedBudget: row.recommendedBudget,
      structured: row.effectivePlanStructured,
    });
  });

  const sorted = workingRows
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return a.daysToStart - b.daysToStart;
    });

  return {
    scoreDate,
    totalBudget,
    recommendations: sorted.map(mapPublicRow),
    formula: META_BATCH_SCORE_FORMULA,
  };
}

export async function persistMetaBatchRecommendations(options?: {
  totalBudget?: number;
  scoreDate?: string;
}): Promise<MetaBatchRecommendationResult> {
  await ensureScoreTable();
  const result = await generateMetaBatchRecommendations(options);
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM ${SCORE_TABLE} WHERE score_date = ?`, [result.scoreDate]);

    for (const row of result.recommendations) {
      await conn.query(
        `INSERT INTO ${SCORE_TABLE} (
          score_date,
          batch_id,
          batch_code,
          course_id,
          course_name,
          start_date,
          end_date,
          days_to_start,
          max_students,
          students_admitted,
          seat_gap,
          gap_ratio,
          urgency,
          lead_to_admission_rate,
          estimated_cpl,
          efficiency_score,
          value_score,
          priority_score,
          budget_weight,
          recommended_budget,
          ad_angle,
          snapshot_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.scoreDate,
          row.batchId,
          row.batchCode,
          row.courseId,
          row.courseName,
          row.startDate,
          row.endDate,
          row.daysToStart,
          row.maxStudents,
          row.studentsAdmitted,
          row.seatGap,
          row.gapRatio,
          row.urgency,
          row.leadToAdmissionRate,
          row.estimatedCpl,
          row.efficiencyScore,
          row.valueScore,
          row.priorityScore,
          result.totalBudget > 0 ? row.recommendedBudget / result.totalBudget : 0,
          row.recommendedBudget,
          row.adAngle,
          JSON.stringify({
            formula: result.formula,
            totalBudget: result.totalBudget,
            effectivePlan: row.effectivePlan,
            effectivePlanStructured: row.effectivePlanStructured,
            confidenceScore: row.confidenceScore,
          }),
        ]
      );
    }

    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function getPersistedMetaBatchRecommendations(options?: {
  scoreDate?: string;
  limit?: number;
}): Promise<MetaBatchRecommendationRow[]> {
  await ensureScoreTable();
  const scoreDate = options?.scoreDate || isoToday();
  const limit = clamp(Math.trunc(asNumber(options?.limit || 10)), 1, 100);
  const pool = getPool();

  const [rows] = await pool.query<any[]>(
    `SELECT
       score_date,
       batch_id,
       batch_code,
       course_id,
       course_name,
       DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
       DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
       days_to_start,
       max_students,
       students_admitted,
       seat_gap,
       gap_ratio,
       urgency,
       lead_to_admission_rate,
       estimated_cpl,
       efficiency_score,
       value_score,
       priority_score,
       recommended_budget,
       ad_angle,
       snapshot_json
     FROM ${SCORE_TABLE}
     WHERE score_date = ?
     ORDER BY priority_score DESC, days_to_start ASC
     LIMIT ?`,
    [scoreDate, limit]
  );

  return (rows as any[]).map((row) => {
    const snapshot = parseSnapshotPayload(row.snapshot_json);

    return {
      scoreDate: String(row.score_date),
      batchId: Math.trunc(asNumber(row.batch_id)),
      batchCode: String(row.batch_code || ''),
      courseId: row.course_id != null ? Math.trunc(asNumber(row.course_id)) : null,
      courseName: String(row.course_name || 'Unknown Course'),
      startDate: row.start_date ? String(row.start_date) : null,
      endDate: row.end_date ? String(row.end_date) : null,
      daysToStart: Math.trunc(asNumber(row.days_to_start)),
      maxStudents: asNumber(row.max_students),
      studentsAdmitted: asNumber(row.students_admitted),
      seatGap: asNumber(row.seat_gap),
      gapRatio: asNumber(row.gap_ratio),
      urgency: asNumber(row.urgency),
      leadToAdmissionRate: asNumber(row.lead_to_admission_rate),
      estimatedCpl: row.estimated_cpl == null ? null : asNumber(row.estimated_cpl),
      efficiencyScore: asNumber(row.efficiency_score),
      valueScore: asNumber(row.value_score),
      priorityScore: asNumber(row.priority_score),
      confidenceScore: snapshot.confidenceScore ?? 0.5,
      recommendedBudget: asNumber(row.recommended_budget),
      adAngle: String(row.ad_angle || ''),
      effectivePlanStructured: snapshot.effectivePlanStructured || {
        objective: 'awareness',
        audience: 'General eligible audience',
        creativeTheme: 'Career outcomes + faculty credibility',
        cta: 'Know more',
        followUpSlaMinutes: 60,
        cplGuardrail: null,
        dailyBudget: Math.max(0, Math.round(asNumber(row.recommended_budget))),
      },
      effectivePlan: snapshot.effectivePlan,
    };
  });
}
