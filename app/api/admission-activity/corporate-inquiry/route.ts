/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { cache, cacheKeys, cacheTTL } from '@/lib/cache';
import { requirePermission } from '@/lib/api-auth';
import { logTableActivity } from '@/lib/activity-log';

async function ensureConsultancyCompanyTypeColumn(pool: ReturnType<typeof getPool>) {
  const [rows] = await pool.query<any[]>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'consultant_mst'
       AND COLUMN_NAME = 'Company_Type'`
  );

  const cnt = rows?.[0]?.cnt ?? 0;
  if (cnt === 0) {
    await pool.query(`ALTER TABLE consultant_mst ADD COLUMN Company_Type VARCHAR(20) NULL`);
  }
}

async function getOrCreateConsultancyFromInquiry(opts: {
  pool: ReturnType<typeof getPool>;
  companyName: string;
  contactPerson?: string | null;
  designation?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  city?: string | null;
  companyType?: string | null;
  dateAdded?: string | null;
}): Promise<number> {
  const name = (opts.companyName || '').trim();
  if (!name) throw new Error('CompanyName is required to create consultancy');

  await ensureConsultancyCompanyTypeColumn(opts.pool);

  const [existing] = await opts.pool.query<any[]>(
    `SELECT Const_Id
     FROM consultant_mst
     WHERE (IsDelete = 0 OR IsDelete IS NULL)
       AND LOWER(TRIM(Comp_Name)) = LOWER(TRIM(?))
     LIMIT 1`,
    [name]
  );

  const existingId = existing?.[0]?.Const_Id ? Number(existing[0].Const_Id) : null;
  if (existingId) {
    // Only fill blanks; do not overwrite existing master data.
    await opts.pool.query(
      `UPDATE consultant_mst SET
         Contact_Person = CASE WHEN (Contact_Person IS NULL OR TRIM(Contact_Person) = '') THEN ? ELSE Contact_Person END,
         Designation = CASE WHEN (Designation IS NULL OR TRIM(Designation) = '') THEN ? ELSE Designation END,
         Tel = CASE WHEN (Tel IS NULL OR TRIM(Tel) = '') THEN ? ELSE Tel END,
         Mobile = CASE WHEN (Mobile IS NULL OR TRIM(Mobile) = '') THEN ? ELSE Mobile END,
         EMail = CASE WHEN (EMail IS NULL OR TRIM(EMail) = '') THEN ? ELSE EMail END,
         City = CASE WHEN (City IS NULL OR TRIM(City) = '') THEN ? ELSE City END,
         Company_Type = CASE WHEN (Company_Type IS NULL OR TRIM(Company_Type) = '') THEN ? ELSE Company_Type END,
         Date_Added = CASE WHEN Date_Added IS NULL THEN ? ELSE Date_Added END
       WHERE Const_Id = ?`,
      [
        opts.contactPerson || null,
        opts.designation || null,
        opts.phone || null,
        opts.mobile || null,
        opts.email || null,
        opts.city || null,
        opts.companyType || null,
        opts.dateAdded || null,
        existingId,
      ]
    );
    return existingId;
  }

  // Create a minimal master record.
  // Keep Address as empty string to satisfy potential NOT NULL constraints.
  const [result] = await opts.pool.query<any>(
    `INSERT INTO consultant_mst (
      Comp_Name, Contact_Person, Designation, Address, City, Tel,
      Mobile, EMail, Date_Added, Company_Type,
      IsActive, IsDelete
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
    [
      name,
      opts.contactPerson || null,
      opts.designation || null,
      '',
      opts.city || null,
      opts.phone || null,
      opts.mobile || null,
      opts.email || null,
      opts.dateAdded || null,
      opts.companyType || null,
    ]
  );

  return Number(result.insertId);
}

async function consultancyExists(pool: ReturnType<typeof getPool>, consultancyId: number): Promise<boolean> {
  if (!Number.isFinite(consultancyId) || consultancyId <= 0) return false;
  const [rows] = await pool.query<any[]>(
    `SELECT 1
     FROM consultant_mst
     WHERE Const_Id = ?
       AND (IsDelete = 0 OR IsDelete IS NULL)
     LIMIT 1`,
    [consultancyId]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function resolveConsultancyIdForInquiry(opts: {
  pool: ReturnType<typeof getPool>;
  consultancyId?: number | null;
  companyName?: string | null;
  contactPerson?: string | null;
  designation?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  city?: string | null;
  companyType?: string | null;
  dateAdded?: string | null;
}): Promise<number | null> {
  const id = Number(opts.consultancyId);
  if (Number.isFinite(id) && id > 0) {
    const exists = await consultancyExists(opts.pool, id);
    if (exists) return id;
  }

  const name = String(opts.companyName || '').trim();
  if (!name) return null;

  return getOrCreateConsultancyFromInquiry({
    pool: opts.pool,
    companyName: name,
    contactPerson: opts.contactPerson || null,
    designation: opts.designation || null,
    phone: opts.phone || null,
    mobile: opts.mobile || null,
    email: opts.email || null,
    city: opts.city || null,
    companyType: opts.companyType || null,
    dateAdded: opts.dateAdded || null,
  });
}

function normalizeDateOnly(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;

  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  const mdy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1]}-${mdy[2]}`;

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

const columnLengthCache = new Map<string, Promise<number | null>>();

async function getColumnMaxLength(
  pool: ReturnType<typeof getPool>,
  tableName: string,
  columnName: string
): Promise<number | null> {
  const cacheKey = `${tableName}.${columnName}`;
  const cached = columnLengthCache.get(cacheKey);
  if (cached) return cached;

  const query = (async () => {
    try {
      const [rows] = await pool.query<any[]>(
        `SELECT CHARACTER_MAXIMUM_LENGTH AS max_len
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [tableName, columnName]
      );
      const maxLen = Number(rows?.[0]?.max_len);
      return Number.isFinite(maxLen) && maxLen > 0 ? maxLen : null;
    } catch {
      return null;
    }
  })();

  columnLengthCache.set(cacheKey, query);
  return query;
}

async function normalizeToColumnLength(
  pool: ReturnType<typeof getPool>,
  tableName: string,
  columnName: string,
  value: unknown
): Promise<string | null> {
  const raw = value === null || value === undefined ? '' : String(value).trim();
  if (!raw) return null;
  const maxLen = await getColumnMaxLength(pool, tableName, columnName);
  if (!maxLen || raw.length <= maxLen) return raw;
  return raw.slice(0, maxLen);
}

async function ensureConsultancyFollowupTable(pool: ReturnType<typeof getPool>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS consultant_followup (
      Followup_Id INT AUTO_INCREMENT PRIMARY KEY,
      Const_Id INT NOT NULL,
      Followup_Date DATE,
      Contact_Person VARCHAR(255),
      Designation VARCHAR(255),
      Mobile VARCHAR(50),
      email VARCHAR(255),
      Purpose VARCHAR(255),
      Course VARCHAR(255),
      Direct_Line VARCHAR(100),
      Remarks TEXT,
      Added_By INT,
      Source_Inquiry_Id INT NULL,
      IsDelete TINYINT DEFAULT 0,
      Date_Added DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_const_id (Const_Id),
      INDEX idx_source_inquiry (Source_Inquiry_Id)
    )
  `);

  const [rows] = await pool.query<any[]>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'consultant_followup'
       AND COLUMN_NAME = 'Source_Inquiry_Id'`
  );
  const cnt = rows?.[0]?.cnt ?? 0;
  if (cnt === 0) {
    await pool.query(`ALTER TABLE consultant_followup ADD COLUMN Source_Inquiry_Id INT NULL`);
    await pool.query(`ALTER TABLE consultant_followup ADD INDEX idx_source_inquiry (Source_Inquiry_Id)`);
  }
}

type CorporateFollowupCandidate = {
  followupDate: string | null;
  nextFollowupDate?: string | null;
  contactPerson?: string | null;
  designation?: string | null;
  mobile?: string | null;
  email?: string | null;
  purpose: string | null;
  course?: string | null;
  directLine?: string | null;
  remarks: string | null;
};

function extractCorporateFollowupCandidates(opts: {
  followUpRaw?: unknown;
  discussion?: unknown;
  initialFollowUpDate?: unknown;
  nextFollowUpDate?: unknown;
  inquiryDate?: unknown;
}): CorporateFollowupCandidate[] {
  const out: CorporateFollowupCandidate[] = [];

  const pushCandidate = (entry: CorporateFollowupCandidate) => {
    const remarks = String(entry.remarks || '').trim();
    const purpose = String(entry.purpose || '').trim();
    const followupDate = normalizeDateOnly(entry.followupDate) || normalizeDateOnly(entry.nextFollowupDate) || null;
    const contactPerson = String(entry.contactPerson || '').trim();
    const designation = String(entry.designation || '').trim();
    const mobile = String(entry.mobile || '').trim();
    const email = String(entry.email || '').trim();
    const course = String(entry.course || '').trim();
    const directLine = String(entry.directLine || '').trim();

    if (!remarks && !purpose && !followupDate && !contactPerson && !designation && !mobile && !email && !course && !directLine) return;
    out.push({
      followupDate,
      nextFollowupDate: normalizeDateOnly(entry.nextFollowupDate),
      contactPerson: contactPerson || null,
      designation: designation || null,
      mobile: mobile || null,
      email: email || null,
      purpose: purpose || null,
      course: course || null,
      directLine: directLine || null,
      remarks: remarks || null,
    });
  };

  const fallbackDate =
    normalizeDateOnly(opts.nextFollowUpDate)
    || normalizeDateOnly(opts.initialFollowUpDate)
    || normalizeDateOnly(opts.inquiryDate)
    || null;

  const followUpRaw = String(opts.followUpRaw || '').trim();
  if (followUpRaw) {
    try {
      const parsed = JSON.parse(followUpRaw) as any;
      const meetings = Array.isArray(parsed?.followUps)
        ? parsed.followUps
        : Array.isArray(parsed?.meetings)
          ? parsed.meetings
          : [];

      for (const m of meetings) {
        if (!m || typeof m !== 'object') continue;
        pushCandidate({
          followupDate: m.date || m.followupDate || m.follow_up_date || m.meetingDate || fallbackDate,
          nextFollowupDate: m.nextDate || m.nextFollowUpDate || m.next_follow_up_date || null,
          contactPerson: m.contactPerson || m.fullName || m.attendeeClient || null,
          designation: m.designation || m.jobTitle || null,
          mobile: normalizeMultiText(m.mobile ?? m.phoneNumber ?? m.phoneNumbers),
          email: normalizeMultiText(m.email ?? m.emails),
          purpose: m.purpose || 'Corporate Inquiry Follow-up',
          course: m.course || m.trainingProgramme || null,
          directLine: normalizeMultiText(m.directLine ?? m.alternateNumber ?? m.alternateNumbers),
          remarks: m.remark || m.remarks || m.meetingAgenda || parsed?.meetingAgenda || null,
        });
      }

      const contacts = Array.isArray(parsed?.contacts) ? parsed.contacts : [];
      for (const c of contacts) {
        if (!c || typeof c !== 'object') continue;
        pushCandidate({
          followupDate: fallbackDate,
          contactPerson: c.fullName || null,
          designation: c.jobTitle || null,
          mobile: normalizeMultiText(c.phoneNumber ?? c.phoneNumbers),
          email: normalizeMultiText(c.email ?? c.emails),
          directLine: normalizeMultiText(c.alternateNumber ?? c.alternateNumbers),
          purpose: 'Corporate Inquiry Follow-up',
          remarks: c.discussion || null,
        });
      }

      if (meetings.length === 0 && parsed?.meetingAgenda) {
        pushCandidate({
          followupDate: parsed?.meetingDate || parsed?.initialDate || fallbackDate,
          purpose: 'Corporate Inquiry Follow-up',
          remarks: parsed?.meetingAgenda,
        });
      }
    } catch {
      pushCandidate({
        followupDate: fallbackDate,
        purpose: 'Corporate Inquiry Follow-up',
        remarks: followUpRaw,
      });
    }
  }

  const dedup = new Map<string, CorporateFollowupCandidate>();
  for (const item of out) {
    const k = `${item.followupDate || ''}|${String(item.contactPerson || '').toLowerCase()}|${String(item.mobile || '').toLowerCase()}|${String(item.email || '').toLowerCase()}|${String(item.purpose || '').toLowerCase()}|${String(item.course || '').toLowerCase()}|${String(item.directLine || '').toLowerCase()}|${String(item.remarks || '').toLowerCase()}`;
    if (!dedup.has(k)) dedup.set(k, item);
  }
  return Array.from(dedup.values());
}

async function syncConsultancyFollowupsFromCorporate(opts: {
  pool: ReturnType<typeof getPool>;
  consultancyId: number | null;
  corporateInquiryId?: number | null;
  companyAuthority?: string | null;
  fullName?: string | null;
  designation?: string | null;
  mobile?: string | null;
  email?: string | null;
  followUpRaw?: unknown;
  discussion?: unknown;
  initialFollowUpDate?: unknown;
  nextFollowUpDate?: unknown;
  inquiryDate?: unknown;
}) {
  if (!opts.consultancyId) return;

  const candidates = extractCorporateFollowupCandidates({
    followUpRaw: opts.followUpRaw,
    discussion: opts.discussion,
    initialFollowUpDate: opts.initialFollowUpDate,
    nextFollowUpDate: opts.nextFollowUpDate,
    inquiryDate: opts.inquiryDate,
  });

  if (candidates.length === 0) {
    return;
  }

  await ensureConsultancyFollowupTable(opts.pool);

  const contactPerson = String((opts.companyAuthority && String(opts.companyAuthority).trim()) || '').trim()
    || String((opts.fullName && String(opts.fullName).trim()) || '').trim()
    || null;

  const corporateInquiryId = Number(opts.corporateInquiryId);
  const sourceInquiryId = Number.isFinite(corporateInquiryId) && corporateInquiryId > 0 ? corporateInquiryId : null;

  if (sourceInquiryId !== null) {
    await opts.pool.query(
      `DELETE FROM consultant_followup
       WHERE Const_Id = ? AND Source_Inquiry_Id = ?`,
      [opts.consultancyId, sourceInquiryId]
    );
  }

  for (const c of candidates) {
    let exists: any[] = [];
    if (sourceInquiryId === null) {
      const [legacyExists] = await opts.pool.query<any[]>(
        `SELECT Followup_Id
         FROM consultant_followup
         WHERE Const_Id = ?
           AND COALESCE(Followup_Date, '1900-01-01') = COALESCE(?, '1900-01-01')
           AND LOWER(TRIM(COALESCE(Contact_Person, ''))) = LOWER(TRIM(COALESCE(?, '')))
           AND LOWER(TRIM(COALESCE(Designation, ''))) = LOWER(TRIM(COALESCE(?, '')))
           AND LOWER(TRIM(COALESCE(Mobile, ''))) = LOWER(TRIM(COALESCE(?, '')))
           AND LOWER(TRIM(COALESCE(email, ''))) = LOWER(TRIM(COALESCE(?, '')))
           AND LOWER(TRIM(COALESCE(Purpose, ''))) = LOWER(TRIM(COALESCE(?, '')))
           AND LOWER(TRIM(COALESCE(Course, ''))) = LOWER(TRIM(COALESCE(?, '')))
           AND LOWER(TRIM(COALESCE(Direct_Line, ''))) = LOWER(TRIM(COALESCE(?, '')))
           AND LOWER(TRIM(COALESCE(Remarks, ''))) = LOWER(TRIM(COALESCE(?, '')))
           AND (IsDelete = 0 OR IsDelete IS NULL)
         LIMIT 1`,
        [
          opts.consultancyId,
          c.followupDate,
          c.contactPerson,
          c.designation,
          c.mobile,
          c.email,
          c.purpose,
          c.course,
          c.directLine,
          c.remarks,
        ]
      );
      exists = legacyExists;
    }

    if (Array.isArray(exists) && exists.length > 0) continue;

    await opts.pool.query(
      `INSERT INTO consultant_followup
        (Const_Id, Followup_Date, Contact_Person, Designation, Mobile, email, Purpose, Course, Direct_Line, Remarks, Added_By, Source_Inquiry_Id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        opts.consultancyId,
        c.followupDate,
        c.contactPerson || contactPerson,
        c.designation || (opts.designation && String(opts.designation).trim()) || null,
        c.mobile || (opts.mobile && String(opts.mobile).trim()) || null,
        c.email || (opts.email && String(opts.email).trim()) || null,
        c.purpose,
        c.course || null,
        c.directLine || null,
        c.remarks,
        sourceInquiryId,
      ]
    );
  }
}

async function ensureCorporateInquiryColumns(pool: ReturnType<typeof getPool>) {
  const wanted = [
    'Consultancy_Id',
    'CompanyType',
    'CompanyAuthority',
    'TrainingMode',
    'Participants_Fresher',
    'Participants_Experienced',
    'TrainingLocation',
    'TrainingDates',
    'Discussion',
    'FollowUp',
    'InitialFollowUpDate',
    'NextFollowUpDate',

    'InquiryStatus',
    'TrainingNumber',
    'TrainingDate',
    'TrainerName',
    'NumberOfDays',
    'TotalStudents',
    'TrainingCoordinator',

    'DiscussionOutcome',

    'ConfirmDate',
    'PerformanceEvaluation_PreTest',
    'PerformanceEvaluation_Assessment',
    'PerformanceEvaluation_Assignment',
    'PerformanceEvaluation_FinalExam',
    'PerformanceEvaluation_TrainingMaterial',
    'PerformanceEvaluation_Attendance',
    'TrainingFeedbackObtained',
    'SitCertIssuedOnPerformanceOnAttendance',
  ] as const;

  const [rows] = await pool.query<any[]>(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'corporate_inquiry'
       AND COLUMN_NAME IN (${wanted.map(() => '?').join(',')})`,
    [...wanted]
  );

  const existing = new Set((rows || []).map((r: any) => String(r?.COLUMN_NAME || '')));

  const alters: string[] = [];
  if (!existing.has('Consultancy_Id')) alters.push(`ADD COLUMN Consultancy_Id INT NULL`);
  if (!existing.has('CompanyType')) alters.push(`ADD COLUMN CompanyType VARCHAR(20) NULL`);
  if (!existing.has('CompanyAuthority')) alters.push(`ADD COLUMN CompanyAuthority VARCHAR(255) NULL`);
  if (!existing.has('TrainingMode')) alters.push(`ADD COLUMN TrainingMode VARCHAR(20) NULL`);
  if (!existing.has('Participants_Fresher')) alters.push(`ADD COLUMN Participants_Fresher INT NULL`);
  if (!existing.has('Participants_Experienced')) alters.push(`ADD COLUMN Participants_Experienced INT NULL`);
  if (!existing.has('TrainingLocation')) alters.push(`ADD COLUMN TrainingLocation VARCHAR(255) NULL`);
  if (!existing.has('TrainingDates')) alters.push(`ADD COLUMN TrainingDates TEXT NULL`);
  if (!existing.has('Discussion')) alters.push(`ADD COLUMN Discussion TEXT NULL`);
  if (!existing.has('FollowUp')) alters.push(`ADD COLUMN FollowUp TEXT NULL`);
  if (!existing.has('InitialFollowUpDate')) alters.push(`ADD COLUMN InitialFollowUpDate DATE NULL`);
  if (!existing.has('NextFollowUpDate')) alters.push(`ADD COLUMN NextFollowUpDate DATE NULL`);

  if (!existing.has('InquiryStatus')) alters.push(`ADD COLUMN InquiryStatus VARCHAR(20) NULL`);
  if (!existing.has('TrainingNumber')) alters.push(`ADD COLUMN TrainingNumber VARCHAR(50) NULL`);
  if (!existing.has('TrainingDate')) alters.push(`ADD COLUMN TrainingDate DATE NULL`);
  if (!existing.has('TrainerName')) alters.push(`ADD COLUMN TrainerName VARCHAR(255) NULL`);
  if (!existing.has('NumberOfDays')) alters.push(`ADD COLUMN NumberOfDays INT NULL`);
  if (!existing.has('TotalStudents')) alters.push(`ADD COLUMN TotalStudents INT NULL`);
  if (!existing.has('TrainingCoordinator')) alters.push(`ADD COLUMN TrainingCoordinator VARCHAR(255) NULL`);

  if (!existing.has('DiscussionOutcome')) alters.push(`ADD COLUMN DiscussionOutcome VARCHAR(20) NULL`);

  if (!existing.has('ConfirmDate')) alters.push(`ADD COLUMN ConfirmDate DATE NULL`);
  if (!existing.has('PerformanceEvaluation_PreTest')) alters.push(`ADD COLUMN PerformanceEvaluation_PreTest TEXT NULL`);
  if (!existing.has('PerformanceEvaluation_Assessment')) alters.push(`ADD COLUMN PerformanceEvaluation_Assessment TEXT NULL`);
  if (!existing.has('PerformanceEvaluation_Assignment')) alters.push(`ADD COLUMN PerformanceEvaluation_Assignment TEXT NULL`);
  if (!existing.has('PerformanceEvaluation_FinalExam')) alters.push(`ADD COLUMN PerformanceEvaluation_FinalExam TEXT NULL`);
  if (!existing.has('PerformanceEvaluation_TrainingMaterial')) alters.push(`ADD COLUMN PerformanceEvaluation_TrainingMaterial TEXT NULL`);
  if (!existing.has('PerformanceEvaluation_Attendance')) alters.push(`ADD COLUMN PerformanceEvaluation_Attendance TEXT NULL`);
  if (!existing.has('TrainingFeedbackObtained')) alters.push(`ADD COLUMN TrainingFeedbackObtained TEXT NULL`);
  if (!existing.has('SitCertIssuedOnPerformanceOnAttendance')) alters.push(`ADD COLUMN SitCertIssuedOnPerformanceOnAttendance TEXT NULL`);

  for (const alter of alters) {
    // Run each ALTER separately to keep failure surface small.
    await pool.query(`ALTER TABLE corporate_inquiry ${alter}`);
  }
}

function parseDiscussionOutcome(value: unknown): 'Awarded' | 'Regretted' | 'On Hold' | null {
  if (value === null || value === undefined || value === '') return null;
  const v = String(value).trim();
  const l = v.toLowerCase();
  if (l === 'awarded') return 'Awarded';
  if (l === 'regretted') return 'Regretted';
  if (l === 'on hold' || l === 'onhold' || l === 'hold') return 'On Hold';
  throw new Error('Invalid DiscussionOutcome. Allowed: Awarded, Regretted, On Hold');
}

function parseTrainingMode(value: unknown): 'online' | 'offline' | 'both online and offline' | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim().toLowerCase();
  if (raw === 'online') return 'online';
  if (raw === 'offline') return 'offline';
  if (raw === 'both online and offline' || raw === 'both' || raw === 'online and offline') {
    return 'both online and offline';
  }
  throw new Error('Invalid TrainingMode. Allowed: online, offline, both online and offline');
}

function toNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i >= 0 ? i : null;
}

// GET - fetch all corporate inquiries with pagination and search
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    await ensureCorporateInquiryColumns(pool);
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';

    // Check cache first
    const cacheKey = cacheKeys.corporateInquiry.list({ page, limit, search, status });
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT' }
      });
    }

    // Build WHERE clause
    const conditions: string[] = ['(IsDelete = 0 OR IsDelete IS NULL)'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`(FullName LIKE ? OR Fname LIKE ? OR Lname LIKE ? OR Email LIKE ? OR CompanyName LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      conditions.push(`InquiryStatus = ?`);
      params.push(status);
    }

    const where = conditions.join(' AND ');

    // Deduplicate by core inquiry signature and keep latest row per signature.
    // This fixes accidental duplicate submissions while preserving the latest edit.
    const dedupGroupSql = `
      SELECT
        MAX(Id) AS latest_id
      FROM corporate_inquiry
      WHERE ${where}
      GROUP BY
        LOWER(TRIM(COALESCE(CompanyName, ''))),
        LOWER(TRIM(COALESCE(Email, ''))),
        LOWER(TRIM(COALESCE(Mobile, ''))),
        LOWER(TRIM(COALESCE(Course_Id, ''))),
        COALESCE(DATE(Idate), '1900-01-01')
    `;

    // Count deduplicated rows
    const countSql = `SELECT COUNT(*) AS total FROM (${dedupGroupSql}) dedup`;
    const [countRows] = await pool.query<any[]>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    // Data (latest representative row per dedup group)
    const dataSql = `
      SELECT
        c.Id, c.Fname, c.Lname, c.MName, c.FullName, c.CompanyName, c.Designation,
        c.Address, c.City, c.State, c.Country, c.Pin,
        c.Phone, c.Mobile, c.Email,
        c.Course_Id,
        c.Place, c.business,
        c.Remark, c.Idate, c.IsActive,

        c.Consultancy_Id,
        c.CompanyType,
        c.CompanyAuthority,
        c.TrainingMode, c.Participants_Fresher, c.Participants_Experienced,
        c.TrainingLocation,
        c.TrainingDates,
        c.Discussion,
        c.FollowUp, c.InitialFollowUpDate, c.NextFollowUpDate,

        c.InquiryStatus,
        c.DiscussionOutcome,
        c.TrainingNumber, c.TrainingDate, c.TrainerName, c.NumberOfDays, c.TotalStudents, c.TrainingCoordinator,

        c.ConfirmDate,
        c.PerformanceEvaluation_PreTest, c.PerformanceEvaluation_Assessment, c.PerformanceEvaluation_Assignment,
        c.PerformanceEvaluation_FinalExam, c.PerformanceEvaluation_TrainingMaterial, c.PerformanceEvaluation_Attendance,
        c.TrainingFeedbackObtained,
        c.SitCertIssuedOnPerformanceOnAttendance,
        c.CtTrainingEnquiryId
      FROM corporate_inquiry c
      INNER JOIN (
        ${dedupGroupSql}
      ) dedup ON dedup.latest_id = c.Id
      ORDER BY c.Id DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query<any[]>(dataSql, [...params, limit, offset]);

    // Get courses for reference
    const [courses] = await pool.query<any[]>(`
      SELECT Course_Id, Course_Name FROM course_mst 
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
      ORDER BY Course_Name
    `);

    const responseData = {
      rows,
      courses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Store in cache for future requests
    await cache.set(cacheKey, responseData, cacheTTL.medium);

    return NextResponse.json(responseData, {
      headers: { 'X-Cache': 'MISS' }
    });
  } catch (err: unknown) {
    console.error('Corporate Inquiry API error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - partial update (status/training fields)
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    await ensureCorporateInquiryColumns(pool);

    const Id = body?.Id;
    if (!Id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    let DiscussionOutcome: 'Awarded' | 'Regretted' | 'On Hold' | null | undefined = undefined;
    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'DiscussionOutcome')) {
      DiscussionOutcome = parseDiscussionOutcome(body?.DiscussionOutcome);
    }

    type PerfEvalRow = {
      key: string;
      completed?: boolean;
      remarks?: string;
    };

    const toEvalJson = (row?: PerfEvalRow): string | null => {
      if (!row) return null;
      return JSON.stringify({
        completed: Boolean(row.completed),
        remarks: typeof row.remarks === 'string' ? row.remarks : '',
      });
    };

    const getPerformanceEvaluationColumnsFromJson = (value: unknown) => {
      if (value === null || value === undefined || value === '') return {} as Record<string, never>;
      if (typeof value !== 'string') return {} as Record<string, never>;
      try {
        const parsed = JSON.parse(value) as PerfEvalRow[];
        if (!Array.isArray(parsed)) return {} as Record<string, never>;

        const byKey = new Map<string, PerfEvalRow>();
        for (const r of parsed) {
          if (!r || typeof r !== 'object') continue;
          const k = String((r as any).key || '').trim();
          if (!k) continue;
          byKey.set(k.toLowerCase(), r);
        }

        const pick = (...keys: string[]) => {
          for (const k of keys) {
            const found = byKey.get(k.toLowerCase());
            if (found) return found;
          }
          return undefined;
        };

        return {
          PerformanceEvaluation_PreTest: toEvalJson(pick('pre_test', 'pretest', 'pre test')),
          PerformanceEvaluation_Assessment: toEvalJson(pick('assessment')),
          PerformanceEvaluation_Assignment: toEvalJson(pick('assignment')),
          PerformanceEvaluation_FinalExam: toEvalJson(pick('final_exam', 'finalexam', 'final exam', 'final_test', 'finaltest', 'final test')),
          PerformanceEvaluation_TrainingMaterial: toEvalJson(pick('training_material', 'training material', 'trainingmaterial')),
          PerformanceEvaluation_Attendance: toEvalJson(pick('attendance')),
        } as const;
      } catch {
        return {} as Record<string, never>;
      }
    };

    const trainingFeedbackObtained = body?.TrainingFeedbackObtained ?? body?.TrainingFeedback;
    const sitCertIssuedOnPerformanceOnAttendance = body?.SitCertIssuedOnPerformanceOnAttendance ?? body?.SitCertification;

    const perfFromJson = getPerformanceEvaluationColumnsFromJson(body?.PerformanceEvaluation);

    const allowed = {
      InquiryStatus: body?.InquiryStatus,
      TrainingNumber: body?.TrainingNumber,
      TrainingDate: body?.TrainingDate,
      TrainerName: body?.TrainerName,
      NumberOfDays: toNullableInt(body?.NumberOfDays),
      TotalStudents: toNullableInt(body?.TotalStudents),
      TrainingCoordinator: body?.TrainingCoordinator,

      Discussion: body?.Discussion,
      FollowUp: body?.FollowUp,
      InitialFollowUpDate: body?.InitialFollowUpDate,
      NextFollowUpDate: body?.NextFollowUpDate,
      TrainingMode: parseTrainingMode(body?.TrainingMode),

      DiscussionOutcome,

      ConfirmDate: body?.ConfirmDate,
      PerformanceEvaluation_PreTest: body?.PerformanceEvaluation_PreTest ?? perfFromJson.PerformanceEvaluation_PreTest,
      PerformanceEvaluation_Assessment: body?.PerformanceEvaluation_Assessment ?? perfFromJson.PerformanceEvaluation_Assessment,
      PerformanceEvaluation_Assignment: body?.PerformanceEvaluation_Assignment ?? perfFromJson.PerformanceEvaluation_Assignment,
      PerformanceEvaluation_FinalExam: body?.PerformanceEvaluation_FinalExam ?? perfFromJson.PerformanceEvaluation_FinalExam,
      PerformanceEvaluation_TrainingMaterial: body?.PerformanceEvaluation_TrainingMaterial ?? perfFromJson.PerformanceEvaluation_TrainingMaterial,
      PerformanceEvaluation_Attendance: body?.PerformanceEvaluation_Attendance ?? perfFromJson.PerformanceEvaluation_Attendance,
      TrainingFeedbackObtained: trainingFeedbackObtained,
      SitCertIssuedOnPerformanceOnAttendance: sitCertIssuedOnPerformanceOnAttendance,
    } as const;

    const setParts: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(allowed)) {
      if (value === undefined) continue;
      setParts.push(`${key} = ?`);
      if (value === '') values.push(null);
      else values.push(typeof value === 'string' ? value.trim() : value);
    }

    if (setParts.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await pool.query(
      `UPDATE corporate_inquiry SET ${setParts.join(', ')} WHERE Id = ?`,
      [...values, Id]
    );

    await cache.deleteByPrefix(cacheKeys.corporateInquiry.prefix);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Corporate Inquiry PATCH error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - add new corporate inquiry
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    await ensureCorporateInquiryColumns(pool);

    // Backwards-compatible input support
    const Fname = body?.Fname;
    const MName = body?.MName;
    const Lname = body?.Lname;
    const FullNameRaw = body?.FullName;
    const FullName = String(
      (FullNameRaw && String(FullNameRaw).trim()) || [Fname, MName, Lname].filter(Boolean).join(' ') || ''
    ).trim();

    const CompanyName = body?.CompanyName;
    const Designation = body?.Designation;
    const Phone = body?.Phone;
    const Mobile = body?.Mobile;
    const Email = body?.Email;
    const Course_Id = body?.Course_Id;

    let Consultancy_Id = toNullableInt(body?.Consultancy_Id);
    const CompanyType = body?.CompanyType;
    const CompanyAuthority = body?.CompanyAuthority;
    const TrainingMode = parseTrainingMode(body?.TrainingMode);
    const Participants_Fresher = toNullableInt(body?.Participants_Fresher);
    const Participants_Experienced = toNullableInt(body?.Participants_Experienced);
    const TrainingLocation = body?.TrainingLocation;
    const TrainingDates = body?.TrainingDates;
    const Discussion = body?.Discussion;
    const FollowUp = body?.FollowUp;
    const InitialFollowUpDate = body?.InitialFollowUpDate;
    const NextFollowUpDate = body?.NextFollowUpDate;

    // Keep legacy columns populated where it makes sense.
    // `Place` is treated as Company Location; older clients may only send TrainingLocation.
    const Place = await normalizeToColumnLength(pool, 'corporate_inquiry', 'Place', body?.Place ?? TrainingLocation);
    const consultancyCity = await normalizeToColumnLength(pool, 'consultant_mst', 'City', body?.Place ?? TrainingLocation);
    const Remark = body?.Remark ?? Discussion;

    const Idate = body?.Idate;

    const contactPerson = String((CompanyAuthority && String(CompanyAuthority).trim()) || '').trim()
      || String((FullName && String(FullName).trim()) || '').trim()
      || '';

    Consultancy_Id = await resolveConsultancyIdForInquiry({
      pool,
      consultancyId: Consultancy_Id,
      companyName: (CompanyName && String(CompanyName).trim()) || null,
      contactPerson: contactPerson || null,
      designation: (Designation && String(Designation).trim()) || null,
      phone: (Phone && String(Phone).trim()) || null,
      mobile: (Mobile && String(Mobile).trim()) || null,
      email: (Email && String(Email).trim()) || null,
      city: consultancyCity,
      companyType: (CompanyType && String(CompanyType).trim()) || null,
      dateAdded: (Idate && String(Idate).trim()) || null,
    });

    // Prevent accidental duplicates from rapid double-submit or repeated same payload.
    const [existingDup] = await pool.query<any[]>(
      `SELECT Id
       FROM corporate_inquiry
       WHERE (IsDelete = 0 OR IsDelete IS NULL)
         AND LOWER(TRIM(COALESCE(CompanyName, ''))) = LOWER(TRIM(COALESCE(?, '')))
         AND LOWER(TRIM(COALESCE(Email, ''))) = LOWER(TRIM(COALESCE(?, '')))
         AND LOWER(TRIM(COALESCE(Mobile, ''))) = LOWER(TRIM(COALESCE(?, '')))
         AND LOWER(TRIM(COALESCE(Course_Id, ''))) = LOWER(TRIM(COALESCE(?, '')))
         AND COALESCE(DATE(Idate), '1900-01-01') = COALESCE(DATE(?), '1900-01-01')
       ORDER BY Id DESC
       LIMIT 1`,
      [CompanyName || null, Email || null, Mobile || null, Course_Id || null, Idate || null]
    );
    if (Array.isArray(existingDup) && existingDup.length > 0) {
      return NextResponse.json({ success: true, insertId: Number(existingDup[0].Id), duplicate: true });
    }

    const [result] = await pool.query(
      `INSERT INTO corporate_inquiry (
        Fname, Lname, MName, FullName, CompanyName, Designation, Address, City, State,
        Country, Pin, Phone, Mobile, Email, Course_Id, Place, business, Remark, Idate,
        Consultancy_Id, CompanyType, CompanyAuthority, TrainingMode, Participants_Fresher, Participants_Experienced,
        TrainingLocation, TrainingDates, Discussion, FollowUp,
        InitialFollowUpDate, NextFollowUpDate,
        IsActive, IsDelete
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        COALESCE(?, CURDATE()),
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?,
        1, 0
      )`,
      [
        // Prefer storing the contact name into both Fname and FullName for legacy searches.
        (Fname ?? FullName) || null,
        Lname || null,
        MName || null,
        FullName || null,
        CompanyName || null,
        Designation || null,
        body?.Address || null,
        body?.City || null,
        body?.State || null,
        body?.Country || null,
        body?.Pin || null,
        Phone || null,
        Mobile || null,
        Email || null,
        Course_Id || null,
        Place || null,
        body?.business || null,
        Remark || null,
        Idate || null,
        Consultancy_Id,
        CompanyType || null,
        CompanyAuthority || null,
        TrainingMode || null,
        Participants_Fresher,
        Participants_Experienced,
        TrainingLocation || null,
        TrainingDates || null,
        Discussion || null,
        FollowUp || null,
        InitialFollowUpDate || null,
        NextFollowUpDate || null,
      ]
    );

    const insertedId = Number((result as any).insertId || 0);
    await syncConsultancyFollowupsFromCorporate({
      pool,
      consultancyId: Consultancy_Id,
      corporateInquiryId: insertedId,
      companyAuthority: (CompanyAuthority && String(CompanyAuthority).trim()) || null,
      fullName: (FullName && String(FullName).trim()) || null,
      designation: (Designation && String(Designation).trim()) || null,
      mobile: (Mobile && String(Mobile).trim()) || null,
      email: (Email && String(Email).trim()) || null,
      followUpRaw: FollowUp,
      discussion: Discussion,
      initialFollowUpDate: InitialFollowUpDate,
      nextFollowUpDate: NextFollowUpDate,
      inquiryDate: Idate,
    });

    // Invalidate cache on data modification
    await cache.deleteByPrefix(cacheKeys.corporateInquiry.prefix);

    await logTableActivity(req, {
      tableName: 'corporate_inquiry',
      action: 'CREATE',
      recordId: insertedId,
      details: { companyName: CompanyName || null, consultancyId: Consultancy_Id || null },
    });

    return NextResponse.json({ success: true, insertId: (result as any).insertId });
  } catch (err: unknown) {
    console.error('Corporate Inquiry POST error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - update corporate inquiry
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    await ensureCorporateInquiryColumns(pool);

    const Id = body?.Id;
    const Fname = body?.Fname;
    const MName = body?.MName;
    const Lname = body?.Lname;
    const FullNameRaw = body?.FullName;
    const FullName = String(
      (FullNameRaw && String(FullNameRaw).trim()) || [Fname, MName, Lname].filter(Boolean).join(' ') || ''
    ).trim();

    const CompanyName = body?.CompanyName;
    const Designation = body?.Designation;
    const Phone = body?.Phone;
    const Mobile = body?.Mobile;
    const Email = body?.Email;
    const Course_Id = body?.Course_Id;

    let Consultancy_Id = toNullableInt(body?.Consultancy_Id);
    const CompanyType = body?.CompanyType;
    const CompanyAuthority = body?.CompanyAuthority;
    const TrainingMode = parseTrainingMode(body?.TrainingMode);
    const Participants_Fresher = toNullableInt(body?.Participants_Fresher);
    const Participants_Experienced = toNullableInt(body?.Participants_Experienced);
    const TrainingLocation = body?.TrainingLocation;
    const TrainingDates = body?.TrainingDates;
    const Discussion = body?.Discussion;
    const FollowUp = body?.FollowUp;
    const InitialFollowUpDate = body?.InitialFollowUpDate;
    const NextFollowUpDate = body?.NextFollowUpDate;

    const InquiryStatus = body?.InquiryStatus;
    const TrainingNumber = body?.TrainingNumber;
    const TrainingDate = body?.TrainingDate;
    const TrainerName = body?.TrainerName;
    const NumberOfDays = toNullableInt(body?.NumberOfDays);
    const TotalStudents = toNullableInt(body?.TotalStudents);
    const TrainingCoordinator = body?.TrainingCoordinator;
    const DiscussionOutcome = body?.DiscussionOutcome;

    const Place = body?.Place ?? TrainingLocation;
    const Remark = body?.Remark ?? Discussion;
    const Idate = body?.Idate;
    const normalizedPlace = await normalizeToColumnLength(pool, 'corporate_inquiry', 'Place', Place);
    const consultancyCity = await normalizeToColumnLength(pool, 'consultant_mst', 'City', Place);

    if (!Id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const contactPerson = String((CompanyAuthority && String(CompanyAuthority).trim()) || '').trim()
      || String((FullName && String(FullName).trim()) || '').trim()
      || '';

    Consultancy_Id = await resolveConsultancyIdForInquiry({
      pool,
      consultancyId: Consultancy_Id,
      companyName: (CompanyName && String(CompanyName).trim()) || null,
      contactPerson: contactPerson || null,
      designation: (Designation && String(Designation).trim()) || null,
      phone: (Phone && String(Phone).trim()) || null,
      mobile: (Mobile && String(Mobile).trim()) || null,
      email: (Email && String(Email).trim()) || null,
      city: consultancyCity,
      companyType: (CompanyType && String(CompanyType).trim()) || null,
      dateAdded: (Idate && String(Idate).trim()) || null,
    });

    await syncConsultancyFollowupsFromCorporate({
      pool,
      consultancyId: Consultancy_Id,
      corporateInquiryId: Number(Id),
      companyAuthority: (CompanyAuthority && String(CompanyAuthority).trim()) || null,
      fullName: (FullName && String(FullName).trim()) || null,
      designation: (Designation && String(Designation).trim()) || null,
      mobile: (Mobile && String(Mobile).trim()) || null,
      email: (Email && String(Email).trim()) || null,
      followUpRaw: FollowUp,
      discussion: Discussion,
      initialFollowUpDate: InitialFollowUpDate,
      nextFollowUpDate: NextFollowUpDate,
      inquiryDate: Idate,
    });

    await pool.query(
      `UPDATE corporate_inquiry SET 
        Fname = ?, Lname = ?, MName = ?, FullName = ?, CompanyName = ?, Designation = ?,
        Address = ?, City = ?, State = ?, Country = ?, Pin = ?, Phone = ?, Mobile = ?,
        Email = ?, Course_Id = ?, Place = ?, business = ?, Remark = ?, Idate = ?,
        Consultancy_Id = ?, CompanyType = ?, CompanyAuthority = ?, TrainingMode = ?, Participants_Fresher = ?, Participants_Experienced = ?,
        TrainingLocation = ?, TrainingDates = ?, Discussion = ?, FollowUp = ?
        , InitialFollowUpDate = ?, NextFollowUpDate = ?
        , InquiryStatus = ?, TrainingNumber = ?, TrainingDate = ?, TrainerName = ?, NumberOfDays = ?, TotalStudents = ?, TrainingCoordinator = ?, DiscussionOutcome = ?
      WHERE Id = ?`,
      [
        (Fname ?? FullName) || null,
        Lname || null,
        MName || null,
        FullName || null,
        CompanyName || null,
        Designation || null,
        body?.Address || null,
        body?.City || null,
        body?.State || null,
        body?.Country || null,
        body?.Pin || null,
        Phone || null,
        Mobile || null,
        Email || null,
        Course_Id || null,
        normalizedPlace || null,
        body?.business || null,
        Remark || null,
        Idate || null,
        Consultancy_Id,
        CompanyType || null,
        CompanyAuthority || null,
        TrainingMode || null,
        Participants_Fresher,
        Participants_Experienced,
        TrainingLocation || null,
        TrainingDates || null,
        Discussion || null,
        FollowUp || null,
        InitialFollowUpDate || null,
        NextFollowUpDate || null,
        InquiryStatus || null,
        TrainingNumber || null,
        TrainingDate || null,
        TrainerName || null,
        NumberOfDays,
        TotalStudents,
        TrainingCoordinator || null,
        DiscussionOutcome || null,
        Id
      ]
    );

    // Invalidate cache on data modification
    await cache.deleteByPrefix(cacheKeys.corporateInquiry.prefix);

    await logTableActivity(req, {
      tableName: 'corporate_inquiry',
      action: 'UPDATE',
      recordId: Id,
      details: { companyName: CompanyName || null, consultancyId: Consultancy_Id || null },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Corporate Inquiry PUT error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete corporate inquiry
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query(`UPDATE corporate_inquiry SET IsDelete = 1 WHERE Id = ?`, [id]);

    // Invalidate cache on data modification
    await cache.deleteByPrefix(cacheKeys.corporateInquiry.prefix);

    await logTableActivity(req, {
      tableName: 'corporate_inquiry',
      action: 'DELETE',
      recordId: id,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Corporate Inquiry DELETE error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
