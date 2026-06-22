/* eslint-disable @typescript-eslint/no-explicit-any */
import { cached, getPool, invalidateCache } from '@/lib/db';
import { getSlowRequestThresholdMs } from '@/lib/perf-log';

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
}

export interface UpdateInquiryInput extends Omit<CreateInquiryInput, 'Student_Name'> {
  Student_Name: string;
}

export interface InquiryListParams {
  page: number;
  limit: number;
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
  { id: 6, label: 'Irrelevant' },
  { id: 7, label: 'Follow up pending' },
  { id: 8, label: 'Admission confirmed' },
  { id: 9, label: 'Lost lead' },
];

const ALLOWED_INQUIRY_STATUS_IDS = new Set(ALLOWED_INQUIRY_STATUSES.map((status) => status.id));

function requireAllowedInquiryStatus(value: unknown): number {
  const statusId = Number(value);
  if (!Number.isInteger(statusId) || !ALLOWED_INQUIRY_STATUS_IDS.has(statusId)) {
    const error = new Error('Status is required');
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
  const text = String(value ?? '').trim();
  if (!text) return null;

  const rawCandidates = [
    text,
    ...text.split(/[|,;\/]+/).map((part) => part.trim()).filter(Boolean),
    ...Array.from(text.matchAll(/\+?\d[\d\s().-]{8,20}\d/g), (match) => String(match[0] || '').trim()).filter(Boolean),
  ];

  const seen = new Set<string>();
  for (const candidate of rawCandidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);

    const digits = candidate.replace(/\D/g, '');
    if (!digits) continue;

    // Upstream Suvidya payloads sometimes overflow phone numbers into int32 max.
    if (digits === '2147483647') continue;

    if (digits.length === 11 && digits.startsWith('0')) {
      return digits.slice(1);
    }
    if (digits.length >= 10 && digits.length <= 15) {
      return digits;
    }
  }

  return null;
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

  const preferredColumns = [
    'Present_Mobile',
    'Present_Mobile2',
    'Father_Mobile',
    'Mother_Mobile',
    'Sibling_Mobile',
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
  void pool;
  return ALLOWED_INQUIRY_STATUSES;
}

/**
 * Status options sourced from the canonical `status_master` table (the list an
 * admin manages under Masters › Status). Its `Id` maps directly to the inquiry's
 * `OnlineState`. Used by the inquiry discussion area's status dropdown. Cached for
 * 5 minutes since the list changes rarely — keeps this off the hot request path.
 */
export async function getStatusMasterOptions(): Promise<StatusOption[]> {
  const pool = getPool();
  return cached('inquiry:status-master-options', 5 * 60 * 1000, async () => {
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
  await pool.query(
    `UPDATE \`${inquiryTable}\` SET OnlineState = ?
     WHERE Inquiry_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
    [statusId, inquiryId]
  );
}

async function loadInquiryFilterOptions(
  pool: ReturnType<typeof getPool>,
  inquiryTable: string,
  disciplineJoin: string,
  disciplineExpr: string,
): Promise<InquiryFilterOptions> {
  return cached(
    `inquiry:filters:${inquiryTable}:${disciplineJoin ? 'with-discipline' : 'without-discipline'}`,
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
        // Inquiries store Batch_Category_id as the mst_batchcategory id. Only surface the
        // four standard categories (Full Time, Part Time, Weekend, Online) as filter options.
        pool.query(
          `SELECT id, BatchCategory FROM mst_batchcategory
           WHERE (IsDelete = 0 OR IsDelete IS NULL) AND (IsActive = 1 OR IsActive IS NULL)
             AND BatchCategory IN ('Full Time', 'Part Time', 'Weekend Batches', 'ONLINE')
           ORDER BY FIELD(BatchCategory, 'Full Time', 'Part Time', 'Weekend Batches', 'ONLINE')`
        ),
        loadStatusOptions(pool),
      ]);

      const batchCategoryLabels: Record<string, string> = {
        'Weekend Batches': 'Weekend',
        'ONLINE': 'Online',
      };

      return {
        disciplines: (disciplinesResult[0] as any[]).map((d: any) => String(d.Discipline).trim()),
        inquiryTypes: (typesResult[0] as any[]).map((t: any) => String(t.Inquiry_Type).trim()),
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
  if (!data.Student_Name?.trim()) throw new Error('Name is required');
  const statusId = requireAllowedInquiryStatus(data.Status_id);

  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  const [result] = await pool.query(
    `INSERT INTO \`${inquiryTable}\` (
       Student_Name, Sex, DOB, Present_Mobile, Present_Mobile2,
       Email, Nationality, Present_Country, Discussion,
       OnlineState, Inquiry_Dt, Inquiry_From, Inquiry_Type,
       Course_Id, Batch_Category_id, Batch_Code,
       Qualification, Discipline, Percentage,
       IsDelete, Inquiry, Date_Added
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,'Inquiry',NOW())`,
    [
      data.Student_Name.trim(),
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
    ]
  );
  const insertId = (result as any).insertId as number;

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
       si.Inquiry_Dt, si.Inquiry_From, si.Inquiry_Type,
       si.Course_Id, si.Batch_Category_id, si.Batch_Code,
       si.Qualification, si.Discipline, ${disciplineExpr} as DisciplineName, si.Percentage,
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
    page, limit, search = '', discipline = '', inquiryType = '', leadTag = '',
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

  const ALLOWED_LOCATIONS = new Set(['pune', 'mumbai']);
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
            AND d.Inquiry_id = si.Student_Id
            AND d.id = (
              SELECT MAX(d2.id)
              FROM awt_inquirydiscussion d2
              WHERE d2.deleted = 0
                AND d2.Inquiry_id = si.Student_Id
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
  perfPhases.prepMs = Date.now() - startedAt;

  const hasActiveFilters = Boolean(
    search || discipline || inquiryType || leadTag || normalizedLocation || training ||
    batchCategory || statusId || dateFrom || dateTo || duplicatesOnly || puneOnly || followUpDue
  );
  const useFastUnfilteredPath = !hasActiveFilters;

  // When _inquiry_date is not available yet, sorting with STR_TO_DATE(...) is very expensive
  // on large tables. Fall back to primary-key recency to keep first page responsive.
  const listOrderByClause = inquiryDateColumnAvailable
    ? `${inquiryDateExpr} DESC, si.Inquiry_Id DESC`
    : `si.Inquiry_Id DESC`;

  let total = 0;
  let pageIds: number[] = [];
  let sortOrder = new Map<number, number>();

  let filteredCountPromise: Promise<number> | null = null;

  if (useFastUnfilteredPath) {
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
           ${whereClause}`,
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
     ${whereClause}
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
         si.Student_Name, c.Course_Name as CourseName, si.Inquiry_Dt,
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
         si.Discussion as InlineDiscussion,
         ${metaSelect}
         ld.discussion as LatestDiscussion, ld.date as LatestDiscDate,
         ld.nextdate as NextFollowUpDate, ld.created_by as LatestDiscussionById,
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
      ${disciplineJoin}
      ${metaJoin}
      ${puneListJoin}
       LEFT JOIN (
         SELECT d.Inquiry_id as InquiryId, MAX(d.id) as max_id
         FROM awt_inquirydiscussion d
         WHERE d.deleted = 0
           AND d.Inquiry_id IN (${ph})
         GROUP BY d.Inquiry_id
       ) tld_primary ON tld_primary.InquiryId = si.Inquiry_Id
       LEFT JOIN (
         SELECT si_map.Inquiry_Id as InquiryId, MAX(d.id) as max_id
         FROM \`${inquiryTable}\` si_map
         INNER JOIN awt_inquirydiscussion d
           ON d.deleted = 0
          AND si_map.Student_Id IS NOT NULL
          AND (d.Inquiry_id = si_map.Student_Id OR d.student_id = si_map.Student_Id)
         WHERE si_map.Inquiry_Id IN (${ph})
         GROUP BY si_map.Inquiry_Id
       ) tld_legacy ON tld_legacy.InquiryId = si.Inquiry_Id
       LEFT JOIN awt_inquirydiscussion ld ON ld.id = COALESCE(tld_primary.max_id, tld_legacy.max_id)
       LEFT JOIN awt_adminuser au ON au.id = ld.created_by
       LEFT JOIN office_employee_mst oe ON oe.Emp_Id = ld.created_by
       WHERE si.Inquiry_Id IN (${ph})`,
      [...pageIds, ...pageIds, ...pageIds],
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

    return {
      Student_Id: r.Student_Id,
      Student_Name: r.Student_Name,
      CourseName: r.CourseName ?? null,
      Inquiry_Dt: r.Inquiry_Dt ?? null,
      Present_Mobile: normalizeInquiryMobile(r.Present_Mobile),
      Email: r.Email ?? null,
      Location: r.Location?.trim() || null,
      Discipline: cleanDiscipline,
      Inquiry_From: r.Inquiry_From ?? null,
      Inquiry_Type: inquiryTypeVal,
      IsMetaAdConverted: isMetaAdConverted,
      Status_id: r.Status_id ?? null,
      StatusLabel:
        statusMap[r.Status_id] ??
        (r.OnlineStateRaw?.trim() || null) ??
        (r.Status_id != null ? `Status ${r.Status_id}` : 'Open'),
      Discussion: cleanedLatestDisc || cleanedInlineDisc || null,
      DiscussionDate: r.LatestDiscDate ?? null,
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

export async function updateInquiry(id: number, data: UpdateInquiryInput, createdBy = 1): Promise<void> {
  if (!data.Student_Name?.trim()) throw new Error('Name is required');
  const statusId = requireAllowedInquiryStatus(data.Status_id);

  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  await pool.query(
    `UPDATE \`${inquiryTable}\` SET
       Student_Name=?, Sex=?, DOB=?,
       Present_Mobile=?, Present_Mobile2=?,
       Email=?, Nationality=?, Present_Country=?,
       Discussion=?, OnlineState=?, Inquiry_Dt=?,
       Inquiry_From=?, Inquiry_Type=?,
       Course_Id=?, Batch_Category_id=?, Batch_Code=?,
       Qualification=?, Discipline=?, Percentage=?
     WHERE Inquiry_Id=?`,
    [
      data.Student_Name.trim(),
      data.Sex ?? null,
      data.DOB ?? null,
      data.Present_Mobile ?? null,
      data.Present_Mobile2 ?? null,
      data.Email?.trim() ?? null,
      data.Nationality ?? null,
      data.Present_Country ?? null,
      data.Discussion?.trim() ?? null,
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
      id,
    ]
  );

  if (data.Discussion?.trim()) {
    await pool.query(
      `INSERT INTO awt_inquirydiscussion (Inquiry_id, date, discussion, deleted, created_by, created_date)
       VALUES (?, CURDATE(), ?, 0, ?, NOW())`,
      [id, data.Discussion.trim(), createdBy]
    );
  }

  invalidateCache('inquiry:filters');
  invalidateCache('inquiry:list-count');
}
