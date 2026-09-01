/* eslint-disable @typescript-eslint/no-explicit-any */
import { cached, getPool, invalidateCache } from '@/lib/db';
import { getSlowRequestThresholdMs } from '@/lib/perf-log';
import {
  ensureInquiryPersonColumns,
  resolvePersonForEnquiry,
  detectReEnquiry,
  recordIdentityConflict,
} from '@/lib/services/person.service';

let inquiryTableNameCache: string | null = null;
let disciplineTableNameCache: string | null | undefined;
let inquirySchemaWarmupPromise: Promise<void> | null = null;
let metaLeadSchemaWarmupPromise: Promise<void> | null = null;
let inquirySupportsStatementTimeout: boolean | null = null;
const inquiryDateColumnReadyTables = new Set<string>();
const inquiryFilterOptionsMemoryCache = new Map<string, InquiryFilterOptions>();

function withStatementTimeout(sql: string, seconds: number): string {
  const safeSeconds = Math.max(1, Math.min(30, Math.trunc(seconds)));
  return `SET STATEMENT max_statement_time=${safeSeconds} FOR ${sql}`;
}

async function runGuardedQuery(
  pool: ReturnType<typeof getPool>,
  sql: string,
  params: any[] = [],
  statementTimeoutSeconds?: number,
): Promise<any[]> {
  const timeoutSql = statementTimeoutSeconds && inquirySupportsStatementTimeout !== false
    ? withStatementTimeout(sql, statementTimeoutSeconds)
    : sql;

  try {
    const [rows] = await pool.query(timeoutSql, params);
    return rows as any[];
  } catch (error: any) {
    if (timeoutSql !== sql && (error?.errno === 1969 || error?.sqlState === '70100')) {
      inquirySupportsStatementTimeout = true;
      const [rows] = await pool.query(sql, params);
      return rows as any[];
    }

    if (timeoutSql !== sql && inquirySupportsStatementTimeout !== false) {
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('max_statement_time') || message.includes('syntax')) {
        inquirySupportsStatementTimeout = false;
        const [rows] = await pool.query(sql, params);
        return rows as any[];
      }
    }

    if (timeoutSql !== sql) inquirySupportsStatementTimeout = true;
    throw error;
  }
}

function getInquiryDateColumnCacheKey(inquiryTable: string): string {
  return `schema:inquiry-date-column:${inquiryTable}`;
}

async function hasInquiryDateColumn(pool: ReturnType<typeof getPool>, inquiryTable: string): Promise<boolean> {
  if (inquiryDateColumnReadyTables.has(inquiryTable)) return true;

  const exists = await cached(
    getInquiryDateColumnCacheKey(inquiryTable),
    60 * 60 * 1000,
    async () => {
      const [rows] = await pool.query(
        `SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
           AND COLUMN_NAME = '_inquiry_date'
         LIMIT 1`,
        [inquiryTable]
      );
      return (rows as any[]).length > 0;
    }
  );

  if (exists) inquiryDateColumnReadyTables.add(inquiryTable);
  return exists;
}

function warmInquirySchema(pool: ReturnType<typeof getPool>, inquiryTable: string): void {
  if (inquirySchemaWarmupPromise) return;
  inquirySchemaWarmupPromise = ensureInquirySchema(pool, inquiryTable)
    .then(() => {
      inquiryDateColumnReadyTables.add(inquiryTable);
      invalidateCache(getInquiryDateColumnCacheKey(inquiryTable));
    })
    .catch(() => {
      // Keep listing responsive even if best-effort schema maintenance fails.
    })
    .finally(() => {
      inquirySchemaWarmupPromise = null;
    });
}

function warmMetaLeadSchema(pool: ReturnType<typeof getPool>): void {
  if (metaLeadSchemaWarmupPromise) return;
  metaLeadSchemaWarmupPromise = ensureMetaLeadSchema(pool)
    .catch(() => {
      // Keep listing responsive even if best-effort schema maintenance fails.
    })
    .finally(() => {
      metaLeadSchemaWarmupPromise = null;
    });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateInquiryInput {
  Student_Name: string;
  Sex?: string | null;
  DOB?: string | null;
  Present_Mobile?: string | null;
  Present_Mobile2?: string | null;
  Email?: string | null;
  Nationality?: string | null;
  Present_Country?: string | null;
  Discussion?: string | null;
  Status_id?: number | null;
  Inquiry_Dt?: string | null;
  Inquiry_From?: string | null;
  Inquiry_Type?: string | null;
  Course_Id?: number | null;
  Batch_Category_id?: number | null;
  Batch_Code?: string | null;
  Qualification?: string | null;
  Discipline?: string | null;
  Percentage?: string | null;
  Preferred_Location?: string | null;
}

export interface UpdateInquiryInput extends Omit<CreateInquiryInput, 'Student_Name'> {
  Student_Name: string;
}

export interface InquiryListParams {
  page: number;
  limit: number;
  pinnedInquiryId?: number;
  search?: string;
  discipline?: string;
  inquiryType?: string;
  leadTag?: string;
  location?: string;
  training?: string;
  batchCategory?: string;
  statusId?: string;
  duplicatesOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  puneOnly?: boolean;
  /** When true, only return rows whose latest discussion has nextdate <= CURDATE() */
  followUpDue?: boolean;
}

export interface InquiryRow {
  Student_Id: number;
  Student_Name: string;
  CourseName: string | null;
  Inquiry_Dt: string | null;
  InquirySoftwareTime?: string | null;
  Present_Mobile: string | null;
  Email: string | null;
  Location: string | null;
  Discipline: string | null;
  Inquiry_From: string | null;
  Inquiry_Type: string | null;
  Status_id: number | null;
  StatusLabel: string;
  Discussion: string | null;
  DiscussionDate: string | null;
  FirstDiscussionTime?: string | null;
  NextFollowUpDate: string | null;
  FollowUpBy: string | null;
  MetaCampaignName?: string | null;
  MetaFormName?: string | null;
  IsMetaAdConverted?: boolean;
  LeadTags?: string[];
  IsDuplicateLead?: boolean;
  IsPuneInquiry?: boolean;
  PuneSourceLocation?: string | null;
  PunePageSource?: string | null;
}

export interface StatusOption { id: number; label: string }

export const ALLOWED_INQUIRY_STATUSES: StatusOption[] = [
  { id: 1, label: 'New' },
  { id: 2, label: 'Contacted (not recieved call)' },
  { id: 3, label: 'Contacted (interested)' },
  { id: 4, label: 'Contacted (next batch)' },
  { id: 5, label: 'Contacted - eligible' },
  { id: 11, label: 'Contacted (Not Interested)' },
  { id: 6, label: 'Irrelevant' },
  { id: 7, label: 'Follow up pending' },
  { id: 8, label: 'Admission confirmed' },
  { id: 9, label: 'Lost lead' },
];

const MAIN_INQUIRY_STATUS_LABELS = [
  'New',
  'Contacted (interested)',
  'Contacted (not recieved call)',
  'Contacted (Not Interested)',
  'Contacted (next batch)',
  'Follow up pending',
  'Admission confirmed',
  'Lost lead',
  'Irrelevant',
];

const MAIN_INQUIRY_TYPE_OPTIONS = [
  'Corporate Reference',
  'Alumni Reference',
];

function normalizeInquiryText(value: unknown): string | null {
  if (value == null) return null;
  const normalized = String(value)
    .normalize('NFKC')
    .replace(/[\u{10000}-\u{10FFFF}]/gu, '')
    .trim();
  return normalized || null;
}

function parseInquiryStatus(value: unknown): number {
  const statusId = Number(value);
  if (!Number.isInteger(statusId) || statusId <= 0) {
    const error = new Error('Status is required');
    (error as { status?: number }).status = 400;
    throw error;
  }
  return statusId;
}

async function ensureMainInquiryStatuses(pool: ReturnType<typeof getPool>): Promise<void> {
  for (const status of MAIN_INQUIRY_STATUS_LABELS) {
    await pool.query(
      `INSERT INTO status_master (Status, Description, IsActive, IsDelete, PreDefined, SetBy)
       SELECT ?, ?, 1, 0, NULL, 'User'
       WHERE NOT EXISTS (
         SELECT 1 FROM status_master WHERE Status = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       )`,
      [status, status, status]
    );
  }
}

async function requireKnownInquiryStatus(value: unknown): Promise<number> {
  const statusId = parseInquiryStatus(value);
  const pool = getPool();
  await ensureMainInquiryStatuses(pool);
  const [rows] = await pool.query(
    `SELECT Id FROM status_master
     WHERE Id = ? AND (IsDelete = 0 OR IsDelete IS NULL) AND (IsActive = 1 OR IsActive IS NULL)
     LIMIT 1`,
    [statusId]
  );
  if (!(rows as unknown[]).length) {
    const error = new Error('Unknown status');
    (error as { status?: number }).status = 400;
    throw error;
  }
  return statusId;
}

export interface InquiryListResult {
  rows: InquiryRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: {
    disciplines: string[];
    inquiryTypes: string[];
    trainings: string[];
    batchCategories: { id: number; label: string }[];
    statusOptions: StatusOption[];
  };
}

function getInquiryCountCacheKey(params: {
  inquiryTable: string;
  search: string;
  discipline: string;
  inquiryType: string;
  leadTag: string;
  location: string;
  training: string;
  batchCategory: string;
  statusId: string;
  duplicatesOnly: boolean;
  dateFrom: string;
  dateTo: string;
  puneOnly: boolean;
  followUpDue: boolean;
}): string {
  return `inquiry:list-count:${JSON.stringify(params)}`;
}

function isSystemGeneratedDiscussionChunk(value: string): boolean {
  const text = value.trim().toLowerCase();
  if (!text) return true;

  const compact = text.replace(/[\s._-]+/g, ' ').trim();
  const lettersOnly = text.replace(/[^a-z]/g, '');
  const digitsOnly = text.replace(/\D/g, '');

  // Ignore placeholders/noise so untouched inquiries keep their visual coding.
  if (
    compact === 'null'
    || compact === 'nil'
    || compact === 'n/a'
    || compact === 'na'
    || compact === 'none'
    || compact === 'no discussion'
    || compact === 'no remarks'
    || compact === 'wa number not provided'
    || compact === 'whatsapp number not provided'
    || compact === 'number not provided'
    || compact === 'duplicate enquiry'
    || compact === 'duplicate inquiry'
  ) {
    return true;
  }

  // JSON blobs, URLs, or mostly numeric payloads are not counselor discussions.
  if (text.startsWith('{') || text.startsWith('[') || text.includes('http://') || text.includes('https://')) {
    return true;
  }
  if (digitsOnly.length >= 10 && lettersOnly.length <= 6) {
    return true;
  }
  if (lettersOnly.length === 0 && digitsOnly.length > 0) {
    return true;
  }

  if (
    text.startsWith('imported from suvidya')
    || text.startsWith('imported from meta')
    || text.startsWith('synced from meta')
  ) {
    return true;
  }

  if (
    text.startsWith('location:')
    || text.startsWith('source:')
    || text.startsWith('course:')
    || text.startsWith('campaign:')
    || text.startsWith('campaign id:')
    || text.startsWith('form:')
    || text.startsWith('form id:')
    || text.startsWith('tags:')
  ) {
    return true;
  }

  if (
    text.includes('synced')
    && (text.includes('campaign:') || text.includes('campaign id:'))
    && (text.includes('form:') || text.includes('form id:'))
  ) {
    return true;
  }

  return false;
}

function toManualDiscussion(value: string | null | undefined): string | null {
  const raw = String(value || '').trim();
  if (!raw || raw === 'NULL') return null;

  const chunks = raw
    .split(/\r?\n|\|/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (chunks.length === 0) return null;

  const manualChunks = chunks.filter((chunk) => !isSystemGeneratedDiscussionChunk(chunk));
  if (manualChunks.length === 0) return null;

  const merged = manualChunks.join(' | ').trim();
  return merged || null;
}

function manualDiscussionSqlCondition(alias: string): string {
  const discussionExpr = `LOWER(TRIM(COALESCE(${alias}.discussion, '')))`;
  return `
    NULLIF(TRIM(COALESCE(${alias}.discussion, '')), '') IS NOT NULL
    AND ${discussionExpr} NOT IN ('null', 'nil', 'n/a', 'na', 'none', 'no discussion', 'no remarks', 'wa number not provided', 'whatsapp number not provided', 'number not provided', 'duplicate enquiry', 'duplicate inquiry')
    AND ${discussionExpr} NOT LIKE 'imported from suvidya%'
    AND ${discussionExpr} NOT LIKE 'imported from meta%'
    AND ${discussionExpr} NOT LIKE 'synced from meta%'
    AND ${discussionExpr} NOT LIKE 'http://%'
    AND ${discussionExpr} NOT LIKE 'https://%'
  `;
}

interface InquiryFilterOptions {
  disciplines: string[];
  inquiryTypes: string[];
  trainings: string[];
  batchCategories: { id: number; label: string }[];
  statusOptions: StatusOption[];
}

function buildFallbackFilterOptions(): InquiryFilterOptions {
  return {
    disciplines: [],
    inquiryTypes: [],
    trainings: [],
    batchCategories: [],
    statusOptions: ALLOWED_INQUIRY_STATUSES,
  };
}

// ── Schema helpers ────────────────────────────────────────────────────────────

export async function resolveInquiryTableName(pool: ReturnType<typeof getPool>): Promise<string> {
  if (inquiryTableNameCache) return inquiryTableNameCache;

  try {
    const [rows] = await pool.query(
      `SELECT TABLE_NAME
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND LOWER(TABLE_NAME) = 'student_inquiry'
       ORDER BY CASE WHEN TABLE_NAME = 'Student_Inquiry' THEN 0 ELSE 1 END
       LIMIT 1`
    );
    inquiryTableNameCache = String((rows as any[])[0]?.TABLE_NAME || '').trim() || 'Student_Inquiry';
  } catch {
    inquiryTableNameCache = 'Student_Inquiry';
  }

  return inquiryTableNameCache;
}

async function resolveDisciplineTableName(pool: ReturnType<typeof getPool>): Promise<string | null> {
  if (disciplineTableNameCache !== undefined) return disciplineTableNameCache;

  try {
    const [rows] = await pool.query(
      `SELECT TABLE_NAME
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND LOWER(TABLE_NAME) = 'mst_deciplin'
       ORDER BY CASE WHEN TABLE_NAME = 'MST_Deciplin' THEN 0 ELSE 1 END
       LIMIT 1`
    );
    disciplineTableNameCache = String((rows as any[])[0]?.TABLE_NAME || '').trim() || null;
  } catch {
    disciplineTableNameCache = null;
  }

  return disciplineTableNameCache;
}

interface InquirySchemaIndexSpec {
  table: string;
  name: string;
  cols: string;
}

function getStudentInquiryTargetIndexes(inquiryTable: string): InquirySchemaIndexSpec[] {
  return [
    { table: inquiryTable, name: 'idx_si_list', cols: 'IsDelete, _inquiry_date, Inquiry_Id' },
    { table: inquiryTable, name: 'idx_si_status_list', cols: 'IsDelete, OnlineState, _inquiry_date, Inquiry_Id' },
    { table: inquiryTable, name: 'idx_si_type_list', cols: 'IsDelete, Inquiry_Type, _inquiry_date, Inquiry_Id' },
    { table: inquiryTable, name: 'idx_si_course_list', cols: 'IsDelete, Course_Id, _inquiry_date, Inquiry_Id' },
    // Supports the per-Student_Id de-duplication of the listing (latest Inquiry_Id
    // per linked student) via a loose index scan instead of a full table scan.
    { table: inquiryTable, name: 'idx_si_student_dedup', cols: 'Student_Id, Inquiry_Id' },
  ];
}

function getDiscussionTargetIndexes(): InquirySchemaIndexSpec[] {
  return [
    { table: 'awt_inquirydiscussion', name: 'idx_disc_lookup', cols: 'Inquiry_id, deleted, id' },
    { table: 'awt_inquirydiscussion', name: 'idx_disc_student_lookup', cols: 'student_id, deleted, id' },
    { table: 'awt_inquirydiscussion', name: 'idx_disc_due', cols: 'deleted, nextdate, Inquiry_id, id' },
  ];
}

async function ensureInquiryDateColumn(pool: ReturnType<typeof getPool>, inquiryTable: string): Promise<void> {
  const [colRows] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND COLUMN_NAME = '_inquiry_date'`,
    [inquiryTable]
  );
  if ((colRows as any[]).length === 0) {
    await pool.query(
      `ALTER TABLE \`${inquiryTable}\` ADD COLUMN _inquiry_date DATE GENERATED ALWAYS AS (` +
      `COALESCE(` +
      `STR_TO_DATE(LEFT(NULLIF(TRIM(Inquiry_Dt),''),19),'%Y-%m-%d %H:%i:%s'),` +
      `STR_TO_DATE(LEFT(NULLIF(TRIM(Inquiry_Dt),''),10),'%Y-%m-%d'),` +
      `STR_TO_DATE(LEFT(NULLIF(TRIM(Inquiry_Dt),''),10),'%d-%m-%Y'),` +
      `STR_TO_DATE(LEFT(NULLIF(TRIM(Inquiry_Dt),''),10),'%d/%m/%Y')` +
      `)) VIRTUAL`
    );
  }
}

// Preferred training location captured on the inquiry (Mumbai / Pune / ONLINE). Added on
// demand so no migration file is needed; cached so it only checks once.
async function ensureInquiryPreferredLocationColumn(pool: ReturnType<typeof getPool>, inquiryTable: string): Promise<void> {
  await cached(`schema:inquiry_preferred_location:${inquiryTable}`, 60 * 60 * 1000, async () => {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'Preferred_Location'`,
      [inquiryTable]
    );
    if ((rows as any[]).length === 0) {
      // student_inquiry is near InnoDB's 8126-byte row limit, so a VARCHAR would
      // overflow it. TEXT is stored off-page (only a pointer counts) — this is the
      // remedy MySQL itself recommends for "Row size too large".
      await pool.query(`ALTER TABLE \`${inquiryTable}\` ADD COLUMN Preferred_Location TEXT NULL`);
    }
    return true;
  });
}

async function ensureInquiryReminderColumn(pool: ReturnType<typeof getPool>, inquiryTable: string): Promise<void> {
  await cached(`schema:inquiry_reminder:${inquiryTable}`, 60 * 60 * 1000, async () => {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'Reminder_At'`,
      [inquiryTable]
    );
    if ((rows as any[]).length === 0) {
      await pool.query(`ALTER TABLE \`${inquiryTable}\` ADD COLUMN Reminder_At DATETIME NULL`);
    }
    const [indexRows] = await pool.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'idx_si_reminder'`,
      [inquiryTable]
    );
    if ((indexRows as any[]).length === 0) {
      await pool.query(`ALTER TABLE \`${inquiryTable}\` ADD INDEX idx_si_reminder (Reminder_At)`);
    }
    return true;
  });
}

/** Tracks when OnlineState (the inquiry status) last actually changed, so automated
 * follow-up escalation (see escalateStaleInterestedInquiries below) can tell how long
 * an inquiry has sat at a given status — distinct from Reminder_At, which is a manual,
 * staff-set alarm, not a status-change timestamp. */
async function ensureInquiryStatusChangedColumn(pool: ReturnType<typeof getPool>, inquiryTable: string): Promise<void> {
  await cached(`schema:inquiry_status_changed:${inquiryTable}`, 60 * 60 * 1000, async () => {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'Status_Changed_At'`,
      [inquiryTable]
    );
    if ((rows as any[]).length === 0) {
      await pool.query(`ALTER TABLE \`${inquiryTable}\` ADD COLUMN Status_Changed_At DATETIME NULL`);
    }
    const [indexRows] = await pool.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'idx_si_status_changed'`,
      [inquiryTable]
    );
    if ((indexRows as any[]).length === 0) {
      await pool.query(`ALTER TABLE \`${inquiryTable}\` ADD INDEX idx_si_status_changed (OnlineState, Status_Changed_At)`);
    }
    return true;
  });
}

/** Resolves a Main Inquiry status label (see MAIN_INQUIRY_STATUS_LABELS) to its live
 * status_master.Id — never hardcode these ids, status_master is admin-editable and the
 * seeded rows' auto-increment values aren't fixed constants. */
async function resolveInquiryStatusIdByLabel(pool: ReturnType<typeof getPool>, label: string): Promise<number | null> {
  await ensureMainInquiryStatuses(pool);
  const [rows] = await pool.query(
    `SELECT Id FROM status_master WHERE Status = ? AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1`,
    [label]
  );
  const id = (rows as any[])[0]?.Id;
  return id != null ? Number(id) : null;
}

/** Cached lookup used purely for sort-priority (put Follow up pending inquiries at the
 * top of the list) — shared by both listInquiries and listInquiryPersons. Short TTL since
 * this runs on every list load, including the perf-sensitive fast path; status_master
 * rarely changes so a brief cache is safe. Does NOT call ensureMainInquiryStatuses (that
 * runs INSERT...WHERE NOT EXISTS checks, too heavy for a hot read path) — if the status
 * hasn't been seeded yet, sorting simply falls back to plain recency until it has. */
async function getFollowUpPendingStatusId(pool: ReturnType<typeof getPool>): Promise<number | null> {
  return cached('inquiry:status-id:follow-up-pending', 5 * 60_000, async () => {
    const [rows] = await pool.query(
      `SELECT Id FROM status_master WHERE Status = 'Follow up pending' AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1`
    );
    const id = (rows as any[])[0]?.Id;
    return Number.isInteger(Number(id)) ? Number(id) : null;
  });
}

export interface FollowUpEscalationResult {
  interestedStatusId: number | null;
  followUpStatusId: number | null;
  escalated: number;
  escalatedInquiryIds: number[];
}

/** Automated 24h follow-up escalation: an inquiry marked "Contacted (interested)" that
 * has sat there for `hoursThreshold` hours with no further status change is flipped to
 * "Follow up pending" so it surfaces (see listOrderByClause below, which sorts Follow up
 * pending to the top of the list). Inquiries whose Status_Changed_At is NULL (set
 * Interested before this feature existed, or via a path that predates the column) are
 * deliberately left alone rather than guessed at — the clock starts once they're next
 * touched by any status update. Intended to run from a scheduled cron route. */
export async function escalateStaleInterestedInquiries(hoursThreshold = 24): Promise<FollowUpEscalationResult> {
  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  await ensureInquiryStatusChangedColumn(pool, inquiryTable);

  const interestedStatusId = await resolveInquiryStatusIdByLabel(pool, 'Contacted (interested)');
  const followUpStatusId = await resolveInquiryStatusIdByLabel(pool, 'Follow up pending');
  if (!interestedStatusId || !followUpStatusId) {
    return { interestedStatusId, followUpStatusId, escalated: 0, escalatedInquiryIds: [] };
  }

  const [dueRows] = await pool.query(
    `SELECT Inquiry_Id FROM \`${inquiryTable}\`
     WHERE CAST(NULLIF(OnlineState,'') AS UNSIGNED) = ?
       AND Status_Changed_At IS NOT NULL
       AND Status_Changed_At <= DATE_SUB(NOW(), INTERVAL ? HOUR)
       AND (IsDelete = 0 OR IsDelete IS NULL)`,
    [interestedStatusId, hoursThreshold]
  );
  const dueIds = (dueRows as any[]).map((r) => Number(r.Inquiry_Id)).filter((id) => Number.isInteger(id) && id > 0);
  if (!dueIds.length) {
    return { interestedStatusId, followUpStatusId, escalated: 0, escalatedInquiryIds: [] };
  }

  await pool.query(
    `UPDATE \`${inquiryTable}\` SET OnlineState = ?, Status_Changed_At = NOW() WHERE Inquiry_Id IN (?)`,
    [followUpStatusId, dueIds]
  );

  invalidateCache('inquiry:filters');
  invalidateCache('inquiry:list-count');

  return { interestedStatusId, followUpStatusId, escalated: dueIds.length, escalatedInquiryIds: dueIds };
}

/** Sets a reminder N hours from now on an enquiry. Deliberately a standalone,
 * single-column write (not routed through updateInquiry) so it can be set from the
 * list/detail view without touching or re-validating the rest of the enquiry form. */
export async function setInquiryReminder(inquiryId: number, hours: number): Promise<string> {
  if (!Number.isInteger(inquiryId) || inquiryId <= 0) {
    throw Object.assign(new Error('Valid inquiryId is required'), { status: 400 });
  }
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 30) {
    throw Object.assign(new Error('hours must be a positive number (up to 30 days)'), { status: 400 });
  }
  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  await ensureInquiryReminderColumn(pool, inquiryTable);
  await pool.query(
    `UPDATE \`${inquiryTable}\` SET Reminder_At = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE Inquiry_Id = ?`,
    [Math.round(hours * 60), inquiryId]
  );
  invalidateCache('inquiry:reminders-due');
  const [rows] = await pool.query(`SELECT Reminder_At FROM \`${inquiryTable}\` WHERE Inquiry_Id = ?`, [inquiryId]);
  return (rows as any[])[0]?.Reminder_At ?? null;
}

export async function clearInquiryReminder(inquiryId: number): Promise<void> {
  if (!Number.isInteger(inquiryId) || inquiryId <= 0) {
    throw Object.assign(new Error('Valid inquiryId is required'), { status: 400 });
  }
  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  await ensureInquiryReminderColumn(pool, inquiryTable);
  await pool.query(`UPDATE \`${inquiryTable}\` SET Reminder_At = NULL WHERE Inquiry_Id = ?`, [inquiryId]);
  invalidateCache('inquiry:reminders-due');
}

export interface DueReminderRow {
  Inquiry_Id: number;
  Student_Name: string;
  CourseName: string | null;
  Present_Mobile: string | null;
  StatusLabel: string | null;
  Reminder_At: string;
}

/** Enquiries whose reminder time has passed, across all pages/filters — rendered as a
 * pinned "brought to the top" tray above the (unmodified) paginated list, rather than
 * folded into that list's already perf-tuned ORDER BY/pagination. Capped and briefly
 * cached since this loads on every visit to the inquiry list. */
export async function getDueReminders(): Promise<DueReminderRow[]> {
  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  await ensureInquiryReminderColumn(pool, inquiryTable);
  return cached('inquiry:reminders-due', 20_000, async () => {
    const [rows] = await pool.query(
      `SELECT si.Inquiry_Id, si.Student_Name, c.Course_Name as CourseName, si.Present_Mobile,
              s.Status as StatusLabel, si.Reminder_At
       FROM \`${inquiryTable}\` si
       LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id
       LEFT JOIN status_master s ON s.Id = CAST(NULLIF(si.OnlineState,'') AS UNSIGNED)
       WHERE si.Reminder_At IS NOT NULL AND si.Reminder_At <= NOW()
         AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
       ORDER BY si.Reminder_At ASC
       LIMIT 200`
    );
    return rows as DueReminderRow[];
  });
}

async function ensureSchemaIndexes(
  pool: ReturnType<typeof getPool>,
  indexes: InquirySchemaIndexSpec[]
): Promise<void> {
  const tableNames = [...new Set(indexes.map((index) => index.table))];
  const placeholders = tableNames.map(() => '?').join(', ');
  const [existingRows] = await pool.query(
    `SELECT INDEX_NAME, TABLE_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (${placeholders})
     GROUP BY TABLE_NAME, INDEX_NAME`,
    tableNames
  );
  const existing = new Set(
    (existingRows as any[]).map((row: any) => `${row.TABLE_NAME}.${row.INDEX_NAME}`)
  );

  await Promise.all(
    indexes
      .filter((index) => !existing.has(`${index.table}.${index.name}`))
      .map((index) => pool.query(`ALTER TABLE \`${index.table}\` ADD INDEX \`${index.name}\` (${index.cols})`))
  );
}

async function ensureInquirySchema(pool: ReturnType<typeof getPool>, inquiryTable: string): Promise<void> {
  await cached('schema:inquiry_indexes', 60 * 60 * 1000, async () => {
    await ensureInquiryDateColumn(pool, inquiryTable);
    await ensureSchemaIndexes(pool, [
      ...getStudentInquiryTargetIndexes(inquiryTable),
      ...getDiscussionTargetIndexes(),
    ]);

    return true;
  });
}

async function ensureMetaLeadSchema(pool: ReturnType<typeof getPool>): Promise<void> {
  await cached('schema:meta_ads_lead_sync', 60 * 60 * 1000, async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meta_ads_lead_sync (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        meta_lead_id VARCHAR(191) NOT NULL,
        inquiry_id INT NULL,
        duplicate_of_inquiry_id INT NULL,
        source_label VARCHAR(100) NOT NULL DEFAULT 'Meta Ads',
        contact_source VARCHAR(100) NOT NULL DEFAULT 'Meta Instant Form',
        page_id VARCHAR(191) NULL,
        page_name VARCHAR(255) NULL,
        form_id VARCHAR(191) NULL,
        form_name VARCHAR(255) NULL,
        campaign_id VARCHAR(191) NULL,
        campaign_name VARCHAR(255) NULL,
        adset_id VARCHAR(191) NULL,
        adset_name VARCHAR(255) NULL,
        ad_id VARCHAR(191) NULL,
        ad_name VARCHAR(255) NULL,
        lead_created_time VARCHAR(100) NULL,
        student_name VARCHAR(255) NULL,
        mobile VARCHAR(30) NULL,
        email VARCHAR(191) NULL,
        course_name VARCHAR(255) NULL,
        utm_json LONGTEXT NULL,
        tags_json LONGTEXT NULL,
        fields_json LONGTEXT NULL,
        payload_json LONGTEXT NULL,
        duplicate_reason VARCHAR(255) NULL,
        last_error TEXT NULL,
        notifications_sent_at TIMESTAMP NULL,
        synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_meta_ads_lead_id (meta_lead_id),
        KEY idx_meta_ads_inquiry_id (inquiry_id),
        KEY idx_meta_ads_duplicate_inquiry_id (duplicate_of_inquiry_id),
        KEY idx_meta_ads_campaign_id (campaign_id),
        KEY idx_meta_ads_form_id (form_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    return true;
  });
}

const DISCIPLINE_NAME_EXPR =
  `COALESCE(NULLIF(TRIM(md.Deciplin),''), NULLIF(TRIM(si.Discipline),''))`;

const DEFAULT_PRIMARY_INQUIRY_MOBILE_EXPR =
  `NULLIF(TRIM(si.Present_Mobile),'')`;

const DEFAULT_SEARCHABLE_INQUIRY_MOBILE_EXPR =
  `COALESCE(${DEFAULT_PRIMARY_INQUIRY_MOBILE_EXPR}, NULLIF(TRIM(si.Present_Mobile2),''))`;

function normalizeInquiryMobile(value: unknown): string | null {
  // Allow all values: display the stored phone exactly as captured, with no
  // length/format filtering or extraction. Whatever the cron stored (including
  // overflow values from the source) is shown verbatim.
  const text = String(value ?? '').trim();
  return text || null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let locationColumnCache: Map<string, string | null> | null = null;
let mobileExprCache: Map<string, { primary: string; searchable: string }> | null = null;

/** Detect which column on the inquiry table stores the branch/city. Cached for the lifetime of the process. */
async function resolveLocationColumn(pool: ReturnType<typeof getPool>, inquiryTable: string): Promise<string | null> {
  if (!locationColumnCache) locationColumnCache = new Map();
  if (locationColumnCache.has(inquiryTable)) return locationColumnCache.get(inquiryTable) ?? null;
  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [inquiryTable]
    );
    const cols = new Set((rows as any[]).map((r: any) => String(r.COLUMN_NAME)));
    for (const candidate of ['Branch', 'Location', 'Present_City', 'City']) {
      if (cols.has(candidate)) {
        locationColumnCache.set(inquiryTable, candidate);
        return candidate;
      }
    }
  } catch { /* best-effort */ }
  locationColumnCache.set(inquiryTable, null);
  return null;
}

async function resolveInquiryMobileExpressions(
  pool: ReturnType<typeof getPool>,
  inquiryTable: string,
): Promise<{ primary: string; searchable: string }> {
  if (!mobileExprCache) mobileExprCache = new Map();
  const cachedExpr = mobileExprCache.get(inquiryTable);
  if (cachedExpr) return cachedExpr;

  // Only the lead's own contact numbers. Father/Mother/Sibling mobiles were
  // previously included as fallbacks, which surfaced a relative's number as the
  // lead's contact ("wrong number"). The Meta-lead mobile fallback is applied
  // separately in the listing query for leads with no own number.
  const preferredColumns = [
    'Present_Mobile',
    'Present_Mobile2',
  ];

  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?`,
      [inquiryTable]
    );
    const existing = new Set((rows as any[]).map((row: any) => String(row.COLUMN_NAME || '').trim()));
    const mobileParts = preferredColumns
      .filter((column) => existing.has(column))
      .map((column) => `NULLIF(TRIM(si.\`${column}\`),'')`);

    if (mobileParts.length > 0) {
      const resolved = {
        primary: `COALESCE(${mobileParts.join(', ')})`,
        searchable: `COALESCE(${mobileParts.join(', ')})`,
      };
      mobileExprCache.set(inquiryTable, resolved);
      return resolved;
    }
  } catch {
    // Fall back to default expression if schema inspection fails.
  }

  const fallback = {
    primary: DEFAULT_PRIMARY_INQUIRY_MOBILE_EXPR,
    searchable: DEFAULT_SEARCHABLE_INQUIRY_MOBILE_EXPR,
  };
  mobileExprCache.set(inquiryTable, fallback);
  return fallback;
}

async function loadStatusOptions(pool: ReturnType<typeof getPool>): Promise<StatusOption[]> {
  await ensureMainInquiryStatuses(pool);
  const [rows] = await pool.query(
    `SELECT Id AS id, Status AS label
     FROM status_master
     WHERE (IsDelete = 0 OR IsDelete IS NULL)
       AND (IsActive = 1 OR IsActive IS NULL)
       AND Status IN (?)
     ORDER BY FIELD(Status, ?)`,
    [MAIN_INQUIRY_STATUS_LABELS, MAIN_INQUIRY_STATUS_LABELS]
  );
  return (rows as { id: number; label: string }[])
    .map((r) => ({ id: Number(r.id), label: String(r.label ?? '').trim() }))
    .filter((s) => Number.isInteger(s.id) && s.id > 0 && s.label.length > 0);
}

export async function getInquiryStatusOptions(): Promise<StatusOption[]> {
  const pool = getPool();
  return cached('inquiry:main-status-options-v3', 5 * 60 * 1000, () => loadStatusOptions(pool));
}

/**
 * Status options sourced from the canonical `status_master` table (the list an
 * admin manages under Masters › Status). Its `Id` maps directly to the inquiry's
 * `OnlineState`. Used by the inquiry discussion area's status dropdown. Cached for
 * 5 minutes since the list changes rarely — keeps this off the hot request path.
 */
export async function getStatusMasterOptions(): Promise<StatusOption[]> {
  const pool = getPool();
  return cached('inquiry:status-master-options-v4', 5 * 60 * 1000, async () => {
    await ensureMainInquiryStatuses(pool);
    const [rows] = await pool.query(
      `SELECT Id AS id, Status AS label
       FROM status_master
       WHERE (IsDelete = 0 OR IsDelete IS NULL) AND (IsActive = 1 OR IsActive IS NULL)
       ORDER BY Id`
    );
    return (rows as { id: number; label: string }[])
      .map((r) => ({ id: Number(r.id), label: String(r.label ?? '').trim() }))
      .filter((s) => Number.isInteger(s.id) && s.id > 0 && s.label.length > 0);
  });
}

/**
 * Lightweight, status-only update for the discussion area. Validates the target
 * status against `status_master` (active, not deleted) so the caller may pick any
 * admin-managed status rather than being limited to the hardcoded allowlist. Two
 * small indexed queries — intentionally cheaper than the full updateInquiry path.
 */
export async function updateInquiryStatus(inquiryId: number, statusId: number): Promise<void> {
  if (!Number.isInteger(inquiryId) || inquiryId <= 0) {
    const error = new Error('Valid inquiryId is required');
    (error as { status?: number }).status = 400;
    throw error;
  }
  if (!Number.isInteger(statusId) || statusId <= 0) {
    const error = new Error('Valid status is required');
    (error as { status?: number }).status = 400;
    throw error;
  }

  const pool = getPool();
  const [statusRows] = await pool.query(
    `SELECT Id FROM status_master
     WHERE Id = ? AND (IsDelete = 0 OR IsDelete IS NULL) AND (IsActive = 1 OR IsActive IS NULL)
     LIMIT 1`,
    [statusId]
  );
  if (!(statusRows as unknown[]).length) {
    const error = new Error('Unknown status');
    (error as { status?: number }).status = 400;
    throw error;
  }

  const inquiryTable = await resolveInquiryTableName(pool);
  await ensureInquiryStatusChangedColumn(pool, inquiryTable);
  await pool.query(
    `UPDATE \`${inquiryTable}\` SET
       OnlineState = ?,
       Status_Changed_At = CASE WHEN COALESCE(CAST(NULLIF(OnlineState,'') AS UNSIGNED), 0) <> ? THEN NOW() ELSE Status_Changed_At END
     WHERE Inquiry_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
    [statusId, statusId, inquiryId]
  );
}

async function loadInquiryFilterOptions(
  pool: ReturnType<typeof getPool>,
  inquiryTable: string,
  disciplineJoin: string,
  disciplineExpr: string,
): Promise<InquiryFilterOptions> {
  return cached(
    `inquiry:filters:v3:${inquiryTable}:${disciplineJoin ? 'with-discipline' : 'without-discipline'}`,
    5 * 60 * 1000,
    async () => {
      const [disciplinesResult, typesResult, trainingsResult, batchCategoriesResult, statusOptions] = await Promise.all([
        pool.query(
          `SELECT DISTINCT ${disciplineExpr} as Discipline
           FROM \`${inquiryTable}\` si
           ${disciplineJoin}
           WHERE ${disciplineExpr} IS NOT NULL
             AND ${disciplineExpr} NOT IN ('NULL','Select')
             AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
           ORDER BY Discipline`
        ),
        pool.query(
          `SELECT DISTINCT Inquiry_Type FROM \`${inquiryTable}\`
           WHERE Inquiry_Type IS NOT NULL AND Inquiry_Type != ''
             AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Inquiry_Type`
        ),
        pool.query(
          `SELECT DISTINCT c.Course_Name FROM \`${inquiryTable}\` si
           LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id
           WHERE c.Course_Name IS NOT NULL AND c.Course_Name != ''
             AND (si.IsDelete = 0 OR si.IsDelete IS NULL) ORDER BY c.Course_Name`
        ),
        // Inquiries store Batch_Category_id as the mst_batchcategory id. Surface every
        // active category from the batch-category master as filter options.
        pool.query(
          `SELECT id, BatchCategory FROM mst_batchcategory
           WHERE (IsDelete = 0 OR IsDelete IS NULL) AND (IsActive = 1 OR IsActive IS NULL)
             AND BatchCategory IS NOT NULL AND BatchCategory != ''
             AND LOWER(TRIM(BatchCategory)) <> 'offline'
           ORDER BY BatchCategory`
        ),
        loadStatusOptions(pool),
      ]);

      const batchCategoryLabels: Record<string, string> = {
        'Weekend Batches': 'Weekend',
        'ONLINE': 'Online',
      };

      return {
        disciplines: (disciplinesResult[0] as any[]).map((d: any) => String(d.Discipline).trim()),
        inquiryTypes: Array.from(new Set([
          ...(typesResult[0] as any[]).map((t: any) => String(t.Inquiry_Type).trim()),
          ...MAIN_INQUIRY_TYPE_OPTIONS,
        ])).sort((a, b) => a.localeCompare(b)),
        trainings: (trainingsResult[0] as any[]).map((r: any) => String(r.Course_Name).trim()),
        batchCategories: (batchCategoriesResult[0] as any[]).map((r: any) => {
          const name = String(r.BatchCategory).trim();
          return { id: Number(r.id), label: batchCategoryLabels[name] ?? name };
        }),
        statusOptions,
      };
    }
  );
}

// ── Public service functions ──────────────────────────────────────────────────

export async function createInquiry(data: CreateInquiryInput, createdBy = 1): Promise<number> {
  const studentName = normalizeInquiryText(data.Student_Name);
  if (!studentName) throw new Error('Name is required');
  const statusId = await requireKnownInquiryStatus(data.Status_id);

  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  await ensureInquiryPreferredLocationColumn(pool, inquiryTable);
  await ensureInquiryPersonColumns(pool, inquiryTable);

  const resolved = await resolvePersonForEnquiry({
    name: studentName,
    mobile: data.Present_Mobile,
    email: data.Email,
  });
  const isReEnquiry = resolved.personId
    ? await detectReEnquiry(resolved.personId, data.Course_Id ?? null)
    : false;

  const [result] = await pool.query(
    `INSERT INTO \`${inquiryTable}\` (
       Student_Name, Sex, DOB, Present_Mobile, Present_Mobile2,
       Email, Nationality, Present_Country, Discussion,
       OnlineState, Inquiry_Dt, Inquiry_From, Inquiry_Type,
       Course_Id, Batch_Category_id, Batch_Code,
       Qualification, Discipline, Percentage, Preferred_Location,
       Person_Id, Is_Re_Enquiry,
       IsDelete, Inquiry, Date_Added, Created_By
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,'Inquiry',NOW(),?)`,
    [
      studentName,
      data.Sex ?? null,
      data.DOB ?? null,
      data.Present_Mobile ?? null,
      data.Present_Mobile2 ?? null,
      data.Email?.trim() ?? null,
      data.Nationality ?? null,
      data.Present_Country ?? null,
      data.Discussion?.trim() ?? null,
      statusId,
      data.Inquiry_Dt ?? new Date().toISOString().slice(0, 10),
      data.Inquiry_From ?? null,
      data.Inquiry_Type ?? null,
      data.Course_Id ?? null,
      data.Batch_Category_id ?? null,
      data.Batch_Code ?? null,
      data.Qualification ?? null,
      data.Discipline ?? null,
      data.Percentage ?? null,
      data.Preferred_Location ?? null,
      resolved.personId,
      isReEnquiry ? 1 : 0,
      createdBy,
    ]
  );
  const insertId = (result as any).insertId as number;

  if (resolved.conflict) {
    await recordIdentityConflict({
      inquiryId: insertId,
      mobilePersonId: resolved.mobilePersonId ?? null,
      emailPersonId: resolved.emailPersonId ?? null,
      mobile: data.Present_Mobile ?? null,
      email: data.Email ?? null,
    });
  }

  if (data.Discussion?.trim()) {
    await pool.query(
      `INSERT INTO awt_inquirydiscussion (Inquiry_id, date, discussion, deleted, created_by, created_date)
       VALUES (?, CURDATE(), ?, 0, ?, NOW())`,
      [insertId, data.Discussion.trim(), createdBy]
    );
  }

  invalidateCache('inquiry:filters');

  return insertId;
}

export async function getInquiryById(id: number): Promise<any | null> {
  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  await ensureInquiryPreferredLocationColumn(pool, inquiryTable);
  await ensureInquiryReminderColumn(pool, inquiryTable);
  const disciplineTable = await resolveDisciplineTableName(pool);
  const disciplineJoin = disciplineTable
    ? `LEFT JOIN \`${disciplineTable}\` md ON md.Id = CAST(NULLIF(TRIM(si.Discipline),'') AS UNSIGNED)`
    : '';
  const disciplineExpr = disciplineTable
    ? DISCIPLINE_NAME_EXPR
    : `NULLIF(TRIM(si.Discipline),'')`;
  const [rows] = await pool.query(
    `SELECT
       si.Inquiry_Id as Student_Id, si.Student_Name, si.Sex, si.DOB,
       si.Present_Mobile, si.Present_Mobile2, si.Email,
       si.Nationality, si.Present_Country, si.Discussion,
       CAST(NULLIF(si.OnlineState,'') AS UNSIGNED) as Status_id,
        si.Inquiry_Dt, si.Date_Added, si.Inquiry_From, si.Inquiry_Type,
       si.Course_Id, si.Batch_Category_id, si.Batch_Code,
       si.Qualification, si.Discipline, ${disciplineExpr} as DisciplineName, si.Percentage,
       si.Preferred_Location, si.Reminder_At,
       c.Course_Name as CourseName
    FROM \`${inquiryTable}\` si
     LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id
     ${disciplineJoin}
     WHERE si.Inquiry_Id = ? AND (si.IsDelete = 0 OR si.IsDelete IS NULL)`,
    [id]
  );
  return (rows as any[])[0] ?? null;
}

export async function listInquiries(params: InquiryListParams): Promise<InquiryListResult> {
  const startedAt = Date.now();
  const perfPhases: Record<string, number> = {
    prepMs: 0,
    countMs: 0,
    idsMs: 0,
    rowsMs: 0,
    filtersMs: 0,
  };

  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  const disciplineTable = await resolveDisciplineTableName(pool);
  const disciplineJoin = disciplineTable
    ? `LEFT JOIN \`${disciplineTable}\` md ON md.Id = CAST(NULLIF(TRIM(si.Discipline),'') AS UNSIGNED)`
    : '';
  const disciplineExpr = disciplineTable
    ? DISCIPLINE_NAME_EXPR
    : `NULLIF(TRIM(si.Discipline),'')`;
  warmInquirySchema(pool, inquiryTable);
  const {
    page, limit, pinnedInquiryId, search = '', discipline = '', inquiryType = '', leadTag = '',
    location = '', training = '', batchCategory = '', statusId = '', duplicatesOnly = false, dateFrom = '', dateTo = '',
    puneOnly = false,
    followUpDue = false,
  } = params;
  const usesMetaAds = inquiryType.trim().toLowerCase() === 'meta ads';
  const needsMetaData = usesMetaAds || Boolean(leadTag) || duplicatesOnly;
  const listNeedsCourseJoin = Boolean(search || training);
  const listNeedsDisciplineJoin = Boolean(discipline && disciplineTable);
  const listCourseJoin = listNeedsCourseJoin ? 'LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id' : '';
  const listDisciplineJoin = listNeedsDisciplineJoin ? disciplineJoin : '';
  const metaSelect = needsMetaData
    ? `
         meta_latest.campaign_name as MetaCampaignName,
         meta_latest.form_name as MetaFormName,
         meta_latest.tags_json as MetaTagsJson,
         meta_latest.duplicate_of_inquiry_id as MetaDuplicateOfInquiryId,`
    : `
         NULL as MetaCampaignName,
         NULL as MetaFormName,
         NULL as MetaTagsJson,
         NULL as MetaDuplicateOfInquiryId,`;
  const metaJoin = needsMetaData
    ? `
      LEFT JOIN (
        SELECT meta1.*
        FROM meta_ads_lead_sync meta1
        INNER JOIN (
          SELECT inquiry_id, MAX(id) AS max_id
          FROM meta_ads_lead_sync
          WHERE inquiry_id IS NOT NULL
          GROUP BY inquiry_id
        ) meta2 ON meta2.max_id = meta1.id
      ) meta_latest ON meta_latest.inquiry_id = si.Inquiry_Id`
    : '';
  if (needsMetaData) {
    warmMetaLeadSchema(pool);
  }
  const offset = (page - 1) * limit;

  const ALLOWED_LOCATIONS = new Set(['pune', 'mumbai', 'online']);
  const normalizedLocation = location.trim().toLowerCase();
  if (normalizedLocation && !ALLOWED_LOCATIONS.has(normalizedLocation)) {
    throw Object.assign(new Error('Invalid location filter'), { status: 400 });
  }

  const locationColumn = await resolveLocationColumn(pool, inquiryTable);
  const mobileExpressions = await resolveInquiryMobileExpressions(pool, inquiryTable);
  const inquiryDateColumnAvailable = await hasInquiryDateColumn(pool, inquiryTable);
  const puneSyncAggregate = `(
    SELECT
      inquiry_id,
      MAX(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.your_location')), '')) AS PuneSourceLocation,
      MAX(COALESCE(
        NULLIF(page_source, ''),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.page_source')), '')
      )) AS PunePageSource
    FROM suvidya_inquiry_sync
    WHERE LOWER(COALESCE(page_source, '')) LIKE '%pune%'
       OR LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.page_source')), '')) LIKE '%pune%'
       OR LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.your_location')), '')) LIKE '%pune%'
    GROUP BY inquiry_id
  )`;
  const puneLocationColumnCondition = locationColumn
    ? `LOWER(TRIM(COALESCE(si.${locationColumn}, ''))) LIKE '%pune%'`
    : '0=1';
  const puneListingTextCondition = `(
    LOWER(COALESCE(si.Inquiry_From, '')) LIKE '%pune%'
    OR LOWER(COALESCE(si.Discussion, '')) LIKE '%pune%'
    OR ${puneLocationColumnCondition}
  )`;
  const puneListJoin = `
    LEFT JOIN ${puneSyncAggregate} pune_primary ON pune_primary.inquiry_id = si.Inquiry_Id
    LEFT JOIN ${puneSyncAggregate} pune_legacy ON si.Student_Id IS NOT NULL AND pune_legacy.inquiry_id = si.Student_Id
  `;
  const puneMatchedCondition = `(
    pune_primary.inquiry_id IS NOT NULL
    OR pune_legacy.inquiry_id IS NOT NULL
    OR ${puneListingTextCondition}
  )`;
  const puneLocationExpr = `COALESCE(pune_primary.PuneSourceLocation, pune_legacy.PuneSourceLocation)`;
  const punePageSourceExpr = `COALESCE(pune_primary.PunePageSource, pune_legacy.PunePageSource)`;

  // Build WHERE
  const conditions: string[] = ['(si.IsDelete = 0 OR si.IsDelete IS NULL)'];
  const queryParams: any[] = [];

  if (search) {
    const resolvedBatchCodeExpr = `NULLIF(TRIM(CAST(si.Batch_Code AS CHAR)),'')`;
    conditions.push(
      `(si.Student_Name LIKE ? OR si.Email LIKE ? OR ${mobileExpressions.searchable} LIKE ? OR c.Course_Name LIKE ? OR ${resolvedBatchCodeExpr} LIKE ?)`
    );
    const s = `%${search}%`;
    queryParams.push(s, s, s, s, s);
  }
  if (discipline) {
    conditions.push(`${disciplineExpr} = ?`);
    queryParams.push(discipline);
  }
  if (inquiryType) {
    conditions.push('si.Inquiry_Type = ?');
    queryParams.push(inquiryType);
  }
  if (leadTag) {
    conditions.push(
      `EXISTS (
         SELECT 1 FROM meta_ads_lead_sync meta_filter
         WHERE meta_filter.inquiry_id = si.Inquiry_Id
           AND (
             LOWER(COALESCE(meta_filter.campaign_name,'')) LIKE ?
             OR LOWER(COALESCE(meta_filter.form_name,'')) LIKE ?
             OR LOWER(COALESCE(meta_filter.tags_json,'')) LIKE ?
           )
       )`
    );
    const leadSearch = `%${leadTag.toLowerCase()}%`;
    queryParams.push(leadSearch, leadSearch, leadSearch);
  }
  if (normalizedLocation && locationColumn) {
    conditions.push(`LOWER(TRIM(si.${locationColumn})) LIKE ?`);
    queryParams.push(`%${normalizedLocation}%`);
  }
  if (statusId) {
    conditions.push('si.OnlineState = ?');
    queryParams.push(parseInt(statusId));
  }
  const FALLBACK_INQUIRY_DATE_EXPR =
    `COALESCE(` +
    `STR_TO_DATE(LEFT(NULLIF(TRIM(si.Inquiry_Dt),''),19),'%Y-%m-%d %H:%i:%s'),` +
    `STR_TO_DATE(LEFT(NULLIF(TRIM(si.Inquiry_Dt),''),10),'%Y-%m-%d'),` +
    `STR_TO_DATE(LEFT(NULLIF(TRIM(si.Inquiry_Dt),''),10),'%d-%m-%Y'),` +
    `STR_TO_DATE(LEFT(NULLIF(TRIM(si.Inquiry_Dt),''),10),'%d/%m/%Y'))`;
  const inquiryDateExpr = inquiryDateColumnAvailable ? 'si._inquiry_date' : FALLBACK_INQUIRY_DATE_EXPR;
  if (dateFrom) {
    conditions.push(`${inquiryDateExpr} >= ?`);
    queryParams.push(dateFrom);
  }
  if (dateTo) {
    conditions.push(`${inquiryDateExpr} <= ?`);
    queryParams.push(dateTo);
  }
  if (training) {
    conditions.push('c.Course_Name = ?');
    queryParams.push(training);
  }
  if (batchCategory) {
    conditions.push('si.Batch_Category_id = ?');
    queryParams.push(batchCategory);
  }
  if (duplicatesOnly) {
    conditions.push(
      `EXISTS (
         SELECT 1 FROM meta_ads_lead_sync meta_dup
         WHERE meta_dup.inquiry_id = si.Inquiry_Id
           AND meta_dup.duplicate_of_inquiry_id IS NOT NULL
       )`
    );
  }
  if (puneOnly) {
    conditions.push(puneMatchedCondition);
  }
  if (followUpDue) {
    conditions.push(
      `(
        EXISTS (
          SELECT 1
          FROM awt_inquirydiscussion d
          WHERE d.deleted = 0
            AND d.nextdate IS NOT NULL
            AND d.nextdate <= CURDATE()
            AND d.Inquiry_id = si.Inquiry_Id
            AND d.id = (
              SELECT MAX(d2.id)
              FROM awt_inquirydiscussion d2
              WHERE d2.deleted = 0
                AND d2.Inquiry_id = si.Inquiry_Id
            )
        )
        OR EXISTS (
          SELECT 1
          FROM awt_inquirydiscussion d
          WHERE d.deleted = 0
            AND d.nextdate IS NOT NULL
            AND d.nextdate <= CURDATE()
            AND d.student_id = si.Student_Id
            AND d.id = (
              SELECT MAX(d2.id)
              FROM awt_inquirydiscussion d2
              WHERE d2.deleted = 0
                AND d2.student_id = si.Student_Id
            )
        )
      )`
    );
  }

  const whereClause = `WHERE (${conditions.join(') AND (')})`;

  // Collapse duplicate inquiry rows that point to the same linked Student_Id (repeated
  // imports/syncs create many Inquiry_Ids for one person). Keep only the latest inquiry
  // per Student_Id; rows with no linked Student_Id are never merged. Skipped when the
  // user explicitly asks to see duplicates. The derived table uses idx_si_student_dedup
  // (Student_Id, Inquiry_Id) for a loose index scan rather than a full table scan.
  const applyStudentDedup = !duplicatesOnly;
  const dedupJoin = applyStudentDedup
    ? `LEFT JOIN (
         SELECT Student_Id, MAX(Inquiry_Id) AS keep_id
         FROM \`${inquiryTable}\`
         WHERE Student_Id IS NOT NULL AND TRIM(CAST(Student_Id AS CHAR)) NOT IN ('', '0')
           AND (IsDelete = 0 OR IsDelete IS NULL)
         GROUP BY Student_Id
       ) dedup ON dedup.Student_Id = si.Student_Id`
    : '';
  const dedupClause = applyStudentDedup
    ? `AND (si.Student_Id IS NULL OR TRIM(CAST(si.Student_Id AS CHAR)) IN ('', '0') OR si.Inquiry_Id = dedup.keep_id)`
    : '';
  perfPhases.prepMs = Date.now() - startedAt;

  const hasActiveFilters = Boolean(
    search || discipline || inquiryType || leadTag || normalizedLocation || training ||
    batchCategory || statusId || dateFrom || dateTo || duplicatesOnly || puneOnly || followUpDue
  );
  const useFastUnfilteredPath = !hasActiveFilters;

  // A just-created inquiry may be temporarily pinned by the listing redirect. After
  // that one row, retain the established cron-escalated follow-up priority and recency.
  const followUpPendingStatusId = await getFollowUpPendingStatusId(pool);
  const pinFirstExpr = Number.isInteger(pinnedInquiryId) && Number(pinnedInquiryId) > 0
    ? `CASE WHEN si.Inquiry_Id = ${Number(pinnedInquiryId)} THEN 0 ELSE 1 END, `
    : '';
  const followUpFirstExpr = followUpPendingStatusId != null
    ? `CASE WHEN CAST(NULLIF(si.OnlineState,'') AS UNSIGNED) = ${followUpPendingStatusId} THEN 0 ELSE 1 END, `
    : '';

  // When _inquiry_date is not available yet, sorting with STR_TO_DATE(...) is very expensive
  // on large tables. Fall back to primary-key recency to keep first page responsive.
  const listOrderByClause = inquiryDateColumnAvailable
    ? `${pinFirstExpr}${followUpFirstExpr}${inquiryDateExpr} DESC, si.Inquiry_Id DESC`
    : `${pinFirstExpr}${followUpFirstExpr}si.Inquiry_Id DESC`;

  let total = 0;
  let pageIds: number[] = [];
  let sortOrder = new Map<number, number>();

  let filteredCountPromise: Promise<number> | null = null;

  if (useFastUnfilteredPath && !applyStudentDedup) {
    const countStartedAt = Date.now();
    // Avoid a full table COUNT(*) on default listing requests. TABLE_ROWS is near-instant
    // and good enough for pagination totals on high-traffic pages.
    total = await cached(
      `inquiry:list-count:approx:${inquiryTable}`,
      60_000,
      async () => {
        const [approxRows] = await pool.query(
          `SELECT TABLE_ROWS as total
           FROM INFORMATION_SCHEMA.TABLES
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
           LIMIT 1`,
          [inquiryTable]
        );
        const approx = Number((approxRows as any[])[0]?.total || 0);
        return Number.isFinite(approx) && approx > 0 ? approx : 0;
      }
    );
    perfPhases.countMs = Date.now() - countStartedAt;
  } else {
    const countStartedAt = Date.now();
    filteredCountPromise = cached(
      getInquiryCountCacheKey({
        inquiryTable,
        search,
        discipline,
        inquiryType,
        leadTag,
        location: normalizedLocation,
        training,
        batchCategory,
        statusId,
        duplicatesOnly,
        dateFrom,
        dateTo,
        puneOnly,
        followUpDue,
      }),
      30_000,
      async () => {
        const countResult = await runGuardedQuery(
          pool,
          `SELECT COUNT(*) as total
           FROM \`${inquiryTable}\` si
           ${listCourseJoin}
           ${listDisciplineJoin}
           ${puneOnly ? puneListJoin : ''}
           ${dedupJoin}
           ${whereClause}
           ${dedupClause}`,
          queryParams,
          5,
        );
        return Number((countResult as any[])[0]?.total || 0);
      }
    );
    perfPhases.countMs = Date.now() - countStartedAt;
  }

  const idsStartedAt = Date.now();
  const sortedIds = await runGuardedQuery(
    pool,
    `SELECT si.Inquiry_Id
     FROM \`${inquiryTable}\` si
     ${listCourseJoin}
     ${listDisciplineJoin}
     ${puneOnly ? puneListJoin : ''}
     ${dedupJoin}
     ${whereClause}
     ${dedupClause}
     ORDER BY ${listOrderByClause}
     LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset],
    8,
  );
  pageIds = (sortedIds as any[]).map((r: any) => r.Inquiry_Id);
  sortOrder = new Map((sortedIds as any[]).map((r: any, i: number) => [r.Inquiry_Id, i]));
  perfPhases.idsMs = Date.now() - idsStartedAt;

  if (filteredCountPromise) {
    const countWaitStartedAt = Date.now();
    const countOrTimeout = await Promise.race<number | null>([
      filteredCountPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);

    total = countOrTimeout == null
      ? offset + pageIds.length + (pageIds.length === limit ? 1 : 0)
      : countOrTimeout;
    perfPhases.countMs += Date.now() - countWaitStartedAt;
  }

  // Fetch full rows for page IDs
  let dataRows: any[] = [];
  if (pageIds.length > 0) {
    const rowsStartedAt = Date.now();
    const ph = pageIds.map(() => '?').join(',');
    const locationSelect = locationColumn ? `si.${locationColumn} as Location,` : 'NULL as Location,';
    const rows = await runGuardedQuery(
      pool,
      `SELECT
         si.Inquiry_Id as Student_Id, si.Student_Id as SourceStudentId,
         si.Student_Name, c.Course_Name as CourseName, si.Inquiry_Dt, si.Date_Added as InquirySoftwareTime,
        COALESCE(
          ${mobileExpressions.primary},
          NULLIF(TRIM((
            SELECT meta_m.mobile
            FROM meta_ads_lead_sync meta_m
            WHERE meta_m.inquiry_id = si.Inquiry_Id
              AND NULLIF(TRIM(meta_m.mobile), '') IS NOT NULL
            ORDER BY meta_m.id DESC
            LIMIT 1
          )), '')
        ) as Present_Mobile,
        si.Email, ${locationSelect}
        si.Discipline, ${disciplineExpr} as DisciplineName,
         si.Inquiry_From, si.Inquiry_Type,
         si.OnlineState as OnlineStateRaw,
         CAST(NULLIF(si.OnlineState,'') AS UNSIGNED) as Status_id,
         sm.Status as StatusLabelFromMaster,
         si.Discussion as InlineDiscussion,
         ${metaSelect}
         ld.discussion as LatestDiscussion, ld.date as LatestDiscDate,
         ld.nextdate as NextFollowUpDate, ld.created_by as LatestDiscussionById,
         fd.created_date as FirstDiscussionTime,
         COALESCE(
           NULLIF(TRIM(CONCAT(COALESCE(au.firstname,''),' ',COALESCE(au.lastname,''))),''),
           NULLIF(TRIM(au.username),''), NULLIF(TRIM(au.email),''),
           NULLIF(TRIM(oe.Employee_Name),'')
         ) as LatestDiscussionByName,
        ${puneMatchedCondition} as IsPuneInquiry,
         ${puneLocationExpr} as PuneSourceLocation,
         ${punePageSourceExpr} as PunePageSource
      FROM \`${inquiryTable}\` si
       LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id
       LEFT JOIN status_master sm
         ON sm.Id = CAST(NULLIF(si.OnlineState,'') AS UNSIGNED)
        AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
      ${disciplineJoin}
      ${metaJoin}
      ${puneListJoin}
       LEFT JOIN (
         SELECT d.Inquiry_id as InquiryId, MAX(d.id) as max_id
         FROM awt_inquirydiscussion d
         WHERE d.deleted = 0
           AND ${manualDiscussionSqlCondition('d')}
           AND d.Inquiry_id IN (${ph})
         GROUP BY d.Inquiry_id
       ) tld_primary ON tld_primary.InquiryId = si.Inquiry_Id
       LEFT JOIN (
         SELECT si_map.Inquiry_Id as InquiryId, MAX(d.id) as max_id
         FROM \`${inquiryTable}\` si_map
         LEFT JOIN \`${inquiryTable}\` si_sibling
           ON si_sibling.Student_Id = si_map.Student_Id
          AND (si_sibling.IsDelete = 0 OR si_sibling.IsDelete IS NULL)
         INNER JOIN awt_inquirydiscussion d
           ON d.deleted = 0
          AND ${manualDiscussionSqlCondition('d')}
          AND si_map.Student_Id IS NOT NULL
          AND (d.student_id = si_map.Student_Id OR d.Inquiry_id = si_sibling.Inquiry_Id)
         WHERE si_map.Inquiry_Id IN (${ph})
         GROUP BY si_map.Inquiry_Id
       ) tld_legacy ON tld_legacy.InquiryId = si.Inquiry_Id
       LEFT JOIN awt_inquirydiscussion ld ON ld.id = GREATEST(COALESCE(tld_primary.max_id, 0), COALESCE(tld_legacy.max_id, 0))
       LEFT JOIN (
         SELECT d.Inquiry_id as InquiryId, MIN(d.id) as min_id
         FROM awt_inquirydiscussion d
         WHERE d.deleted = 0
           AND d.Inquiry_id IN (${ph})
         GROUP BY d.Inquiry_id
       ) tfd_primary ON tfd_primary.InquiryId = si.Inquiry_Id
       LEFT JOIN (
         SELECT si_map.Inquiry_Id as InquiryId, MIN(d.id) as min_id
         FROM \`${inquiryTable}\` si_map
         LEFT JOIN \`${inquiryTable}\` si_sibling
           ON si_sibling.Student_Id = si_map.Student_Id
          AND (si_sibling.IsDelete = 0 OR si_sibling.IsDelete IS NULL)
         INNER JOIN awt_inquirydiscussion d
           ON d.deleted = 0
          AND si_map.Student_Id IS NOT NULL
          AND (d.student_id = si_map.Student_Id OR d.Inquiry_id = si_sibling.Inquiry_Id)
         WHERE si_map.Inquiry_Id IN (${ph})
         GROUP BY si_map.Inquiry_Id
       ) tfd_legacy ON tfd_legacy.InquiryId = si.Inquiry_Id
       LEFT JOIN awt_inquirydiscussion fd ON fd.id = COALESCE(tfd_primary.min_id, tfd_legacy.min_id)
       LEFT JOIN awt_adminuser au ON au.id = ld.created_by
       LEFT JOIN office_employee_mst oe ON oe.Emp_Id = ld.created_by
       WHERE si.Inquiry_Id IN (${ph})`,
      [...pageIds, ...pageIds, ...pageIds, ...pageIds, ...pageIds],
      10,
    );
    dataRows = (rows as any[]).sort(
      (a: any, b: any) => (sortOrder.get(a.Student_Id) ?? 0) - (sortOrder.get(b.Student_Id) ?? 0)
    );
    perfPhases.rowsMs = Date.now() - rowsStartedAt;
  }

  const filtersStartedAt = Date.now();
  const filterCacheKey = `filters:${inquiryTable}:${disciplineJoin ? 'with-discipline' : 'without-discipline'}`;
  const fallbackFilters = inquiryFilterOptionsMemoryCache.get(filterCacheKey) || buildFallbackFilterOptions();
  const filtersPromise = loadInquiryFilterOptions(
    pool,
    inquiryTable,
    disciplineJoin,
    disciplineExpr,
  )
    .then((resolved) => {
      inquiryFilterOptionsMemoryCache.set(filterCacheKey, resolved);
      return resolved;
    })
    .catch(() => fallbackFilters);

  // Keep /api/inquiry responsive: do not let expensive DISTINCT filter generation
  // block default list responses on cold/serverless invocations.
  const resolvedFilters = await Promise.race<InquiryFilterOptions>([
    filtersPromise,
    new Promise((resolve) => setTimeout(() => resolve(fallbackFilters), hasActiveFilters ? 180 : 80)),
  ]);

  // If we returned fallback due timeout, let the latest options warm in background.
  if (resolvedFilters === fallbackFilters) {
    void filtersPromise;
  }
  perfPhases.filtersMs = Date.now() - filtersStartedAt;

  const { disciplines, inquiryTypes, trainings, batchCategories, statusOptions } = resolvedFilters;

  const statusMap = Object.fromEntries(statusOptions.map((s) => [s.id, s.label]));

  const rows: InquiryRow[] = dataRows.map((r: any) => {
    const inlineDisc = r.InlineDiscussion && r.InlineDiscussion !== 'NULL' ? r.InlineDiscussion : null;
    const latestDisc = r.LatestDiscussion && r.LatestDiscussion !== 'NULL' ? r.LatestDiscussion : null;
    const cleanedInlineDisc = toManualDiscussion(inlineDisc);
    const cleanedLatestDisc = toManualDiscussion(latestDisc);
    const sourceStudentId = r.SourceStudentId == null ? '' : String(r.SourceStudentId).trim();
    const inquiryTypeVal = r.Inquiry_Type?.trim()
      ? r.Inquiry_Type.trim()
      : sourceStudentId === '' ? 'Online Inquiry' : null;
    const disciplineVal =
      (r.DisciplineName?.trim() || r.Discipline?.trim() || null);
    const cleanDiscipline =
      disciplineVal && !['NULL', 'Select'].includes(disciplineVal) ? disciplineVal : null;
    const sourceFrom = String(r.Inquiry_From ?? '').toLowerCase();
    const sourceType = String(inquiryTypeVal ?? '').toLowerCase();
    const isMetaAdConverted =
      sourceFrom.includes('meta')
      || sourceType.includes('meta')
      || Boolean(r.MetaCampaignName || r.MetaFormName);
    const isGoogleAdLead =
      sourceFrom.includes('google')
      || sourceType.includes('google');

    return {
      Student_Id: r.Student_Id,
      Student_Name: r.Student_Name,
      CourseName: r.CourseName ?? null,
      Inquiry_Dt: r.Inquiry_Dt ?? null,
      InquirySoftwareTime: r.InquirySoftwareTime ?? null,
      Present_Mobile: normalizeInquiryMobile(r.Present_Mobile),
      Email: r.Email ?? null,
      Location: r.Location?.trim() || null,
      Discipline: cleanDiscipline,
      Inquiry_From: r.Inquiry_From ?? null,
      Inquiry_Type: inquiryTypeVal,
      IsMetaAdConverted: isMetaAdConverted,
      IsGoogleAdLead: isGoogleAdLead,
      Status_id: r.Status_id ?? null,
      StatusLabel:
        (r.StatusLabelFromMaster?.trim() || null) ??
        statusMap[r.Status_id] ??
        (r.OnlineStateRaw?.trim() || null) ??
        (r.Status_id != null ? `Status ${r.Status_id}` : 'New'),
      Discussion: cleanedLatestDisc || cleanedInlineDisc || null,
      DiscussionDate: r.LatestDiscDate ?? null,
      FirstDiscussionTime: r.FirstDiscussionTime ?? null,
      NextFollowUpDate: r.NextFollowUpDate ?? null,
      FollowUpBy: r.LatestDiscussionByName || (r.LatestDiscussionById != null ? `User ${r.LatestDiscussionById}` : null),
      MetaCampaignName: r.MetaCampaignName ?? null,
      MetaFormName: r.MetaFormName ?? null,
      IsPuneInquiry: Boolean(r.IsPuneInquiry),
      PuneSourceLocation: r.PuneSourceLocation?.trim() || null,
      PunePageSource: r.PunePageSource?.trim() || null,
      LeadTags: (() => {
        try {
          const parsed = JSON.parse(r.MetaTagsJson || '[]');
          return Array.isArray(parsed) ? parsed.map((tag) => String(tag)).filter(Boolean) : [];
        } catch {
          return [];
        }
      })(),
      IsDuplicateLead: r.MetaDuplicateOfInquiryId != null,
    };
  });

  const totalMs = Date.now() - startedAt;
  const level = totalMs >= getSlowRequestThresholdMs() ? 'warn' : 'info';
  console[level](
    `[perf] listInquiries ${totalMs}ms` +
    ` prep=${perfPhases.prepMs}ms` +
    ` count=${perfPhases.countMs}ms` +
    ` ids=${perfPhases.idsMs}ms` +
    ` rows=${perfPhases.rowsMs}ms` +
    ` filters=${perfPhases.filtersMs}ms` +
    ` page=${page} limit=${limit} resultRows=${rows.length}`
  );

  return {
    rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    filters: {
      disciplines,
      inquiryTypes,
      trainings,
      batchCategories,
      statusOptions,
    },
  };
}

// ── Person-grouped listing ──────────────────────────────────────────────────────

export interface InquiryPersonListParams {
  page: number;
  limit: number;
  pinnedInquiryId?: number;
  search?: string;
  discipline?: string;
  inquiryType?: string;
  training?: string;
  batchCategory?: string;
  statusId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface InquiryPersonRow {
  Person_Id: number | null;
  Name: string | null;
  Mobile: string | null;
  Email: string | null;
  EnquiryCount: number;
  LatestEnquiryDate: string | null;
  LatestInquiryId: number;
  /** Same columns the flat list shows, taken from the person's latest enquiry. */
  CourseName: string | null;
  Discipline: string | null;
  Source: string | null;
  Status_id: number | null;
  StatusLabel: string | null;
  Discussion: string | null;
  DiscussionDate: string | null;
  /** Set only for the Person_Id IS NULL pseudo-rows (legacy/unlinked/conflict-flagged rows). */
  UnlinkedInquiryId?: number;
}

export interface InquiryPersonListResult {
  rows: InquiryPersonRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * Groups the enquiry list by Person_Id — the "one row per person" Enquiry Master view.
 * Deliberately a separate, simpler query path from listInquiries(): it supports the
 * common filters (search/discipline/inquiryType/status/course/date range) but not the
 * Meta-ads/Pune/duplicates/follow-up-due filters, which stay on the flat /api/inquiry
 * view. Rows with no Person_Id (pre-backfill legacy data, or identity-conflict-flagged
 * enquiries) are surfaced as their own single-enquiry rows so nothing disappears.
 */
export async function listInquiryPersons(params: InquiryPersonListParams): Promise<InquiryPersonListResult> {
  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  await ensureInquiryPersonColumns(pool, inquiryTable);
  const disciplineTable = await resolveDisciplineTableName(pool);
  const disciplineJoin = disciplineTable
    ? `LEFT JOIN \`${disciplineTable}\` md ON md.Id = CAST(NULLIF(TRIM(si.Discipline),'') AS UNSIGNED)`
    : '';
  const disciplineExpr = disciplineTable ? DISCIPLINE_NAME_EXPR : `NULLIF(TRIM(si.Discipline),'')`;

  const {
    page, limit, pinnedInquiryId, search = '', discipline = '', inquiryType = '',
    training = '', batchCategory = '', statusId = '', dateFrom = '', dateTo = '',
  } = params;

  const needsCourseJoin = Boolean(search || training);
  const courseJoin = needsCourseJoin ? 'LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id' : '';
  const mobileExpressions = await resolveInquiryMobileExpressions(pool, inquiryTable);

  const conditions: string[] = ['(si.IsDelete = 0 OR si.IsDelete IS NULL)'];
  const queryParams: any[] = [];

  if (search) {
    conditions.push(
      `(si.Student_Name LIKE ? OR si.Email LIKE ? OR ${mobileExpressions.searchable} LIKE ? OR c.Course_Name LIKE ?)`
    );
    const s = `%${search}%`;
    queryParams.push(s, s, s, s);
  }
  if (discipline) {
    conditions.push(`${disciplineExpr} = ?`);
    queryParams.push(discipline);
  }
  if (inquiryType) {
    conditions.push('si.Inquiry_Type = ?');
    queryParams.push(inquiryType);
  }
  if (statusId) {
    conditions.push('si.OnlineState = ?');
    queryParams.push(parseInt(statusId));
  }
  if (training) {
    conditions.push('c.Course_Name = ?');
    queryParams.push(training);
  }
  if (batchCategory) {
    conditions.push('si.Batch_Category_id = ?');
    queryParams.push(batchCategory);
  }
  if (dateFrom) {
    conditions.push('si.Inquiry_Dt >= ?');
    queryParams.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('si.Inquiry_Dt <= ?');
    queryParams.push(dateTo);
  }

  const whereClause = `WHERE (${conditions.join(') AND (')})`;
  const offset = (page - 1) * limit;

  // One grouped row per Person_Id, plus one pseudo-row per unlinked enquiry (grouped by
  // its own Inquiry_Id so it never merges with anything else).
  const groupKeyExpr = `COALESCE(CONCAT('p', si.Person_Id), CONCAT('i', si.Inquiry_Id))`;

  const [countRows] = await pool.query(
    `SELECT COUNT(*) as total FROM (
       SELECT ${groupKeyExpr} as gk
       FROM \`${inquiryTable}\` si
       ${courseJoin}
       ${disciplineJoin}
       ${whereClause}
       GROUP BY gk
     ) t`,
    queryParams
  );
  const total = Number((countRows as any[])[0]?.total || 0);

  // Temporarily pin the person group containing a just-created inquiry, then preserve
  // the established cron-escalated follow-up priority for every remaining group.
  const followUpPendingStatusId = await getFollowUpPendingStatusId(pool);
  const pinFirstSelect = Number.isInteger(pinnedInquiryId) && Number(pinnedInquiryId) > 0
    ? `MAX(CASE WHEN si.Inquiry_Id = ${Number(pinnedInquiryId)} THEN 1 ELSE 0 END) as HasPinnedInquiry,`
    : '';
  const pinFirstOrder = pinFirstSelect ? 'HasPinnedInquiry DESC, ' : '';
  const followUpFirstSelect = followUpPendingStatusId != null
    ? `MAX(CASE WHEN CAST(NULLIF(si.OnlineState,'') AS UNSIGNED) = ${followUpPendingStatusId} THEN 1 ELSE 0 END) as HasFollowUpPending,`
    : '';
  const followUpFirstOrder = followUpPendingStatusId != null ? 'HasFollowUpPending DESC, ' : '';

  const [rows] = await pool.query(
    `SELECT
       si.Person_Id,
       COALESCE(p.Name, si.Student_Name) as Name,
       COALESCE(p.Mobile, ${mobileExpressions.primary}) as Mobile,
       COALESCE(p.Email, si.Email) as Email,
       COUNT(*) as EnquiryCount,
      ${pinFirstSelect}
       ${followUpFirstSelect}
       MAX(si.Inquiry_Dt) as LatestEnquiryDate,
       MAX(si.Inquiry_Id) as LatestInquiryId
     FROM \`${inquiryTable}\` si
     ${courseJoin}
     ${disciplineJoin}
     LEFT JOIN person_master p ON p.Person_Id = si.Person_Id
     ${whereClause}
     GROUP BY ${groupKeyExpr}
    ORDER BY ${pinFirstOrder}${followUpFirstOrder}LatestEnquiryDate DESC, LatestInquiryId DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset]
  );

  const groupRows = rows as any[];
  const latestIds = groupRows.map((r) => Number(r.LatestInquiryId)).filter((id) => Number.isInteger(id));
  const latestDetailsById = new Map<number, any>();

  // Same columns the flat list shows (Training/Discipline/Source/Status/Last Discussion),
  // fetched in one batched query for just this page's latest-per-person rows — not a
  // correlated subquery per row.
  if (latestIds.length > 0) {
    const ph = latestIds.map(() => '?').join(',');
    const [detailRows] = await pool.query(
      `SELECT
         si.Inquiry_Id, c.Course_Name AS CourseName, ${disciplineExpr} as Discipline,
         si.Inquiry_From, si.Inquiry_Type,
         CAST(NULLIF(si.OnlineState,'') AS UNSIGNED) as Status_id,
         sm.Status as StatusLabel, si.Discussion as InlineDiscussion,
         ld.discussion as LatestDiscussion, ld.date as LatestDiscDate
       FROM \`${inquiryTable}\` si
       LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id
       ${disciplineJoin}
       LEFT JOIN status_master sm ON sm.Id = CAST(NULLIF(si.OnlineState,'') AS UNSIGNED)
       LEFT JOIN (
         SELECT d1.Inquiry_id, d1.discussion, d1.date
         FROM awt_inquirydiscussion d1
         INNER JOIN (
           SELECT Inquiry_id, MAX(id) AS max_id
           FROM awt_inquirydiscussion
           WHERE deleted = 0 AND Inquiry_id IN (${ph})
           GROUP BY Inquiry_id
         ) latest ON latest.Inquiry_id = d1.Inquiry_id AND latest.max_id = d1.id
       ) ld ON ld.Inquiry_id = CAST(si.Inquiry_Id AS CHAR)
       WHERE si.Inquiry_Id IN (${ph})`,
      [...latestIds.map((id) => String(id)), ...latestIds]
    );
    for (const d of detailRows as any[]) {
      latestDetailsById.set(Number(d.Inquiry_Id), d);
    }
  }

  return {
    rows: groupRows.map((r) => {
      const latestInquiryId = Number(r.LatestInquiryId);
      const detail = latestDetailsById.get(latestInquiryId) ?? {};
      return {
        Person_Id: r.Person_Id ?? null,
        Name: r.Name ?? null,
        Mobile: normalizeInquiryMobile(r.Mobile),
        Email: r.Email ?? null,
        EnquiryCount: Number(r.EnquiryCount || 0),
        LatestEnquiryDate: r.LatestEnquiryDate ?? null,
        LatestInquiryId: latestInquiryId,
        CourseName: detail.CourseName ?? null,
        Discipline: detail.Discipline ?? null,
        Source: detail.Inquiry_Type || detail.Inquiry_From || null,
        Status_id: detail.Status_id ?? null,
        StatusLabel: detail.StatusLabel?.trim() || null,
        Discussion: detail.LatestDiscussion ?? detail.InlineDiscussion ?? null,
        DiscussionDate: detail.LatestDiscDate ?? null,
        ...(r.Person_Id == null ? { UnlinkedInquiryId: latestInquiryId } : {}),
      };
    }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function updateInquiry(id: number, data: UpdateInquiryInput, createdBy = 1): Promise<void> {
  const studentName = normalizeInquiryText(data.Student_Name);
  if (!studentName) throw new Error('Name is required');
  const statusId = await requireKnownInquiryStatus(data.Status_id);

  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  await ensureInquiryPreferredLocationColumn(pool, inquiryTable);
  await ensureInquiryStatusChangedColumn(pool, inquiryTable);
  const previousRows = await pool.query(
    `SELECT Discussion FROM \`${inquiryTable}\` WHERE Inquiry_Id = ? LIMIT 1`,
    [id]
  );
  const previousDiscussion = normalizeInquiryText(((previousRows[0] as any[])[0] as any)?.Discussion);
  const nextDiscussion = normalizeInquiryText(data.Discussion);
  await pool.query(
    `UPDATE \`${inquiryTable}\` SET
       Student_Name=?, Sex=?, DOB=?,
       Present_Mobile=?, Present_Mobile2=?,
       Email=?, Nationality=?, Present_Country=?,
       Discussion=?, OnlineState=?,
       Status_Changed_At = CASE WHEN COALESCE(CAST(NULLIF(OnlineState,'') AS UNSIGNED), 0) <> ? THEN NOW() ELSE Status_Changed_At END,
       Inquiry_Dt=?,
       Inquiry_From=?, Inquiry_Type=?,
       Course_Id=?, Batch_Category_id=?, Batch_Code=?,
       Qualification=?, Discipline=?, Percentage=?, Preferred_Location=?
     WHERE Inquiry_Id=?`,
    [
      studentName,
      data.Sex ?? null,
      data.DOB ?? null,
      data.Present_Mobile ?? null,
      data.Present_Mobile2 ?? null,
      data.Email?.trim() ?? null,
      data.Nationality ?? null,
      data.Present_Country ?? null,
      nextDiscussion,
      statusId,
      statusId,
      data.Inquiry_Dt ?? null,
      data.Inquiry_From ?? null,
      data.Inquiry_Type ?? null,
      data.Course_Id ?? null,
      data.Batch_Category_id ?? null,
      data.Batch_Code ?? null,
      data.Qualification ?? null,
      data.Discipline ?? null,
      data.Percentage ?? null,
      data.Preferred_Location ?? null,
      id,
    ]
  );

  if (nextDiscussion && nextDiscussion !== previousDiscussion) {
    await pool.query(
      `INSERT INTO awt_inquirydiscussion (Inquiry_id, date, discussion, deleted, created_by, created_date)
       VALUES (?, CURDATE(), ?, 0, ?, NOW())`,
      [id, nextDiscussion, createdBy]
    );
  }

  invalidateCache('inquiry:filters');
  invalidateCache('inquiry:list-count');
}
