/* eslint-disable @typescript-eslint/no-explicit-any */
import { cached, getPool, invalidateCache } from '@/lib/db';

let inquiryTableNameCache: string | null = null;
let disciplineTableNameCache: string | null | undefined;
let inquirySchemaWarmupPromise: Promise<void> | null = null;
let metaLeadSchemaWarmupPromise: Promise<void> | null = null;
const inquiryDateColumnReadyTables = new Set<string>();

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
  LeadTags?: string[];
  IsDuplicateLead?: boolean;
  IsPuneInquiry?: boolean;
  PuneSourceLocation?: string | null;
  PunePageSource?: string | null;
}

export interface StatusOption { id: number; label: string }

export interface InquiryListResult {
  rows: InquiryRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: {
    disciplines: string[];
    inquiryTypes: string[];
    trainings: string[];
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
  statusId: string;
  duplicatesOnly: boolean;
  dateFrom: string;
  dateTo: string;
  puneOnly: boolean;
  followUpDue: boolean;
}): string {
  return `inquiry:list-count:${JSON.stringify(params)}`;
}

interface InquiryFilterOptions {
  disciplines: string[];
  inquiryTypes: string[];
  trainings: string[];
  statusOptions: StatusOption[];
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

const PRIMARY_INQUIRY_MOBILE_EXPR =
  `NULLIF(TRIM(si.Present_Mobile),'')`;

const SEARCHABLE_INQUIRY_MOBILE_EXPR =
  `COALESCE(${PRIMARY_INQUIRY_MOBILE_EXPR}, NULLIF(TRIM(si.Present_Mobile2),''))`;

const FALLBACK_STATUSES: Record<number, string> = {
  1: 'New', 2: 'Contacted', 3: 'Inquiry', 4: 'Follow Up', 5: 'Interested',
  6: 'Not Interested', 7: 'Admitted', 8: 'Closed', 9: 'DNC', 10: 'Converted',
  12: 'Pending', 15: 'Callback', 16: 'Visited', 18: 'On Hold', 19: 'Lost',
  24: 'Hot Lead', 25: 'Warm Lead', 26: 'Cold Lead', 27: 'Enrolled',
  29: 'Dropped', 33: 'Archived', 34: 'Duplicate Entry', 35: 'Next Batch',
  36: 'Not Eligible',
};

function normalizeInquiryMobile(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const digits = text.replace(/\D/g, '');
  if (!digits) return null;

  // Upstream Suvidya payloads sometimes overflow phone numbers into int32 max.
  if (digits === '2147483647') return null;

  if (digits.length < 10 || digits.length > 15) return null;

  return /^\+?[0-9]+$/.test(text) ? text : digits;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let locationColumnCache: Map<string, string | null> | null = null;

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

async function loadStatusOptions(pool: ReturnType<typeof getPool>): Promise<StatusOption[]> {
  try {
    const [rows] = await pool.query(
      `SELECT Status_id as id, Status as label FROM awt_status
       WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Status_id`
    );
    const options = (rows as any[])
      .map((r: any) => ({ id: Number(r.id), label: String(r.label ?? '').trim() }))
      .filter((s) => Number.isFinite(s.id) && s.id > 0 && s.label.length > 0);
    if (options.length) return options;
  } catch { /* fallback below */ }
  return Object.entries(FALLBACK_STATUSES).map(([id, label]) => ({ id: +id, label }));
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
      const [disciplinesResult, typesResult, trainingsResult, statusOptions] = await Promise.all([
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
        loadStatusOptions(pool),
      ]);

      return {
        disciplines: (disciplinesResult[0] as any[]).map((d: any) => String(d.Discipline).trim()),
        inquiryTypes: (typesResult[0] as any[]).map((t: any) => String(t.Inquiry_Type).trim()),
        trainings: (trainingsResult[0] as any[]).map((r: any) => String(r.Course_Name).trim()),
        statusOptions,
      };
    }
  );
}

// ── Public service functions ──────────────────────────────────────────────────

export async function createInquiry(data: CreateInquiryInput): Promise<number> {
  if (!data.Student_Name?.trim()) throw new Error('Name is required');

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
      data.Status_id ?? 1,
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
       VALUES (?, CURDATE(), ?, 0, 1, NOW())`,
      [insertId, data.Discussion.trim()]
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
  const FOLLOW_UP_DUE_SUBQUERY = `
    SELECT latest.LinkId
    FROM (
      SELECT
        COALESCE(NULLIF(Inquiry_id, 0), NULLIF(student_id, 0)) AS LinkId,
        MAX(id) AS max_id
      FROM awt_inquirydiscussion
      WHERE deleted = 0
        AND COALESCE(NULLIF(Inquiry_id, 0), NULLIF(student_id, 0)) IS NOT NULL
      GROUP BY COALESCE(NULLIF(Inquiry_id, 0), NULLIF(student_id, 0))
    ) latest_ids
    INNER JOIN (
      SELECT
        id,
        nextdate,
        deleted,
        COALESCE(NULLIF(Inquiry_id, 0), NULLIF(student_id, 0)) AS LinkId
      FROM awt_inquirydiscussion
    ) latest
      ON latest.LinkId = latest_ids.LinkId
     AND latest.id = latest_ids.max_id
    WHERE latest.deleted = 0
      AND latest.nextdate IS NOT NULL
      AND latest.nextdate <= CURDATE()
  `;
  const {
    page, limit, search = '', discipline = '', inquiryType = '', leadTag = '',
    location = '', training = '', statusId = '', duplicatesOnly = false, dateFrom = '', dateTo = '',
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
  const puneListingTextCondition = `(
    LOWER(COALESCE(si.Inquiry_From, '')) LIKE '%pune%'
    OR LOWER(COALESCE(si.Discussion, '')) LIKE '%pune%'
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
      `(si.Student_Name LIKE ? OR si.Email LIKE ? OR ${SEARCHABLE_INQUIRY_MOBILE_EXPR} LIKE ? OR c.Course_Name LIKE ? OR ${resolvedBatchCodeExpr} LIKE ?)`
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
      `EXISTS (
         SELECT 1 FROM (
           ${FOLLOW_UP_DUE_SUBQUERY}
         ) due_followups
         WHERE due_followups.Inquiry_id IN (si.Inquiry_Id, si.Student_Id)
       )`
    );
  }

  const whereClause = `WHERE (${conditions.join(') AND (')})`;

  const hasActiveFilters = Boolean(
    search || discipline || inquiryType || leadTag || normalizedLocation || training ||
    statusId || dateFrom || dateTo || duplicatesOnly || puneOnly || followUpDue
  );

  let total = 0;
  let pageIds: number[] = [];
  let sortOrder = new Map<number, number>();

  // Always cache the COUNT — the no-filter case (default page load) is the heaviest
  // full-table scan and was previously the only path without caching.
  total = await cached(
    getInquiryCountCacheKey({
      inquiryTable,
      search,
      discipline,
      inquiryType,
      leadTag,
      location: normalizedLocation,
      training,
      statusId,
      duplicatesOnly,
      dateFrom,
      dateTo,
      puneOnly,
      followUpDue,
    }),
    hasActiveFilters ? 30_000 : 60_000, // no-filter total changes slowly; cache for 60s
    async () => {
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total
         FROM \`${inquiryTable}\` si
         ${listCourseJoin}
         ${listDisciplineJoin}
         ${puneOnly ? puneListJoin : ''}
         ${whereClause}`,
        queryParams
      );
      return (countResult as any[])[0]?.total || 0;
    }
  );

  const [sortedIds] = await pool.query(
    `SELECT si.Inquiry_Id
     FROM \`${inquiryTable}\` si
     ${listCourseJoin}
     ${listDisciplineJoin}
     ${puneOnly ? puneListJoin : ''}
     ${whereClause}
     ORDER BY ${inquiryDateExpr} DESC, si.Inquiry_Id DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset]
  );
  pageIds = (sortedIds as any[]).map((r: any) => r.Inquiry_Id);
  sortOrder = new Map((sortedIds as any[]).map((r: any, i: number) => [r.Inquiry_Id, i]));

  // Fetch full rows for page IDs
  let dataRows: any[] = [];
  if (pageIds.length > 0) {
    const ph = pageIds.map(() => '?').join(',');
    const locationSelect = locationColumn ? `si.${locationColumn} as Location,` : 'NULL as Location,';
    const [rows] = await pool.query(
      `SELECT
         si.Inquiry_Id as Student_Id, si.Student_Id as SourceStudentId,
         si.Student_Name, c.Course_Name as CourseName, si.Inquiry_Dt,
        ${PRIMARY_INQUIRY_MOBILE_EXPR} as Present_Mobile, si.Email, ${locationSelect}
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
         SELECT si_map.Inquiry_Id as InquiryId, MAX(d.id) as max_id
         FROM \`${inquiryTable}\` si_map
         INNER JOIN awt_inquirydiscussion d ON d.deleted = 0 AND (
           d.Inquiry_id = si_map.Inquiry_Id OR d.Inquiry_id = si_map.Student_Id OR d.student_id = si_map.Student_Id
         )
         WHERE si_map.Inquiry_Id IN (${ph})
         GROUP BY si_map.Inquiry_Id
       ) tld ON tld.InquiryId = si.Inquiry_Id
       LEFT JOIN awt_inquirydiscussion ld ON ld.id = tld.max_id
       LEFT JOIN awt_adminuser au ON au.id = ld.created_by
       LEFT JOIN office_employee_mst oe ON oe.Emp_Id = ld.created_by
       WHERE si.Inquiry_Id IN (${ph})`,
      [...pageIds, ...pageIds]
    );
    dataRows = (rows as any[]).sort(
      (a: any, b: any) => (sortOrder.get(a.Student_Id) ?? 0) - (sortOrder.get(b.Student_Id) ?? 0)
    );
  }

  // Filter option queries (run in parallel)
  const { disciplines, inquiryTypes, trainings, statusOptions } = await loadInquiryFilterOptions(
    pool,
    inquiryTable,
    disciplineJoin,
    disciplineExpr,
  );

  const statusMap = Object.fromEntries(statusOptions.map((s) => [s.id, s.label]));

  const rows: InquiryRow[] = dataRows.map((r: any) => {
    const inlineDisc = r.InlineDiscussion && r.InlineDiscussion !== 'NULL' ? r.InlineDiscussion : null;
    const sourceStudentId = r.SourceStudentId == null ? '' : String(r.SourceStudentId).trim();
    const inquiryTypeVal = r.Inquiry_Type?.trim()
      ? r.Inquiry_Type.trim()
      : sourceStudentId === '' ? 'Online Inquiry' : null;
    const disciplineVal =
      (r.DisciplineName?.trim() || r.Discipline?.trim() || null);
    const cleanDiscipline =
      disciplineVal && !['NULL', 'Select'].includes(disciplineVal) ? disciplineVal : null;

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
      Status_id: r.Status_id ?? null,
      StatusLabel:
        statusMap[r.Status_id] ??
        (r.OnlineStateRaw?.trim() || null) ??
        (r.Status_id != null ? `Status ${r.Status_id}` : 'Open'),
      Discussion: r.LatestDiscussion || inlineDisc || null,
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

  return {
    rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    filters: {
      disciplines,
      inquiryTypes,
      trainings,
      statusOptions,
    },
  };
}

export async function updateInquiry(id: number, data: UpdateInquiryInput): Promise<void> {
  if (!data.Student_Name?.trim()) throw new Error('Name is required');

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
      data.Status_id ?? 1,
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
       VALUES (?, CURDATE(), ?, 0, 1, NOW())`,
      [id, data.Discussion.trim()]
    );
  }

  invalidateCache('inquiry:filters');
  invalidateCache('inquiry:list-count');
  invalidateCache('inquiry:list-count');
}
