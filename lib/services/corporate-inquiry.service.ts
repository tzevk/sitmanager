/* eslint-disable @typescript-eslint/no-explicit-any */
import { cached, getPool } from '@/lib/db';
import { cache, cacheKeys, cacheTTL } from '@/lib/cache';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CorporateInquiryListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}

export interface CorporateInquiryListResult {
  rows: any[];
  courses: any[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateCorporateInquiryInput {
  Fname?: string; MName?: string; Lname?: string; FullName?: string;
  CompanyName?: string; Designation?: string; Address?: string;
  City?: string; State?: string; Country?: string; Pin?: string;
  Phone?: string; Mobile?: string; Email?: string; Course_Id?: string;
  Place?: string; business?: string; Remark?: string; Idate?: string;
  Consultancy_Id?: number | null; CompanyType?: string;
  CompanyAuthority?: string; TrainingMode?: string;
  Participants_Fresher?: number | null; Participants_Experienced?: number | null;
  TrainingLocation?: string; TrainingDates?: string;
  Discussion?: string; FollowUp?: unknown;
  InitialFollowUpDate?: string; NextFollowUpDate?: string;
}

export type PatchCorporateInquiryInput = {
  Id: number;
  InquiryStatus?: string; TrainingNumber?: string; TrainingDate?: string;
  TrainerName?: string; NumberOfDays?: unknown; TotalStudents?: unknown;
  TrainingCoordinator?: string; Discussion?: string; FollowUp?: string;
  InitialFollowUpDate?: string; NextFollowUpDate?: string;
  TrainingMode?: unknown; DiscussionOutcome?: unknown; ConfirmDate?: string;
  PerformanceEvaluation?: unknown; PerformanceEvaluation_PreTest?: string;
  PerformanceEvaluation_Assessment?: string; PerformanceEvaluation_Assignment?: string;
  PerformanceEvaluation_FinalExam?: string; PerformanceEvaluation_TrainingMaterial?: string;
  PerformanceEvaluation_Attendance?: string;
  TrainingFeedbackObtained?: unknown; SitCertIssuedOnPerformanceOnAttendance?: unknown;
  TrainingFeedback?: unknown; SitCertification?: unknown;
};

export interface UpdateCorporateInquiryInput extends CreateCorporateInquiryInput {
  Id: number;
  InquiryStatus?: string; TrainingNumber?: string; TrainingDate?: string;
  TrainerName?: string; NumberOfDays?: unknown; TotalStudents?: unknown;
  TrainingCoordinator?: string; DiscussionOutcome?: string;
}

// ── Normalizers / parsers ─────────────────────────────────────────────────────

function toNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i >= 0 ? i : null;
}

function normalizeDateOnly(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function normalizeMultiText(value: unknown): string | null {
  if (Array.isArray(value)) {
    const joined = value.map((v) => String(v ?? '').trim()).filter(Boolean).join(', ');
    return joined || null;
  }
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str || null;
}

export function parseDiscussionOutcome(value: unknown): 'Awarded' | 'Regretted' | 'On Hold' | null {
  if (value === null || value === undefined || value === '') return null;
  const l = String(value).trim().toLowerCase();
  if (l === 'awarded') return 'Awarded';
  if (l === 'regretted') return 'Regretted';
  if (l === 'on hold' || l === 'onhold' || l === 'hold') return 'On Hold';
  throw new Error('Invalid DiscussionOutcome. Allowed: Awarded, Regretted, On Hold');
}

export function parseTrainingMode(value: unknown): 'online' | 'offline' | 'both online and offline' | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim().toLowerCase();
  if (raw === 'online') return 'online';
  if (raw === 'offline') return 'offline';
  if (raw === 'both online and offline' || raw === 'both' || raw === 'online and offline')
    return 'both online and offline';
  throw new Error('Invalid TrainingMode. Allowed: online, offline, both online and offline');
}

// ── Schema helpers ────────────────────────────────────────────────────────────

async function ensureConsultancyCompanyTypeColumn(pool: ReturnType<typeof getPool>) {
  const [rows] = await pool.query<any[]>(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'consultant_mst' AND COLUMN_NAME = 'Company_Type'`
  );
  if ((rows?.[0]?.cnt ?? 0) === 0) {
    await pool.query(`ALTER TABLE consultant_mst ADD COLUMN Company_Type VARCHAR(20) NULL`);
  }
}

const COLUMN_LENGTH_CACHE = new Map<string, Promise<number | null>>();

async function getColumnMaxLength(
  pool: ReturnType<typeof getPool>, tableName: string, columnName: string
): Promise<number | null> {
  const key = `${tableName}.${columnName}`;
  if (!COLUMN_LENGTH_CACHE.has(key)) {
    COLUMN_LENGTH_CACHE.set(key, (async () => {
      try {
        const [rows] = await pool.query<any[]>(
          `SELECT CHARACTER_MAXIMUM_LENGTH AS max_len FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
          [tableName, columnName]
        );
        const n = Number(rows?.[0]?.max_len);
        return Number.isFinite(n) && n > 0 ? n : null;
      } catch { return null; }
    })());
  }
  return COLUMN_LENGTH_CACHE.get(key)!;
}

async function normalizeToColumnLength(
  pool: ReturnType<typeof getPool>, tableName: string, columnName: string, value: unknown
): Promise<string | null> {
  const raw = value == null ? '' : String(value).trim();
  if (!raw) return null;
  const maxLen = await getColumnMaxLength(pool, tableName, columnName);
  return (!maxLen || raw.length <= maxLen) ? raw : raw.slice(0, maxLen);
}

export async function ensureCorporateInquiryColumns(pool: ReturnType<typeof getPool>) {
  const wanted = [
    'Consultancy_Id','CompanyType','CompanyAuthority','TrainingMode',
    'Participants_Fresher','Participants_Experienced','TrainingLocation','TrainingDates',
    'Discussion','FollowUp','InitialFollowUpDate','NextFollowUpDate',
    'InquiryStatus','TrainingNumber','TrainingDate','TrainerName',
    'NumberOfDays','TotalStudents','TrainingCoordinator','DiscussionOutcome',
    'ConfirmDate','PerformanceEvaluation_PreTest','PerformanceEvaluation_Assessment',
    'PerformanceEvaluation_Assignment','PerformanceEvaluation_FinalExam',
    'PerformanceEvaluation_TrainingMaterial','PerformanceEvaluation_Attendance',
    'TrainingFeedbackObtained','SitCertIssuedOnPerformanceOnAttendance',
  ] as const;

  const [rows] = await pool.query<any[]>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'corporate_inquiry'
       AND COLUMN_NAME IN (${wanted.map(() => '?').join(',')})`,
    [...wanted]
  );
  const existing = new Set((rows || []).map((r: any) => String(r?.COLUMN_NAME || '')));

  const alters: [string, string][] = [
    ['Consultancy_Id','INT NULL'], ['CompanyType','VARCHAR(20) NULL'],
    ['CompanyAuthority','VARCHAR(255) NULL'], ['TrainingMode','VARCHAR(20) NULL'],
    ['Participants_Fresher','INT NULL'], ['Participants_Experienced','INT NULL'],
    ['TrainingLocation','VARCHAR(255) NULL'], ['TrainingDates','TEXT NULL'],
    ['Discussion','TEXT NULL'], ['FollowUp','TEXT NULL'],
    ['InitialFollowUpDate','DATE NULL'], ['NextFollowUpDate','DATE NULL'],
    ['InquiryStatus','VARCHAR(20) NULL'], ['TrainingNumber','VARCHAR(50) NULL'],
    ['TrainingDate','DATE NULL'], ['TrainerName','VARCHAR(255) NULL'],
    ['NumberOfDays','INT NULL'], ['TotalStudents','INT NULL'],
    ['TrainingCoordinator','VARCHAR(255) NULL'], ['DiscussionOutcome','VARCHAR(20) NULL'],
    ['ConfirmDate','DATE NULL'], ['PerformanceEvaluation_PreTest','TEXT NULL'],
    ['PerformanceEvaluation_Assessment','TEXT NULL'], ['PerformanceEvaluation_Assignment','TEXT NULL'],
    ['PerformanceEvaluation_FinalExam','TEXT NULL'], ['PerformanceEvaluation_TrainingMaterial','TEXT NULL'],
    ['PerformanceEvaluation_Attendance','TEXT NULL'], ['TrainingFeedbackObtained','TEXT NULL'],
    ['SitCertIssuedOnPerformanceOnAttendance','TEXT NULL'],
  ];

  for (const [col, def] of alters) {
    if (!existing.has(col)) {
      await pool.query(`ALTER TABLE corporate_inquiry ADD COLUMN ${col} ${def}`);
    }
  }
}

// ── Consultancy resolution ────────────────────────────────────────────────────

async function getOrCreateConsultancy(opts: {
  pool: ReturnType<typeof getPool>;
  companyName: string;
  contactPerson?: string | null; designation?: string | null;
  phone?: string | null; mobile?: string | null; email?: string | null;
  city?: string | null; companyType?: string | null; dateAdded?: string | null;
}): Promise<number> {
  const name = opts.companyName.trim();
  if (!name) throw new Error('CompanyName is required to create consultancy');

  await ensureConsultancyCompanyTypeColumn(opts.pool);

  const [existing] = await opts.pool.query<any[]>(
    `SELECT Const_Id FROM consultant_mst
     WHERE (IsDelete = 0 OR IsDelete IS NULL) AND LOWER(TRIM(Comp_Name)) = LOWER(TRIM(?)) LIMIT 1`,
    [name]
  );
  const existingId = existing?.[0]?.Const_Id ? Number(existing[0].Const_Id) : null;

  if (existingId) {
    await opts.pool.query(
      `UPDATE consultant_mst SET
         Contact_Person = CASE WHEN (Contact_Person IS NULL OR TRIM(Contact_Person)='') THEN ? ELSE Contact_Person END,
         Designation    = CASE WHEN (Designation IS NULL OR TRIM(Designation)='') THEN ? ELSE Designation END,
         Tel            = CASE WHEN (Tel IS NULL OR TRIM(Tel)='') THEN ? ELSE Tel END,
         Mobile         = CASE WHEN (Mobile IS NULL OR TRIM(Mobile)='') THEN ? ELSE Mobile END,
         EMail          = CASE WHEN (EMail IS NULL OR TRIM(EMail)='') THEN ? ELSE EMail END,
         City           = CASE WHEN (City IS NULL OR TRIM(City)='') THEN ? ELSE City END,
         Company_Type   = CASE WHEN (Company_Type IS NULL OR TRIM(Company_Type)='') THEN ? ELSE Company_Type END,
         Date_Added     = CASE WHEN Date_Added IS NULL THEN ? ELSE Date_Added END
       WHERE Const_Id = ?`,
      [opts.contactPerson||null, opts.designation||null, opts.phone||null, opts.mobile||null,
       opts.email||null, opts.city||null, opts.companyType||null, opts.dateAdded||null, existingId]
    );
    return existingId;
  }

  const [result] = await opts.pool.query<any>(
    `INSERT INTO consultant_mst
       (Comp_Name,Contact_Person,Designation,Address,City,Tel,Mobile,EMail,Date_Added,Company_Type,IsActive,IsDelete)
     VALUES (?,?,?,?,?,?,?,?,?,?,1,0)`,
    [name, opts.contactPerson||null, opts.designation||null, '',
     opts.city||null, opts.phone||null, opts.mobile||null,
     opts.email||null, opts.dateAdded||null, opts.companyType||null]
  );
  return Number(result.insertId);
}

async function resolveConsultancyId(opts: {
  pool: ReturnType<typeof getPool>;
  consultancyId?: number | null;
  companyName?: string | null;
  contactPerson?: string | null; designation?: string | null;
  phone?: string | null; mobile?: string | null; email?: string | null;
  city?: string | null; companyType?: string | null; dateAdded?: string | null;
}): Promise<number | null> {
  const id = Number(opts.consultancyId);
  if (Number.isFinite(id) && id > 0) {
    const [rows] = await opts.pool.query<any[]>(
      `SELECT 1 FROM consultant_mst WHERE Const_Id=? AND (IsDelete=0 OR IsDelete IS NULL) LIMIT 1`,
      [id]
    );
    if (Array.isArray(rows) && rows.length > 0) return id;
  }
  const name = String(opts.companyName || '').trim();
  if (!name) return null;
  return getOrCreateConsultancy({
    pool: opts.pool,
    companyName: name,
    contactPerson: opts.contactPerson ?? null,
    designation: opts.designation ?? null,
    phone: opts.phone ?? null,
    mobile: opts.mobile ?? null,
    email: opts.email ?? null,
    city: opts.city ?? null,
    companyType: opts.companyType ?? null,
    dateAdded: opts.dateAdded ?? null,
  });
}

// ── Followup sync ─────────────────────────────────────────────────────────────

type FollowupCandidate = {
  followupDate: string | null; nextFollowupDate?: string | null;
  contactPerson?: string | null; designation?: string | null;
  mobile?: string | null; email?: string | null;
  purpose: string | null; course?: string | null;
  directLine?: string | null; remarks: string | null;
};

function extractFollowupCandidates(opts: {
  followUpRaw?: unknown; discussion?: unknown;
  initialFollowUpDate?: unknown; nextFollowUpDate?: unknown; inquiryDate?: unknown;
}): FollowupCandidate[] {
  const out: FollowupCandidate[] = [];
  const fallbackDate =
    normalizeDateOnly(opts.nextFollowUpDate) ||
    normalizeDateOnly(opts.initialFollowUpDate) ||
    normalizeDateOnly(opts.inquiryDate) || null;

  const push = (entry: FollowupCandidate) => {
    const r = String(entry.remarks || '').trim();
    const p = String(entry.purpose || '').trim();
    const d = normalizeDateOnly(entry.followupDate) || normalizeDateOnly(entry.nextFollowupDate) || null;
    const cp = String(entry.contactPerson || '').trim();
    const mob = String(entry.mobile || '').trim();
    const em = String(entry.email || '').trim();
    if (!r && !p && !d && !cp && !mob && !em) return;
    out.push({ ...entry, followupDate: d, nextFollowupDate: normalizeDateOnly(entry.nextFollowupDate),
      contactPerson: cp || null, designation: String(entry.designation||'').trim()||null,
      mobile: mob||null, email: em||null, purpose: p||null,
      course: String(entry.course||'').trim()||null,
      directLine: String(entry.directLine||'').trim()||null, remarks: r||null });
  };

  const rawStr = String(opts.followUpRaw || '').trim();
  if (rawStr) {
    try {
      const parsed = JSON.parse(rawStr) as any;
      const meetings = Array.isArray(parsed?.followUps) ? parsed.followUps
        : Array.isArray(parsed?.meetings) ? parsed.meetings : [];
      for (const m of meetings) {
        if (!m || typeof m !== 'object') continue;
        push({ followupDate: m.date||m.followupDate||m.meetingDate||fallbackDate,
          nextFollowupDate: m.nextDate||m.nextFollowUpDate||null,
          contactPerson: m.contactPerson||m.fullName||m.attendeeClient||null,
          designation: m.designation||m.jobTitle||null,
          mobile: normalizeMultiText(m.mobile??m.phoneNumber??m.phoneNumbers),
          email: normalizeMultiText(m.email??m.emails),
          purpose: m.purpose||'Corporate Inquiry Follow-up',
          course: m.course||m.trainingProgramme||null,
          directLine: normalizeMultiText(m.directLine??m.alternateNumber??m.alternateNumbers),
          remarks: m.remark||m.remarks||m.meetingAgenda||parsed?.meetingAgenda||null });
      }
      const contacts = Array.isArray(parsed?.contacts) ? parsed.contacts : [];
      for (const c of contacts) {
        if (!c || typeof c !== 'object') continue;
        push({ followupDate: fallbackDate,
          contactPerson: c.fullName||null, designation: c.jobTitle||null,
          mobile: normalizeMultiText(c.phoneNumber??c.phoneNumbers),
          email: normalizeMultiText(c.email??c.emails),
          directLine: normalizeMultiText(c.alternateNumber??c.alternateNumbers),
          purpose: 'Corporate Inquiry Follow-up', remarks: c.discussion||null });
      }
      if (meetings.length === 0 && parsed?.meetingAgenda) {
        push({ followupDate: parsed?.meetingDate||parsed?.initialDate||fallbackDate,
          purpose: 'Corporate Inquiry Follow-up', remarks: parsed.meetingAgenda });
      }
    } catch {
      push({ followupDate: fallbackDate, purpose: 'Corporate Inquiry Follow-up', remarks: rawStr });
    }
  }

  const dedup = new Map<string, FollowupCandidate>();
  for (const item of out) {
    const k = [item.followupDate,item.contactPerson,item.mobile,item.email,item.purpose,item.course,item.directLine,item.remarks]
      .map(s => String(s||'').toLowerCase()).join('|');
    if (!dedup.has(k)) dedup.set(k, item);
  }
  return Array.from(dedup.values());
}

async function ensureFollowupTable(pool: ReturnType<typeof getPool>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS consultant_followup (
      Followup_Id INT AUTO_INCREMENT PRIMARY KEY,
      Const_Id INT NOT NULL, Followup_Date DATE,
      Contact_Person VARCHAR(255), Designation VARCHAR(255),
      Mobile VARCHAR(50), email VARCHAR(255), Purpose VARCHAR(255),
      Course VARCHAR(255), Direct_Line VARCHAR(100), Remarks TEXT,
      Added_By INT, Source_Inquiry_Id INT NULL, IsDelete TINYINT DEFAULT 0,
      Date_Added DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_const_id (Const_Id), INDEX idx_source_inquiry (Source_Inquiry_Id)
    )
  `);
  const [rows] = await pool.query<any[]>(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='consultant_followup' AND COLUMN_NAME='Source_Inquiry_Id'`
  );
  if ((rows?.[0]?.cnt ?? 0) === 0) {
    await pool.query(`ALTER TABLE consultant_followup ADD COLUMN Source_Inquiry_Id INT NULL`);
    await pool.query(`ALTER TABLE consultant_followup ADD INDEX idx_source_inquiry (Source_Inquiry_Id)`);
  }
}

async function syncFollowups(opts: {
  pool: ReturnType<typeof getPool>;
  consultancyId: number | null; corporateInquiryId?: number | null;
  companyAuthority?: string | null; fullName?: string | null;
  designation?: string | null; mobile?: string | null; email?: string | null;
  followUpRaw?: unknown; discussion?: unknown;
  initialFollowUpDate?: unknown; nextFollowUpDate?: unknown; inquiryDate?: unknown;
}) {
  if (!opts.consultancyId) return;

  const candidates = extractFollowupCandidates({
    followUpRaw: opts.followUpRaw, discussion: opts.discussion,
    initialFollowUpDate: opts.initialFollowUpDate, nextFollowUpDate: opts.nextFollowUpDate,
    inquiryDate: opts.inquiryDate,
  });
  if (!candidates.length) return;

  await ensureFollowupTable(opts.pool);

  const contactPerson =
    String(opts.companyAuthority||'').trim() || String(opts.fullName||'').trim() || null;
  const sourceId = Number.isFinite(Number(opts.corporateInquiryId)) && Number(opts.corporateInquiryId) > 0
    ? Number(opts.corporateInquiryId) : null;

  if (sourceId !== null) {
    await opts.pool.query(
      `DELETE FROM consultant_followup WHERE Const_Id=? AND Source_Inquiry_Id=?`,
      [opts.consultancyId, sourceId]
    );
  }

  for (const c of candidates) {
    if (sourceId === null) {
      const [ex] = await opts.pool.query<any[]>(
        `SELECT Followup_Id FROM consultant_followup
         WHERE Const_Id=?
           AND COALESCE(Followup_Date,'1900-01-01')=COALESCE(?,'1900-01-01')
           AND LOWER(TRIM(COALESCE(Contact_Person,'')))=LOWER(TRIM(COALESCE(?,'')))`
         + ` AND LOWER(TRIM(COALESCE(Mobile,'')))=LOWER(TRIM(COALESCE(?,'')))`
         + ` AND LOWER(TRIM(COALESCE(email,'')))=LOWER(TRIM(COALESCE(?,'')))`
         + ` AND LOWER(TRIM(COALESCE(Remarks,'')))=LOWER(TRIM(COALESCE(?,'')))`
         + ` AND (IsDelete=0 OR IsDelete IS NULL) LIMIT 1`,
        [opts.consultancyId, c.followupDate, c.contactPerson, c.mobile, c.email, c.remarks]
      );
      if (Array.isArray(ex) && ex.length > 0) continue;
    }
    await opts.pool.query(
      `INSERT INTO consultant_followup
         (Const_Id,Followup_Date,Contact_Person,Designation,Mobile,email,Purpose,Course,Direct_Line,Remarks,Added_By,Source_Inquiry_Id)
       VALUES (?,?,?,?,?,?,?,?,?,?,NULL,?)`,
      [opts.consultancyId, c.followupDate, c.contactPerson||contactPerson,
       c.designation||String(opts.designation||'').trim()||null,
       c.mobile||String(opts.mobile||'').trim()||null,
       c.email||String(opts.email||'').trim()||null,
       c.purpose, c.course||null, c.directLine||null, c.remarks, sourceId]
    );
  }
}

async function ensureCorporateIndexes(pool: ReturnType<typeof getPool>): Promise<void> {
  await cached('schema:corporate_inquiry_indexes', 60 * 60 * 1000, async () => {
    const indexes: Array<{ name: string; cols: string }> = [
      { name: 'idx_corp_list',   cols: 'IsDelete, Id' },
      { name: 'idx_corp_status', cols: 'IsDelete, InquiryStatus, Id' },
    ];
    const [existingRows] = await pool.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'corporate_inquiry'
       GROUP BY INDEX_NAME`
    );
    const existing = new Set((existingRows as any[]).map((r: any) => r.INDEX_NAME));
    await Promise.all(
      indexes
        .filter((ix) => !existing.has(ix.name))
        .map((ix) => pool.query(`ALTER TABLE \`corporate_inquiry\` ADD INDEX \`${ix.name}\` (${ix.cols})`))
    );
    return true;
  });
}

// ── Public service functions ──────────────────────────────────────────────────

export async function listCorporateInquiries(
  params: CorporateInquiryListParams
): Promise<CorporateInquiryListResult> {
  const pool = getPool();
  const { page, limit, search = '', status = '' } = params;
  const offset = (page - 1) * limit;

  await ensureCorporateInquiryColumns(pool);
  await ensureCorporateIndexes(pool);

  const cacheKey = cacheKeys.corporateInquiry.list({ page, limit, search, status });
  const hit = await cache.get<CorporateInquiryListResult>(cacheKey);
  if (hit) return hit;

  const conditions: string[] = ['(IsDelete = 0 OR IsDelete IS NULL)'];
  const queryParams: any[] = [];

  if (search) {
    conditions.push(`(FullName LIKE ? OR Fname LIKE ? OR Lname LIKE ? OR Email LIKE ? OR CompanyName LIKE ?)`);
    queryParams.push(...Array(5).fill(`%${search}%`));
  }
  if (status) {
    conditions.push('InquiryStatus = ?');
    queryParams.push(status);
  }

  const where = conditions.join(' AND ');
  const dedupSql = `
    SELECT MAX(Id) AS latest_id FROM corporate_inquiry WHERE ${where}
    GROUP BY LOWER(TRIM(COALESCE(CompanyName,''))), LOWER(TRIM(COALESCE(Email,''))),
             LOWER(TRIM(COALESCE(Mobile,''))), LOWER(TRIM(COALESCE(Course_Id,''))),
             COALESCE(DATE(Idate),'1900-01-01')`;

  const [countRows] = await pool.query<any[]>(`SELECT COUNT(*) AS total FROM (${dedupSql}) dedup`, queryParams);
  const total = countRows[0]?.total ?? 0;

  const [rows] = await pool.query<any[]>(
    `SELECT c.Id, c.Fname, c.Lname, c.MName, c.FullName, c.CompanyName, c.Designation,
       c.Address, c.City, c.State, c.Country, c.Pin, c.Phone, c.Mobile, c.Email,
       c.Course_Id, c.Place, c.business, c.Remark, c.Idate, c.IsActive,
       c.Consultancy_Id, c.CompanyType, c.CompanyAuthority, c.TrainingMode,
       c.Participants_Fresher, c.Participants_Experienced, c.TrainingLocation, c.TrainingDates,
       c.Discussion, c.FollowUp, c.InitialFollowUpDate, c.NextFollowUpDate, c.InquiryStatus,
       c.DiscussionOutcome, c.TrainingNumber, c.TrainingDate, c.TrainerName, c.NumberOfDays,
       c.TotalStudents, c.TrainingCoordinator, c.ConfirmDate,
       c.PerformanceEvaluation_PreTest, c.PerformanceEvaluation_Assessment,
       c.PerformanceEvaluation_Assignment, c.PerformanceEvaluation_FinalExam,
       c.PerformanceEvaluation_TrainingMaterial, c.PerformanceEvaluation_Attendance,
       c.TrainingFeedbackObtained, c.SitCertIssuedOnPerformanceOnAttendance, c.CtTrainingEnquiryId
     FROM corporate_inquiry c
     INNER JOIN (${dedupSql}) dedup ON dedup.latest_id = c.Id
     ORDER BY c.Id DESC LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset]
  );

  const [courses] = await pool.query<any[]>(
    `SELECT Course_Id, Course_Name FROM course_mst WHERE (IsDelete=0 OR IsDelete IS NULL) ORDER BY Course_Name`
  );

  const result: CorporateInquiryListResult = { rows, courses, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  await cache.set(cacheKey, result, cacheTTL.medium);
  return result;
}

export async function patchCorporateInquiry(input: PatchCorporateInquiryInput): Promise<void> {
  const pool = getPool();
  await ensureCorporateInquiryColumns(pool);

  const { Id, PerformanceEvaluation, ...rest } = input;

  // Parse performance evaluation from JSON array if provided
  type PerfRow = { key: string; completed?: boolean; remarks?: string };
  const toEvalJson = (row?: PerfRow) =>
    row ? JSON.stringify({ completed: Boolean(row.completed), remarks: String(row.remarks||'') }) : null;

  let perfFromJson: Record<string, string | null> = {};
  if (PerformanceEvaluation && typeof PerformanceEvaluation === 'string') {
    try {
      const parsed = JSON.parse(PerformanceEvaluation) as PerfRow[];
      if (Array.isArray(parsed)) {
        const byKey = new Map(parsed.map((r) => [String((r as any).key||'').trim().toLowerCase(), r]));
        const pick = (...keys: string[]) => keys.reduce<PerfRow|undefined>((acc, k) => acc ?? byKey.get(k), undefined);
        perfFromJson = {
          PerformanceEvaluation_PreTest: toEvalJson(pick('pre_test','pretest','pre test')),
          PerformanceEvaluation_Assessment: toEvalJson(pick('assessment')),
          PerformanceEvaluation_Assignment: toEvalJson(pick('assignment')),
          PerformanceEvaluation_FinalExam: toEvalJson(pick('final_exam','finalexam','final exam','final_test')),
          PerformanceEvaluation_TrainingMaterial: toEvalJson(pick('training_material','training material','trainingmaterial')),
          PerformanceEvaluation_Attendance: toEvalJson(pick('attendance')),
        };
      }
    } catch { /* ignore invalid JSON */ }
  }

  let DiscussionOutcome: string | null | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(input, 'DiscussionOutcome')) {
    DiscussionOutcome = parseDiscussionOutcome(input.DiscussionOutcome);
  }

  const allowed: Record<string, unknown> = {
    InquiryStatus: rest.InquiryStatus,
    TrainingNumber: rest.TrainingNumber,
    TrainingDate: rest.TrainingDate,
    TrainerName: rest.TrainerName,
    NumberOfDays: toNullableInt(rest.NumberOfDays),
    TotalStudents: toNullableInt(rest.TotalStudents),
    TrainingCoordinator: rest.TrainingCoordinator,
    Discussion: rest.Discussion,
    FollowUp: rest.FollowUp,
    InitialFollowUpDate: rest.InitialFollowUpDate,
    NextFollowUpDate: rest.NextFollowUpDate,
    TrainingMode: parseTrainingMode(rest.TrainingMode),
    DiscussionOutcome,
    ConfirmDate: rest.ConfirmDate,
    PerformanceEvaluation_PreTest: rest.PerformanceEvaluation_PreTest ?? perfFromJson.PerformanceEvaluation_PreTest,
    PerformanceEvaluation_Assessment: rest.PerformanceEvaluation_Assessment ?? perfFromJson.PerformanceEvaluation_Assessment,
    PerformanceEvaluation_Assignment: rest.PerformanceEvaluation_Assignment ?? perfFromJson.PerformanceEvaluation_Assignment,
    PerformanceEvaluation_FinalExam: rest.PerformanceEvaluation_FinalExam ?? perfFromJson.PerformanceEvaluation_FinalExam,
    PerformanceEvaluation_TrainingMaterial: rest.PerformanceEvaluation_TrainingMaterial ?? perfFromJson.PerformanceEvaluation_TrainingMaterial,
    PerformanceEvaluation_Attendance: rest.PerformanceEvaluation_Attendance ?? perfFromJson.PerformanceEvaluation_Attendance,
    TrainingFeedbackObtained: rest.TrainingFeedbackObtained ?? rest.TrainingFeedback,
    SitCertIssuedOnPerformanceOnAttendance: rest.SitCertIssuedOnPerformanceOnAttendance ?? rest.SitCertification,
  };

  const setParts: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(allowed)) {
    if (value === undefined) continue;
    setParts.push(`${key} = ?`);
    values.push(value === '' ? null : typeof value === 'string' ? value.trim() : value);
  }

  if (setParts.length === 0) throw Object.assign(new Error('No fields to update'), { status: 400 });

  await pool.query(`UPDATE corporate_inquiry SET ${setParts.join(', ')} WHERE Id = ?`, [...values, Id]);
  await cache.deleteByPrefix(cacheKeys.corporateInquiry.prefix);
}

export async function createCorporateInquiry(data: CreateCorporateInquiryInput): Promise<{ insertId: number; duplicate: boolean }> {
  const pool = getPool();
  await ensureCorporateInquiryColumns(pool);

  const Fname = data.Fname;
  const FullName = String(
    (data.FullName?.trim()) || [data.Fname, data.MName, data.Lname].filter(Boolean).join(' ') || ''
  ).trim();

  const contactPerson = String(data.CompanyAuthority?.trim()||'').trim() || FullName || '';
  const Place = await normalizeToColumnLength(pool, 'corporate_inquiry', 'Place', data.Place ?? data.TrainingLocation);
  const consultancyCity = await normalizeToColumnLength(pool, 'consultant_mst', 'City', data.Place ?? data.TrainingLocation);

  let Consultancy_Id = toNullableInt(data.Consultancy_Id);
  Consultancy_Id = await resolveConsultancyId({
    pool, consultancyId: Consultancy_Id,
    companyName: data.CompanyName?.trim()||null,
    contactPerson: contactPerson||null,
    designation: data.Designation?.trim()||null,
    phone: data.Phone?.trim()||null, mobile: data.Mobile?.trim()||null,
    email: data.Email?.trim()||null, city: consultancyCity,
    companyType: data.CompanyType?.trim()||null,
    dateAdded: data.Idate?.trim()||null,
  });

  // Duplicate guard
  const [dup] = await pool.query<any[]>(
    `SELECT Id FROM corporate_inquiry
     WHERE (IsDelete=0 OR IsDelete IS NULL)
       AND LOWER(TRIM(COALESCE(CompanyName,'')))=LOWER(TRIM(COALESCE(?,'')))`
     +` AND LOWER(TRIM(COALESCE(Email,'')))=LOWER(TRIM(COALESCE(?,'')))`
     +` AND LOWER(TRIM(COALESCE(Mobile,'')))=LOWER(TRIM(COALESCE(?,'')))`
     +` AND LOWER(TRIM(COALESCE(Course_Id,'')))=LOWER(TRIM(COALESCE(?,'')))`
     +` AND COALESCE(DATE(Idate),'1900-01-01')=COALESCE(DATE(?),'1900-01-01')`
     +` ORDER BY Id DESC LIMIT 1`,
    [data.CompanyName||null, data.Email||null, data.Mobile||null, data.Course_Id||null, data.Idate||null]
  );
  if (Array.isArray(dup) && dup.length > 0) {
    return { insertId: Number(dup[0].Id), duplicate: true };
  }

  const [result] = await pool.query(
    `INSERT INTO corporate_inquiry (
       Fname,Lname,MName,FullName,CompanyName,Designation,Address,City,State,Country,Pin,
       Phone,Mobile,Email,Course_Id,Place,business,Remark,Idate,
       Consultancy_Id,CompanyType,CompanyAuthority,TrainingMode,
       Participants_Fresher,Participants_Experienced,TrainingLocation,TrainingDates,
       Discussion,FollowUp,InitialFollowUpDate,NextFollowUpDate,IsActive,IsDelete
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,COALESCE(?,CURDATE()),?,?,?,?,?,?,?,?,?,?,?,?,1,0)`,
    [(Fname??FullName)||null, data.Lname||null, data.MName||null, FullName||null,
     data.CompanyName||null, data.Designation||null, data.Address||null, data.City||null,
     data.State||null, data.Country||null, data.Pin||null, data.Phone||null, data.Mobile||null,
     data.Email||null, data.Course_Id||null, Place||null, data.business||null,
     data.Remark||data.Discussion||null, data.Idate||null,
     Consultancy_Id, data.CompanyType||null, data.CompanyAuthority||null,
     parseTrainingMode(data.TrainingMode)||null,
     toNullableInt(data.Participants_Fresher), toNullableInt(data.Participants_Experienced),
     data.TrainingLocation||null, data.TrainingDates||null, data.Discussion||null,
     typeof data.FollowUp === 'string' ? data.FollowUp : data.FollowUp ? JSON.stringify(data.FollowUp) : null,
     data.InitialFollowUpDate||null, data.NextFollowUpDate||null]
  );

  const insertId = Number((result as any).insertId || 0);

  await syncFollowups({
    pool, consultancyId: Consultancy_Id, corporateInquiryId: insertId,
    companyAuthority: data.CompanyAuthority?.trim()||null, fullName: FullName||null,
    designation: data.Designation?.trim()||null, mobile: data.Mobile?.trim()||null,
    email: data.Email?.trim()||null, followUpRaw: data.FollowUp, discussion: data.Discussion,
    initialFollowUpDate: data.InitialFollowUpDate, nextFollowUpDate: data.NextFollowUpDate,
    inquiryDate: data.Idate,
  });

  await cache.deleteByPrefix(cacheKeys.corporateInquiry.prefix);
  return { insertId, duplicate: false };
}

export async function updateCorporateInquiry(data: UpdateCorporateInquiryInput): Promise<void> {
  if (!data.Id) throw Object.assign(new Error('ID is required'), { status: 400 });

  const pool = getPool();
  await ensureCorporateInquiryColumns(pool);

  const FullName = String(
    (data.FullName?.trim()) || [data.Fname, data.MName, data.Lname].filter(Boolean).join(' ') || ''
  ).trim();
  const contactPerson = String(data.CompanyAuthority?.trim()||'').trim() || FullName || '';
  const Place = data.Place ?? data.TrainingLocation;
  const normalizedPlace = await normalizeToColumnLength(pool, 'corporate_inquiry', 'Place', Place);
  const consultancyCity = await normalizeToColumnLength(pool, 'consultant_mst', 'City', Place);

  let Consultancy_Id = toNullableInt(data.Consultancy_Id);
  Consultancy_Id = await resolveConsultancyId({
    pool, consultancyId: Consultancy_Id,
    companyName: data.CompanyName?.trim()||null, contactPerson: contactPerson||null,
    designation: data.Designation?.trim()||null, phone: data.Phone?.trim()||null,
    mobile: data.Mobile?.trim()||null, email: data.Email?.trim()||null, city: consultancyCity,
    companyType: data.CompanyType?.trim()||null, dateAdded: data.Idate?.trim()||null,
  });

  await syncFollowups({
    pool, consultancyId: Consultancy_Id, corporateInquiryId: Number(data.Id),
    companyAuthority: data.CompanyAuthority?.trim()||null, fullName: FullName||null,
    designation: data.Designation?.trim()||null, mobile: data.Mobile?.trim()||null,
    email: data.Email?.trim()||null, followUpRaw: data.FollowUp, discussion: data.Discussion,
    initialFollowUpDate: data.InitialFollowUpDate, nextFollowUpDate: data.NextFollowUpDate,
    inquiryDate: data.Idate,
  });

  await pool.query(
    `UPDATE corporate_inquiry SET
       Fname=?,Lname=?,MName=?,FullName=?,CompanyName=?,Designation=?,
       Address=?,City=?,State=?,Country=?,Pin=?,Phone=?,Mobile=?,
       Email=?,Course_Id=?,Place=?,business=?,Remark=?,Idate=?,
       Consultancy_Id=?,CompanyType=?,CompanyAuthority=?,TrainingMode=?,
       Participants_Fresher=?,Participants_Experienced=?,TrainingLocation=?,TrainingDates=?,
       Discussion=?,FollowUp=?,InitialFollowUpDate=?,NextFollowUpDate=?,
       InquiryStatus=?,TrainingNumber=?,TrainingDate=?,TrainerName=?,
       NumberOfDays=?,TotalStudents=?,TrainingCoordinator=?,DiscussionOutcome=?
     WHERE Id=?`,
    [(data.Fname??FullName)||null, data.Lname||null, data.MName||null, FullName||null,
     data.CompanyName||null, data.Designation||null, data.Address||null, data.City||null,
     data.State||null, data.Country||null, data.Pin||null, data.Phone||null, data.Mobile||null,
     data.Email||null, data.Course_Id||null, normalizedPlace||null, data.business||null,
     data.Remark||data.Discussion||null, data.Idate||null, Consultancy_Id,
     data.CompanyType||null, data.CompanyAuthority||null, parseTrainingMode(data.TrainingMode)||null,
     toNullableInt(data.Participants_Fresher), toNullableInt(data.Participants_Experienced),
     data.TrainingLocation||null, data.TrainingDates||null, data.Discussion||null,
     typeof data.FollowUp === 'string' ? data.FollowUp : data.FollowUp ? JSON.stringify(data.FollowUp) : null,
     data.InitialFollowUpDate||null, data.NextFollowUpDate||null,
     data.InquiryStatus||null, data.TrainingNumber||null, data.TrainingDate||null,
     data.TrainerName||null, toNullableInt(data.NumberOfDays), toNullableInt(data.TotalStudents),
     data.TrainingCoordinator||null, data.DiscussionOutcome||null, data.Id]
  );

  await cache.deleteByPrefix(cacheKeys.corporateInquiry.prefix);
}

export async function deleteCorporateInquiry(id: number): Promise<void> {
  const pool = getPool();
  await pool.query(`UPDATE corporate_inquiry SET IsDelete=1 WHERE Id=?`, [id]);
  await cache.deleteByPrefix(cacheKeys.corporateInquiry.prefix);
}
