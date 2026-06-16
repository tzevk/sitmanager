/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool } from '@/lib/db';
import { sendOnlineAdmissionSubmissionEmail } from '@/lib/mailer';
import { hasAdmissionUploads, type AdmissionUploadBundle, saveAdmissionAssetsForStudent } from '@/lib/student-documents.server';

let inquiryTableNameCache: string | null = null;
let statusTableNameCache: string | null | undefined;
let studentMasterTableNameCache: string | null | undefined;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OnlineAdmissionListParams {
  page: number;
  limit: number;
  search?: string;
  statusCategory?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Only include fully-submitted forms (exclude draft autosaves). */
  submittedOnly?: boolean;
  /** 'filled' = OnlineState 23 (submitted); 'filling' = has payload but not yet submitted */
  formStatus?: 'filled' | 'filling' | '';
}

type StatusCategory = 'open' | 'accepted' | 'closed';

export interface AdmissionRow {
  Admission_Id: number;
  Inquiry_Id: number;
  Student_Name: string;
  Email: string;
  Present_Mobile: string;
  Batch_code: string;
  Admission_Date: string | null;
  PayloadUpdatedAt: string | null;
  PayloadCreatedAt: string | null;
  Status_id: number | null;
  StatusText: string;
  StatusLabel: string;
  StatusCategory: StatusCategory;
  RazorpayPaid: boolean;
  RazorpayPaymentId: string;
  RazorpayOrderId: string;
  RazorpayAmount: number | null;
  IsLegacy: 0 | 1;
}

export interface StatusOption { id: number; label: string }

export interface OnlineAdmissionListResult {
  rows: AdmissionRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  statusOptions: StatusOption[];
}

export interface SubmitAdmissionInput {
  inquiryId: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  batchCode?: string;
  [key: string]: any;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAYLOAD_TABLE = 'online_admission_payload';
const KT_TABLE      = 'online_admission_kt_details';

// All form fields that should live as proper DB columns (not just JSON blob).
// Used by ensureExtendedColumns to migrate the table on first use.
const FORM_COLUMNS: [string, string][] = [
  // Personal
  ['First_Name',        'VARCHAR(100) NULL'],
  ['Middle_Name',       'VARCHAR(100) NULL'],
  ['Last_Name',         'VARCHAR(100) NULL'],
  ['Short_Name',        'VARCHAR(100) NULL'],
  ['Student_Name',      'VARCHAR(300) NULL'],
  ['DOB',               'DATE NULL'],
  ['Sex',               'VARCHAR(20) NULL'],
  ['Nationality',       'VARCHAR(100) NULL'],
  ['Email',             'VARCHAR(200) NULL'],
  ['Present_Mobile',    'VARCHAR(20) NULL'],
  ['Telephone',         'VARCHAR(20) NULL'],
  ['Family_Contact',    'VARCHAR(100) NULL'],
  ['ID_Proof_Type',     'VARCHAR(100) NULL'],
  // Present address
  ['Present_Flat',      'VARCHAR(100) NULL'],
  ['Present_Building',  'VARCHAR(200) NULL'],
  ['Present_Street',    'VARCHAR(200) NULL'],
  ['Present_Area',      'VARCHAR(200) NULL'],
  ['Present_Landmark',  'VARCHAR(200) NULL'],
  ['Present_Address',   'TEXT NULL'],
  ['Present_City',      'VARCHAR(100) NULL'],
  ['Present_District',  'VARCHAR(100) NULL'],
  ['Present_State',     'VARCHAR(100) NULL'],
  ['Present_Pin',       'VARCHAR(10) NULL'],
  ['Present_Country',   'VARCHAR(100) NULL'],
  // Permanent address
  ['Same_As_Present',      'TINYINT(1) NULL DEFAULT 0'],
  ['Permanent_Flat',       'VARCHAR(100) NULL'],
  ['Permanent_Building',   'VARCHAR(200) NULL'],
  ['Permanent_Street',     'VARCHAR(200) NULL'],
  ['Permanent_Area',       'VARCHAR(200) NULL'],
  ['Permanent_Landmark',   'VARCHAR(200) NULL'],
  ['Permanent_Address',    'TEXT NULL'],
  ['Permanent_City',       'VARCHAR(100) NULL'],
  ['Permanent_District',   'VARCHAR(100) NULL'],
  ['Permanent_State',      'VARCHAR(100) NULL'],
  ['Permanent_Pin',        'VARCHAR(10) NULL'],
  ['Permanent_Country',    'VARCHAR(100) NULL'],
  // SSC
  ['SSC_Board',            'VARCHAR(200) NULL'],
  ['SSC_School_Name',      'VARCHAR(300) NULL'],
  ['SSC_Year_Passing',     'VARCHAR(10) NULL'],
  ['SSC_Percentage',       'DECIMAL(5,2) NULL'],
  ['SSC_KT_Count',         'INT NULL DEFAULT 0'],
  // HSC
  ['HSC_Board',            'VARCHAR(200) NULL'],
  ['HSC_College_Name',     'VARCHAR(300) NULL'],
  ['HSC_Stream',           'VARCHAR(200) NULL'],
  ['HSC_Year_Passing',     'VARCHAR(10) NULL'],
  ['HSC_Percentage',       'DECIMAL(5,2) NULL'],
  ['HSC_KT_Count',         'INT NULL DEFAULT 0'],
  // Diploma
  ['Diploma_Degree',         'VARCHAR(200) NULL'],
  ['Diploma_Specialization', 'VARCHAR(200) NULL'],
  ['Diploma_Institute',      'VARCHAR(300) NULL'],
  ['Diploma_Year_Passing',   'VARCHAR(10) NULL'],
  ['Diploma_Percentage',     'DECIMAL(5,2) NULL'],
  ['Diploma_KT_Count',       'INT NULL DEFAULT 0'],
  // Graduation
  ['Grad_Degree',            'VARCHAR(200) NULL'],
  ['Grad_Specialization',    'VARCHAR(200) NULL'],
  ['Grad_University',        'VARCHAR(300) NULL'],
  ['Grad_Year_Passing',      'VARCHAR(10) NULL'],
  ['Grad_Percentage',        'DECIMAL(5,2) NULL'],
  ['Grad_KT_Count',          'INT NULL DEFAULT 0'],
  // Post-Graduation
  ['PG_Degree',              'VARCHAR(200) NULL'],
  ['PG_Specialization',      'VARCHAR(200) NULL'],
  ['PG_University',          'VARCHAR(300) NULL'],
  ['PG_Year_Passing',        'VARCHAR(10) NULL'],
  ['PG_Percentage',          'DECIMAL(5,2) NULL'],
  ['PG_KT_Count',            'INT NULL DEFAULT 0'],
  // Education summary (resolved values)
  ['Qualification',          'VARCHAR(200) NULL'],
  ['Discipline',             'VARCHAR(200) NULL'],
  ['Percentage',             'DECIMAL(5,2) NULL'],
  ['Education_Remark',       'TEXT NULL'],
  // Occupational
  ['Occupational_Status',       'VARCHAR(200) NULL'],
  ['Job_Organisation',          'VARCHAR(300) NULL'],
  ['Job_Designation',           'VARCHAR(200) NULL'],
  ['Total_Experience',          'VARCHAR(20) NULL'],
  ['Job_Description',           'TEXT NULL'],
  ['Self_Employment_Details',   'TEXT NULL'],
  ['Working_From_Years',        'VARCHAR(10) NULL'],
  ['Working_From_Months',       'VARCHAR(20) NULL'],
  // Training
  ['Course_Id',                 'INT NULL'],
  ['Batch_Code',                'VARCHAR(100) NULL'],
  ['Training_Programme_Name',   'VARCHAR(300) NULL'],
  ['Training_Category',         'VARCHAR(200) NULL'],
  // Payment
  ['Mode_Of_Payment',           'VARCHAR(100) NULL'],
  ['Razorpay_Paid',             'TINYINT(1) NULL DEFAULT 0'],
  ['Razorpay_Payment_Id',       'VARCHAR(200) NULL'],
  ['Razorpay_Order_Id',         'VARCHAR(200) NULL'],
  ['Razorpay_Amount',           'DECIMAL(10,2) NULL'],
  ['Razorpay_Signature',        'VARCHAR(500) NULL'],
  ['Pay_At_Office_Audit',       'TEXT NULL'],
  // Consent
  ['Terms_Agreed',                      'TINYINT(1) NULL DEFAULT 0'],
  ['Consent_Acknowledged',              'TINYINT(1) NULL DEFAULT 0'],
  ['Experienced_Consent_Acknowledged',  'TINYINT(1) NULL DEFAULT 0'],
  ['Consent_Data',                      'TEXT NULL'],
  ['Consent_Checks',                    'TEXT NULL'],
  // Draft progress
  ['Draft_Step',                'INT NULL DEFAULT 0'],
  ['Draft_Autosaved_At',        'DATETIME NULL'],
];

let extColumnsReady = false;
let ktTableReady    = false;

const FALLBACK_STATUSES: Record<number, string> = {
  0: 'New Inquiry', 1: 'Follow Up', 2: 'Interested', 3: 'Confirmed',
  4: 'Not Interested', 5: 'Batch Started', 6: 'Batch Completed',
  7: 'Cancelled', 8: 'Admitted', 9: 'Left', 10: 'On Hold',
  12: 'Prospective', 13: 'Walk In', 15: 'Re-inquiry', 16: 'Demo Attended',
  17: 'Demo Scheduled', 19: 'Online Inquiry', 23: 'Document Pending',
  24: 'Fees Pending', 25: 'Transfer', 26: 'Need Based Training',
  27: 'Duplicate', 29: 'Corporate', 34: 'Assessment Done',
  35: 'Refund', 40: 'Counselling Done',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

let payloadTableReady = false;

async function resolveInquiryTableName(pool: ReturnType<typeof getPool>): Promise<string> {
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

async function resolveStatusTableName(pool: ReturnType<typeof getPool>): Promise<string | null> {
  if (statusTableNameCache !== undefined) return statusTableNameCache;

  try {
    const [rows] = await pool.query(
      `SELECT TABLE_NAME
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND LOWER(TABLE_NAME) = 'status_master'
       ORDER BY CASE WHEN TABLE_NAME = 'Status_Master' THEN 0 ELSE 1 END
       LIMIT 1`
    );
    statusTableNameCache = String((rows as any[])[0]?.TABLE_NAME || '').trim() || null;
  } catch {
    statusTableNameCache = null;
  }

  return statusTableNameCache;
}

async function resolveStudentMasterTableName(pool: ReturnType<typeof getPool>): Promise<string | null> {
  if (studentMasterTableNameCache !== undefined) return studentMasterTableNameCache;

  try {
    const [rows] = await pool.query(
      `SELECT TABLE_NAME
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND LOWER(TABLE_NAME) = 'student_master'
       ORDER BY CASE WHEN TABLE_NAME = 'student_master' THEN 0 ELSE 1 END
       LIMIT 1`
    );
    studentMasterTableNameCache = String((rows as any[])[0]?.TABLE_NAME || '').trim() || null;
  } catch {
    studentMasterTableNameCache = null;
  }

  return studentMasterTableNameCache;
}

async function ensurePayloadTable(pool: ReturnType<typeof getPool>): Promise<void> {
  if (payloadTableReady) return;
  try {
    const [pkRows] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY' LIMIT 1`,
      [PAYLOAD_TABLE]
    ) as [any[], any];
    const pkCol = String((pkRows as any[])[0]?.COLUMN_NAME ?? '');
    if (pkCol && pkCol !== 'Inquiry_Id') {
      await pool.query(`DROP TABLE \`${PAYLOAD_TABLE}\``);
    } else if (pkCol === 'Inquiry_Id') {
      // If a legacy Student_Id NOT NULL column exists, make it nullable so the
      // INSERT (which only specifies Inquiry_Id + Payload) doesn't fail.
      const [badCol] = await pool.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
           AND COLUMN_NAME = 'Student_Id' AND IS_NULLABLE = 'NO' LIMIT 1`,
        [PAYLOAD_TABLE]
      ) as [any[], any];
      if ((badCol as any[]).length > 0) {
        await pool.query(`ALTER TABLE \`${PAYLOAD_TABLE}\` MODIFY COLUMN Student_Id INT NULL`);
      }
    }
  } catch { /* table doesn't exist yet */ }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${PAYLOAD_TABLE} (
       Inquiry_Id INT NOT NULL PRIMARY KEY,
       Payload    LONGTEXT NULL,
       Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
  payloadTableReady = true;
}

async function ensureExtendedColumns(pool: ReturnType<typeof getPool>): Promise<void> {
  if (extColumnsReady) return;
  try {
    const [existingCols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [PAYLOAD_TABLE]
    ) as [any[], any];
    const existing = new Set((existingCols as any[]).map((r) => String(r.COLUMN_NAME)));
    const missing = FORM_COLUMNS.filter(([col]) => !existing.has(col));
    if (missing.length) {
      const addClauses = missing.map(([col, def]) => `ADD COLUMN \`${col}\` ${def}`).join(', ');
      await pool.query(`ALTER TABLE \`${PAYLOAD_TABLE}\` ${addClauses}`);
    }
    extColumnsReady = true;
  } catch (err) {
    console.warn('[OnlineAdmission] ensureExtendedColumns failed:', err);
  }
}

async function ensureKtTable(pool: ReturnType<typeof getPool>): Promise<void> {
  if (ktTableReady) return;
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${KT_TABLE}\` (
       Id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
       Inquiry_Id   INT NOT NULL,
       Level        VARCHAR(20) NOT NULL,
       Subject_Name VARCHAR(255) NULL,
       Year         VARCHAR(10) NULL,
       Semester     VARCHAR(10) NULL,
       Cleared_Year VARCHAR(10) NULL,
       Marks        VARCHAR(50) NULL,
       Sort_Order   INT NOT NULL DEFAULT 0,
       INDEX idx_inquiry (Inquiry_Id)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
  ktTableReady = true;
}

export async function saveStructuredAdmissionData(
  inquiryId: number,
  input: Record<string, any>
): Promise<void> {
  if (!Number.isFinite(inquiryId) || inquiryId <= 0) return;
  const pool = getPool();
  await ensurePayloadTable(pool);
  await ensureExtendedColumns(pool);
  await ensureKtTable(pool);

  const n = (v: unknown): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    return s || null;
  };
  const num = (v: unknown): number | null => {
    if (v == null) return null;
    const p = parseFloat(String(v));
    return Number.isFinite(p) ? p : null;
  };
  const maybeBool = (v: unknown): 0 | 1 | null => {
    if (v === undefined || v === null) return null;
    return v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
  };
  const jstr = (v: unknown): string | null => {
    if (v == null) return null;
    try { return typeof v === 'string' ? v : JSON.stringify(v); } catch { return null; }
  };

  const draftMeta = (input.__draftProgress && typeof input.__draftProgress === 'object')
    ? input.__draftProgress as Record<string, unknown>
    : null;

  const academic = resolveAcademicProfile(input);
  const fullName  = resolveFullName(input, null);
  const presentAddr   = n(input.presentAddress)   || buildAddress(input, 'present');
  const permanentAddr = n(input.permanentAddress)  || buildAddress(input, 'permanent');

  const fields: [string, unknown][] = [
    // Personal
    ['First_Name',      n(input.firstName)],
    ['Middle_Name',     n(input.middleName)],
    ['Last_Name',       n(input.lastName)],
    ['Short_Name',      n(input.shortName)],
    ['Student_Name',    fullName || null],
    ['DOB',             n(input.dob)],
    ['Sex',             n(input.gender)],
    ['Nationality',     n(input.nationality)],
    ['Email',           n(input.email)],
    ['Present_Mobile',  n(input.mobile)],
    ['Telephone',       n(input.telephone)],
    ['Family_Contact',  n(input.familyContact)],
    ['ID_Proof_Type',   n(input.idProofType)],
    // Present address
    ['Present_Flat',      n(input.presentFlat)],
    ['Present_Building',  n(input.presentBuilding)],
    ['Present_Street',    n(input.presentStreet)],
    ['Present_Area',      n(input.presentArea)],
    ['Present_Landmark',  n(input.presentLandmark)],
    ['Present_Address',   presentAddr],
    ['Present_City',      n(input.presentCity)],
    ['Present_District',  n(input.presentDistrict)],
    ['Present_State',     n(input.presentState)],
    ['Present_Pin',       n(input.presentPin)],
    ['Present_Country',   n(input.presentCountry)],
    // Permanent address
    ['Same_As_Present',    maybeBool(input.sameAsPresent)],
    ['Permanent_Flat',     n(input.permanentFlat)],
    ['Permanent_Building', n(input.permanentBuilding)],
    ['Permanent_Street',   n(input.permanentStreet)],
    ['Permanent_Area',     n(input.permanentArea)],
    ['Permanent_Landmark', n(input.permanentLandmark)],
    ['Permanent_Address',  permanentAddr],
    ['Permanent_City',     n(input.permanentCity)],
    ['Permanent_District', n(input.permanentDistrict)],
    ['Permanent_State',    n(input.permanentState)],
    ['Permanent_Pin',      n(input.permanentPin)],
    ['Permanent_Country',  n(input.permanentCountry)],
    // SSC
    ['SSC_Board',        n(input.ssc_board)],
    ['SSC_School_Name',  n(input.ssc_schoolName)],
    ['SSC_Year_Passing', n(input.ssc_yearOfPassing)],
    ['SSC_Percentage',   num(input.ssc_percentage)],
    ['SSC_KT_Count',     num(input.ssc_ktCount) ?? 0],
    // HSC
    ['HSC_Board',        n(input.hsc_board)],
    ['HSC_College_Name', n(input.hsc_collegeName)],
    ['HSC_Stream',       n(input.hsc_stream)],
    ['HSC_Year_Passing', n(input.hsc_yearOfPassing)],
    ['HSC_Percentage',   num(input.hsc_percentage)],
    ['HSC_KT_Count',     num(input.hsc_ktCount) ?? 0],
    // Diploma
    ['Diploma_Degree',          n(input.diploma_degree)],
    ['Diploma_Specialization',  n(input.diploma_specialization)],
    ['Diploma_Institute',       n(input.diploma_institute)],
    ['Diploma_Year_Passing',    n(input.diploma_yearOfPassing)],
    ['Diploma_Percentage',      num(input.diploma_percentage)],
    ['Diploma_KT_Count',        num(input.diploma_ktCount) ?? 0],
    // Graduation
    ['Grad_Degree',         n(input.grad_degree)],
    ['Grad_Specialization', n(input.grad_specialization)],
    ['Grad_University',     n(input.grad_university)],
    ['Grad_Year_Passing',   n(input.grad_yearOfPassing)],
    ['Grad_Percentage',     num(input.grad_percentage)],
    ['Grad_KT_Count',       num(input.grad_ktCount) ?? 0],
    // Post-Graduation
    ['PG_Degree',         n(input.postgrad_degree)],
    ['PG_Specialization', n(input.postgrad_specialization)],
    ['PG_University',     n(input.postgrad_university)],
    ['PG_Year_Passing',   n(input.postgrad_yearOfPassing)],
    ['PG_Percentage',     num(input.postgrad_percentage)],
    ['PG_KT_Count',       num(input.postgrad_ktCount) ?? 0],
    // Education summary
    ['Qualification',     academic.qualification],
    ['Discipline',        academic.discipline],
    ['Percentage',        academic.percentage],
    ['Education_Remark',  n(input.educationRemark)],
    // Occupational
    ['Occupational_Status',     n(input.occupationalStatus)],
    ['Job_Organisation',        n(input.jobOrganisation)],
    ['Job_Designation',         n(input.jobDesignation)],
    ['Total_Experience',        n(input.totalOccupationYears)],
    ['Job_Description',         n(input.jobDescription)],
    ['Self_Employment_Details', n(input.selfEmploymentDetails)],
    ['Working_From_Years',      n(input.workingFromYears)],
    ['Working_From_Months',     n(input.workingFromMonths)],
    // Training
    ['Course_Id',               num(input.trainingProgrammeId) ?? num(input.Course_Id)],
    ['Batch_Code',              n(input.batchCode)],
    ['Training_Programme_Name', n(input.trainingProgrammeName)],
    ['Training_Category',       n(input.trainingCategory)],
    // Payment
    ['Mode_Of_Payment',    n(input.modeOfPayment)],
    ['Razorpay_Paid',      maybeBool(input.razorpayPaid)],
    ['Razorpay_Payment_Id', n(input.razorpayPaymentId)],
    ['Razorpay_Order_Id',  n(input.razorpayOrderId)],
    ['Razorpay_Amount',    num(input.razorpayAmount)],
    ['Razorpay_Signature', n(input.razorpaySignature)],
    ['Pay_At_Office_Audit', jstr(input.payAtOfficeAudit)],
    // Consent
    ['Terms_Agreed',                     maybeBool(input.termsAgreed)],
    ['Consent_Acknowledged',             maybeBool(input.consentAcknowledged)],
    ['Experienced_Consent_Acknowledged', maybeBool(input.experiencedConsentAcknowledged)],
    ['Consent_Data',                     jstr(input.consentData)],
    ['Consent_Checks',                   jstr(input.consentChecks)],
    // Draft
    ['Draft_Step',          draftMeta?.currentStep != null ? Number(draftMeta.currentStep) : null],
    ['Draft_Autosaved_At',  draftMeta?.autosavedAt ? n(String(draftMeta.autosavedAt)) : null],
  ];

  const setClauses = fields.map(([col]) => `\`${col}\` = ?`).join(', ');
  const values     = fields.map(([, v]) => v);
  try {
    await pool.query(
      `UPDATE \`${PAYLOAD_TABLE}\` SET ${setClauses} WHERE Inquiry_Id = ?`,
      [...values, inquiryId]
    );
  } catch (err) {
    console.warn('[OnlineAdmission] saveStructuredAdmissionData UPDATE failed:', err);
    return;
  }

  // KT details — only replace when at least one level array is present in the input
  const ktLevels = ['ssc', 'hsc', 'diploma', 'grad', 'postgrad'] as const;
  const hasKtData = ktLevels.some((l) => Array.isArray(input[`${l}_ktDetails`]));
  if (!hasKtData) return;

  await pool.query(`DELETE FROM \`${KT_TABLE}\` WHERE Inquiry_Id = ?`, [inquiryId]);
  const ktRows: any[][] = [];
  for (const level of ktLevels) {
    const details: any[] = Array.isArray(input[`${level}_ktDetails`]) ? input[`${level}_ktDetails`] : [];
    details.forEach((d: any, i: number) => {
      ktRows.push([inquiryId, level, n(d.subjectName), n(d.year), n(d.semester), n(d.clearedYear), n(d.marks), i]);
    });
  }
  if (ktRows.length) {
    await pool.query(
      `INSERT INTO \`${KT_TABLE}\` (Inquiry_Id, Level, Subject_Name, Year, Semester, Cleared_Year, Marks, Sort_Order) VALUES ?`,
      [ktRows]
    );
  }
}

async function resolveStudentIdForInquiry(
  pool: ReturnType<typeof getPool>,
  inquiryId: number
): Promise<number | null> {
  const inquiryTable = await resolveInquiryTableName(pool);
  const [rows] = await pool.query(
    `SELECT Student_Id
    FROM \`${inquiryTable}\`
     WHERE Inquiry_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
     LIMIT 1`,
    [inquiryId]
  ) as [any[], any];
  const studentId = Number(rows[0]?.Student_Id || 0);
  return studentId > 0 ? studentId : null;
}

async function resolveBatchCategoryId(
  pool: ReturnType<typeof getPool>,
  batchCode: string | null,
  categoryValue: string | null
): Promise<number | null> {
  const numericCategoryId = parseOptionalNumber(categoryValue);
  if (numericCategoryId !== null) return numericCategoryId;
  if (!batchCode && !categoryValue) return null;

  const conditions: string[] = ['(IsDelete = 0 OR IsDelete IS NULL)'];
  const params: Array<string | number> = [];
  if (batchCode) {
    conditions.push('Batch_code = ?');
    params.push(batchCode);
  }
  if (categoryValue) {
    conditions.push('Category = ?');
    params.push(categoryValue);
  }

  const [rows] = await pool.query(
    `SELECT Batch_Category_id
     FROM batch_mst
     WHERE ${conditions.join(' AND ')}
       AND Batch_Category_id IS NOT NULL
     ORDER BY COALESCE(IsActive, 0) DESC, COALESCE(Admission_Date, SDate, Date_Added) DESC, Batch_Id DESC
     LIMIT 1`,
    params
  ) as [any[], any];
  return rows[0]?.Batch_Category_id != null ? Number(rows[0].Batch_Category_id) : null;
}

function safeDate(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value);
  if (!s || s.startsWith('0000-')) return null;
  const t = new Date(s).getTime();
  if (!Number.isFinite(t) || t <= 0) return null;
  return s;
}

function resolveCategory(statusId: number, statusText: string): StatusCategory {
  if ([8, 9, 10].includes(statusId)) return 'accepted';
  if ([5, 11, 13, 27].includes(statusId)) return 'closed';
  const base = (statusText || '').toLowerCase();
  if (/accepted|admitted|confirm|taken/.test(base)) return 'accepted';
  if (/cancel|reject|closed|not interested|drop|left|denied/.test(base)) return 'closed';
  return 'open';
}

function normalizeText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return '';
}

function parseOptionalNumber(value: unknown): number | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveWorkingSince(input: Record<string, unknown>): string | null {
  const explicitDate = normalizeText(input.WorkingSince);
  if (explicitDate) return explicitDate;

  const year = normalizeText(input.workingFromYears);
  if (!/^\d{4}$/.test(year)) return null;

  const monthRaw = normalizeText(input.workingFromMonths).toLowerCase();
  const monthMap: Record<string, string> = {
    '1': '01', '01': '01', jan: '01', january: '01',
    '2': '02', '02': '02', feb: '02', february: '02',
    '3': '03', '03': '03', mar: '03', march: '03',
    '4': '04', '04': '04', apr: '04', april: '04',
    '5': '05', '05': '05', may: '05',
    '6': '06', '06': '06', jun: '06', june: '06',
    '7': '07', '07': '07', jul: '07', july: '07',
    '8': '08', '08': '08', aug: '08', august: '08',
    '9': '09', '09': '09', sep: '09', september: '09',
    '10': '10', oct: '10', october: '10',
    '11': '11', nov: '11', november: '11',
    '12': '12', dec: '12', december: '12',
  };
  const month = monthMap[monthRaw] || '01';
  return `${year}-${month}-01`;
}

function buildAddress(input: Record<string, unknown>, prefix: 'present' | 'permanent'): string | null {
  const combined = normalizeText(input[`${prefix}Address`]);
  if (combined) return combined;

  const parts = [
    input[`${prefix}Flat`],
    input[`${prefix}Building`],
    input[`${prefix}Street`],
    input[`${prefix}Area`],
    input[`${prefix}Landmark`],
    input[`${prefix}District`],
  ].map(normalizeText).filter(Boolean);

  return parts.length ? parts.join(', ') : null;
}

function resolveAcademicProfile(input: Record<string, unknown>) {
  const explicitQualification = normalizeText(input.qualification);
  const explicitDiscipline = normalizeText(input.discipline);
  const explicitPercentage = parseOptionalNumber(input.percentage);
  if (explicitQualification || explicitDiscipline || explicitPercentage !== null) {
    return {
      qualification: explicitQualification || null,
      discipline: explicitDiscipline || null,
      percentage: explicitPercentage,
    };
  }

  const candidates = [
    {
      qualification: normalizeText(input.postgrad_degree),
      discipline: normalizeText(input.postgrad_specialization),
      percentage: parseOptionalNumber(input.postgrad_percentage),
    },
    {
      qualification: normalizeText(input.grad_degree),
      discipline: normalizeText(input.grad_specialization),
      percentage: parseOptionalNumber(input.grad_percentage),
    },
    {
      qualification: normalizeText(input.diploma_degree),
      discipline: normalizeText(input.diploma_specialization),
      percentage: parseOptionalNumber(input.diploma_percentage),
    },
    {
      qualification: normalizeText(input.hsc_stream) ? 'HSC' : '',
      discipline: normalizeText(input.hsc_stream),
      percentage: parseOptionalNumber(input.hsc_percentage),
    },
    {
      qualification: normalizeText(input.ssc_board) ? 'SSC' : '',
      discipline: '',
      percentage: parseOptionalNumber(input.ssc_percentage),
    },
  ];

  const chosen = candidates.find((candidate) => candidate.qualification || candidate.discipline || candidate.percentage !== null);
  return {
    qualification: chosen?.qualification || null,
    discipline: chosen?.discipline || null,
    percentage: chosen?.percentage ?? null,
  };
}

function resolveFullName(input: Record<string, unknown>, fallbackName: unknown): string {
  return firstNonEmpty(
    [input.firstName, input.middleName, input.lastName].map(normalizeText).filter(Boolean).join(' '),
    input.fullName,
    fallbackName,
  );
}

export async function syncOnlineAdmissionIntoCurrentDb(
  inquiryId: number,
  input: Record<string, unknown>,
  options?: { statusAction?: 'accept' | 'reject' | 'update' | '' }
): Promise<void> {
  if (!Number.isFinite(inquiryId) || inquiryId <= 0) return;

  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  const studentMasterTable = await resolveStudentMasterTableName(pool);
  if (!studentMasterTable) return;

  const [inquiryRows] = await pool.query(
    `SELECT Inquiry_Id, Student_Id, Student_Name, Email, Present_Mobile, Batch_Code, Course_Id, OnlineState
     FROM \`${inquiryTable}\`
     WHERE Inquiry_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
     LIMIT 1`,
    [inquiryId]
  ) as [any[], any];
  if (!inquiryRows.length) return;

  const inquiry = inquiryRows[0];
  const studentId = Number(inquiry.Student_Id || 0);
  const fullName = resolveFullName(input, inquiry.Student_Name);
  const statusAction = options?.statusAction || normalizeText(input.statusAction);
  const nextStatusId = statusAction === 'accept' ? 8 : statusAction === 'reject' ? 7 : null;
  const courseId = parseOptionalNumber(input.trainingProgrammeId) ?? parseOptionalNumber(input.Course_Id) ?? parseOptionalNumber(inquiry.Course_Id);
  const batchCode = firstNonEmpty(input.batchCode, inquiry.Batch_Code) || null;
  const batchCategory = firstNonEmpty(input.trainingCategory, input.Batch_Category_id) || null;
  const batchCategoryId = await resolveBatchCategoryId(pool, batchCode, batchCategory);
  const presentAddress = buildAddress(input, 'present');
  const permanentAddress = buildAddress(input, 'permanent');
  const academic = resolveAcademicProfile(input);
  void resolveWorkingSince(input); // computed for future use; no matching student_master column yet

  const inquiryUpdateParts: string[] = [];
  const inquiryUpdateValues: any[] = [];
  const pushInquiry = (column: string, value: unknown) => {
    if (value == null) return;
    inquiryUpdateParts.push(`${column} = ?`);
    inquiryUpdateValues.push(value);
  };

  pushInquiry('Student_Name', fullName || null);
  pushInquiry('Email', firstNonEmpty(input.email, inquiry.Email) || null);
  pushInquiry('Present_Mobile', firstNonEmpty(input.mobile, inquiry.Present_Mobile) || null);
  pushInquiry('Present_Mobile2', normalizeText(input.telephone) || null);
  pushInquiry('DOB', normalizeText(input.dob) || null);
  pushInquiry('Sex', normalizeText(input.gender) || null);
  pushInquiry('Nationality', normalizeText(input.nationality) || null);
  pushInquiry('Batch_Code', batchCode);
  pushInquiry('Course_Id', courseId);
  pushInquiry('Qualification', academic.qualification);
  pushInquiry('Discipline', academic.discipline);
  pushInquiry('Percentage', academic.percentage);
  if (nextStatusId !== null) pushInquiry('OnlineState', nextStatusId);

  if (inquiryUpdateParts.length) {
    await pool.query(
      `UPDATE \`${inquiryTable}\` SET ${inquiryUpdateParts.join(', ')} WHERE Inquiry_Id = ?`,
      [...inquiryUpdateValues, inquiryId]
    );
  }

  const admissionDate = normalizeText(input.admissionDate) || new Date().toISOString().slice(0, 10);

  let resolvedStudentId = studentId;

  const createStudentMasterFromAdmission = async (): Promise<number> => {
    const [insertResult] = await pool.query(
      `INSERT INTO \`${studentMasterTable}\` (
         Student_Name, FName, MName, LName,
         DOB, Sex, Nationality,
         Email, Present_Mobile, Present_Mobile2,
         Present_Address, Present_City, Present_State, Present_Pin, Present_Country,
         Permanent_Address, Permanent_City, Permanent_Pin, Permanent_State, Permanent_Country,
         Qualification, Discipline, Percentage,
         Course_Id, Batch_Code, Batch_Category_id,
         Company, Designation, Occupation, Total_Exp, Remark,
         Status_id, Status_date, Admission_Dt,
         IsActive, IsDelete
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
      [
        fullName || null,
        normalizeText(input.firstName) || null,
        normalizeText(input.middleName) || null,
        normalizeText(input.lastName) || null,
        normalizeText(input.dob) || null,
        normalizeText(input.gender) || null,
        normalizeText(input.nationality) || 'Indian',
        firstNonEmpty(input.email, inquiry.Email) || null,
        firstNonEmpty(input.mobile, inquiry.Present_Mobile) || null,
        normalizeText(input.telephone) || null,
        presentAddress,
        normalizeText(input.presentCity) || null,
        normalizeText(input.presentState) || null,
        normalizeText(input.presentPin) || null,
        normalizeText(input.presentCountry) || 'India',
        permanentAddress,
        normalizeText(input.permanentCity) || null,
        normalizeText(input.permanentPin) || null,
        normalizeText(input.permanentState) || null,
        normalizeText(input.permanentCountry) || 'India',
        academic.qualification,
        academic.discipline,
        academic.percentage,
        courseId,
        batchCode,
        batchCategoryId,
        normalizeText(input.jobOrganisation) || null,
        normalizeText(input.jobDesignation) || null,
        normalizeText(input.occupationalStatus) || null,
        parseOptionalNumber(input.totalOccupationYears),
        normalizeText(input.jobDescription) || null,
        8,
        new Date().toISOString().slice(0, 10),
        admissionDate,
      ]
    ) as [any, any];

    return Number((insertResult as any).insertId) || 0;
  };

  if (studentId > 0) {
    const [studentRows] = await pool.query(
      `SELECT Student_Id FROM \`${studentMasterTable}\` WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1`,
      [studentId]
    ) as [any[], any];

    const studentExists = (studentRows as any[]).length > 0;

    const studentUpdateValues = [
      fullName || null,
      normalizeText(input.firstName) || null,
      normalizeText(input.middleName) || null,
      normalizeText(input.lastName) || null,
      normalizeText(input.dob) || null,
      normalizeText(input.gender) || null,
      normalizeText(input.nationality) || null,
      firstNonEmpty(input.email, inquiry.Email) || null,
      firstNonEmpty(input.mobile, inquiry.Present_Mobile) || null,
      normalizeText(input.telephone) || null,
      presentAddress,
      normalizeText(input.presentCity) || null,
      normalizeText(input.presentState) || null,
      normalizeText(input.presentPin) || null,
      normalizeText(input.presentCountry) || null,
      permanentAddress,
      normalizeText(input.permanentCity) || null,
      normalizeText(input.permanentPin) || null,
      normalizeText(input.permanentState) || null,
      normalizeText(input.permanentCountry) || null,
      academic.qualification,
      academic.discipline,
      academic.percentage,
      courseId,
      batchCode,
      batchCategoryId,
      normalizeText(input.jobOrganisation) || null,
      normalizeText(input.jobDesignation) || null,
      normalizeText(input.occupationalStatus) || null,
      parseOptionalNumber(input.totalOccupationYears),
      normalizeText(input.jobDescription) || null,
      nextStatusId,
      nextStatusId !== null ? new Date().toISOString().slice(0, 10) : null,
      nextStatusId === 8 ? admissionDate : null,
      studentId,
    ];

    if (studentExists) {
      await pool.query(
        `UPDATE \`${studentMasterTable}\` SET
         Student_Name = COALESCE(?, Student_Name),
         FName = COALESCE(?, FName),
         MName = COALESCE(?, MName),
         LName = COALESCE(?, LName),
         DOB = COALESCE(?, DOB),
         Sex = COALESCE(?, Sex),
         Nationality = COALESCE(?, Nationality),
         Email = COALESCE(?, Email),
         Present_Mobile = COALESCE(?, Present_Mobile),
         Present_Mobile2 = COALESCE(?, Present_Mobile2),
         Present_Address = COALESCE(?, Present_Address),
         Present_City = COALESCE(?, Present_City),
         Present_State = COALESCE(?, Present_State),
         Present_Pin = COALESCE(?, Present_Pin),
         Present_Country = COALESCE(?, Present_Country),
         Permanent_Address = COALESCE(?, Permanent_Address),
         Permanent_City = COALESCE(?, Permanent_City),
         Permanent_Pin = COALESCE(?, Permanent_Pin),
         Permanent_State = COALESCE(?, Permanent_State),
         Permanent_Country = COALESCE(?, Permanent_Country),
         Qualification = COALESCE(?, Qualification),
         Discipline = COALESCE(?, Discipline),
         Percentage = COALESCE(?, Percentage),
         Course_Id = COALESCE(?, Course_Id),
         Batch_Code = COALESCE(?, Batch_Code),
         Batch_Category_id = COALESCE(?, Batch_Category_id),
         Company = COALESCE(?, Company),
         Designation = COALESCE(?, Designation),
         Occupation = COALESCE(?, Occupation),
         Total_Exp = COALESCE(?, Total_Exp),
         Remark = COALESCE(?, Remark),
         Status_id = COALESCE(?, Status_id),
         Status_date = COALESCE(?, Status_date),
         Admission_Dt = COALESCE(?, Admission_Dt)
       WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
        studentUpdateValues
      );
    } else {
      const newStudentId = await createStudentMasterFromAdmission();
      if (newStudentId > 0) {
        resolvedStudentId = newStudentId;
        await pool.query(
          `UPDATE \`${inquiryTable}\` SET Student_Id = ? WHERE Inquiry_Id = ?`,
          [newStudentId, inquiryId]
        );
      }
    }
  } else if (statusAction === 'accept') {
    // No existing student linked — create one from the online admission form data
    try {
      const newStudentId = await createStudentMasterFromAdmission();
      if (newStudentId > 0) {
        resolvedStudentId = newStudentId;
        await pool.query(
          `UPDATE \`${inquiryTable}\` SET Student_Id = ? WHERE Inquiry_Id = ?`,
          [newStudentId, inquiryId]
        );
      }
    } catch (err) {
      console.error('[OnlineAdmission] Failed to create student_master record:', err);
    }
  }

  if (statusAction === 'accept' && resolvedStudentId > 0) {
    let batchId: number | null = null;
    if (batchCode) {
      const [batchRows] = await pool.query(
        `SELECT Batch_Id FROM batch_mst WHERE Batch_code = ? AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1`,
        [batchCode]
      ) as [any[], any];
      batchId = batchRows[0]?.Batch_Id ? Number(batchRows[0].Batch_Id) : null;
    }

    const [admissionRows] = await pool.query(
      `SELECT Admission_Id
       FROM admission_master
       WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Admission_Date DESC, Admission_Id DESC
       LIMIT 1`,
      [resolvedStudentId]
    ) as [any[], any];

    let admissionId: number | null = null;
    if (admissionRows.length) {
      admissionId = Number(admissionRows[0].Admission_Id);
      await pool.query(
        `UPDATE admission_master SET
           Batch_Id = COALESCE(?, Batch_Id),
           Course_Id = COALESCE(?, Course_Id),
           Admission_Date = COALESCE(?, Admission_Date),
           IsActive = 1,
           Cancel = 0
         WHERE Admission_Id = ?`,
        [batchId, courseId, admissionDate, admissionId]
      );
    } else {
      const [admInsert] = await pool.query(
        `INSERT INTO admission_master (
           Student_Id, Course_Id, Batch_Id, Admission_Date, IsActive, Cancel, IsDelete
         ) VALUES (?, ?, ?, ?, 1, 0, 0)`,
        [resolvedStudentId, courseId, batchId, admissionDate]
      ) as [any, any];
      admissionId = Number(admInsert.insertId);
    }

    // If the applicant paid online during the admission form, record it in the
    // fees ledger so it shows up as "Paid" on the student page. Dedupe on
    // PaymentId so re-granting / re-syncing doesn't create duplicate entries.
    const razorpayPaid = input.razorpayPaid === true;
    const razorpayAmount = parseOptionalNumber(input.razorpayAmount);
    const razorpayPaymentId = normalizeText(input.razorpayPaymentId);
    if (razorpayPaid && razorpayAmount && razorpayAmount > 0 && razorpayPaymentId) {
      const [existingFee] = await pool.query(
        `SELECT Fees_Id FROM s_fees_mst WHERE PaymentId = ? AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1`,
        [razorpayPaymentId]
      ) as [any[], any];

      if (!existingFee.length) {
        const [feesCodeRows] = await pool.query(
          `SELECT AUTO_INCREMENT AS nextId FROM information_schema.TABLES
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's_fees_mst'`
        ) as [any[], any];
        const nextId = Number(feesCodeRows[0]?.nextId ?? 1);
        const now = new Date();
        const feesCode = `R-${String(now.getMonth() + 1).padStart(2, '0')}/${String(nextId).padStart(3, '0')}`;

        await pool.query(
          `INSERT INTO s_fees_mst (
             Fees_Code, Student_Id, Course_Id, Batch_Id, Admission_Id, Payment_Type,
             Amount, Total_Amt, TypeR, Notes, RDate, Date_Added, FeesMonth, FeesYear,
             PaymentId, IsActive, IsDelete
           ) VALUES (?, ?, ?, ?, ?, 'Online', ?, ?, 'C', ?, ?, ?, ?, ?, ?, 1, 0)`,
          [
            feesCode, resolvedStudentId, courseId, batchId, admissionId,
            razorpayAmount, razorpayAmount, 'Online Admission Payment (Razorpay)',
            admissionDate, now, now.getMonth() + 1, now.getFullYear(), razorpayPaymentId,
          ]
        );
      }
    }
  }
}

// ── Public service functions ──────────────────────────────────────────────────

export async function listOnlineAdmissions(
  params: OnlineAdmissionListParams
): Promise<OnlineAdmissionListResult> {
  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  const statusTable = await resolveStatusTableName(pool);
  const studentMasterTable = await resolveStudentMasterTableName(pool);
  const { page, limit, search = '', statusCategory = '', dateFrom = '', dateTo = '', submittedOnly = false, formStatus = '' } = params;
  const offset = (page - 1) * limit;

  const buildNewQuery = (withStatus: boolean) => {
    const effectiveStatusTable = withStatus ? statusTable : null;
    const smJoin = studentMasterTable
      ? `LEFT JOIN \`${studentMasterTable}\` sm ON sm.Student_Id = si.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)`
      : '';
    const statusTextExpr = effectiveStatusTable
      ? `COALESCE(stm_si.Status, stm_sm.Status, '')`
      : `''`;
    const statusJoins = effectiveStatusTable && studentMasterTable
      ? `LEFT JOIN \`${effectiveStatusTable}\` stm_sm ON stm_sm.Id = sm.Status_id
         LEFT JOIN \`${effectiveStatusTable}\` stm_si ON stm_si.Id = si.OnlineState`
      : effectiveStatusTable
        ? `LEFT JOIN \`${effectiveStatusTable}\` stm_si ON stm_si.Id = si.OnlineState`
        : '';
    const smBatchCode = studentMasterTable ? `COALESCE(sm.Batch_Code, si.Batch_Code, '')` : `COALESCE(si.Batch_Code, '')`;
    const smAdmissionDt = studentMasterTable ? `COALESCE(sm.Admission_Dt, oap.Created_At)` : `oap.Created_At`;
    // Online admission state (OnlineState) is authoritative for this listing — it reflects
    // grant/reject decisions. Fall back to the student master status when it is unset
    // (NULL or empty string).
    const smStatusId = studentMasterTable ? `COALESCE(NULLIF(TRIM(si.OnlineState), ''), sm.Status_id)` : `NULLIF(TRIM(si.OnlineState), '')`;
    return `SELECT
       si.Inquiry_Id AS Inquiry_Id,
       ${studentMasterTable ? `COALESCE(si.Student_Name, sm.Student_Name, '')` : `COALESCE(si.Student_Name, '')`} AS Student_Name,
       ${studentMasterTable ? `COALESCE(si.Email, sm.Email, '')` : `COALESCE(si.Email, '')`} AS Email,
       ${studentMasterTable ? `COALESCE(si.Present_Mobile, sm.Present_Mobile, '')` : `COALESCE(si.Present_Mobile, '')`} AS Present_Mobile,
       ${smBatchCode} AS Batch_code,
       ${smAdmissionDt} AS Admission_Date,
       ${smStatusId} AS Status_id,
       ${statusTextExpr} AS StatusText,
       oap.Created_At AS PayloadCreatedAt,
       oap.Updated_At AS PayloadUpdatedAt,
       CASE
         WHEN JSON_EXTRACT(oap.Payload, '$.razorpayPaid') = true THEN 1
         WHEN LOWER(JSON_UNQUOTE(JSON_EXTRACT(oap.Payload, '$.razorpayPaid'))) IN ('true', '1', 'yes', 'paid') THEN 1
         ELSE 0
       END AS RazorpayPaid,
       COALESCE(JSON_UNQUOTE(JSON_EXTRACT(oap.Payload, '$.razorpayPaymentId')), '') AS RazorpayPaymentId,
       COALESCE(JSON_UNQUOTE(JSON_EXTRACT(oap.Payload, '$.razorpayOrderId')), '') AS RazorpayOrderId,
       CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(oap.Payload, '$.razorpayAmount')), '') AS DECIMAL(12,2)) AS RazorpayAmount
     FROM ${PAYLOAD_TABLE} oap
       JOIN \`${inquiryTable}\` si ON si.Inquiry_Id = oap.Inquiry_Id
     ${smJoin}
     ${statusJoins}`;
  };

  await ensurePayloadTable(pool);

  const ACCEPTED_IDS = [8, 9, 10];
  const CLOSED_IDS   = [5, 11, 13, 27];
  const normalizedCategory = statusCategory.trim().toLowerCase();

  // New entries (have a payload record)
  const newConds: string[] = ['(si.IsDelete = 0 OR si.IsDelete IS NULL)'];
  const newParams: any[] = [];
  if (search) {
    newConds.push(
      `(si.Student_Name LIKE ? OR si.Email LIKE ? OR si.Present_Mobile LIKE ? OR CAST(si.Inquiry_Id AS CHAR) LIKE ?)`
    );
    const like = `%${search}%`;
    newParams.push(like, like, like, like);
  }
  if (dateFrom) { newConds.push('oap.Created_At >= ?'); newParams.push(dateFrom); }
  if (dateTo)   { newConds.push('oap.Created_At <= ?'); newParams.push(dateTo); }
  // Exclude draft autosaves — only forms that were actually submitted.
  if (submittedOnly) { newConds.push("oap.Payload NOT LIKE '%__draftProgress%'"); }
  // formStatus filter: 'filled' = student submitted (OnlineState=23); 'filling' = draft in progress
  if (formStatus === 'filled') {
    newConds.push('si.OnlineState = 23');
  } else if (formStatus === 'filling') {
    newConds.push('(si.OnlineState IS NULL OR si.OnlineState NOT IN (7, 8, 23))');
  }
  const smStatusIdExpr = studentMasterTable
    ? `COALESCE(NULLIF(TRIM(si.OnlineState), ''), sm.Status_id)`
    : `NULLIF(TRIM(si.OnlineState), '')`;
  if (normalizedCategory === 'accepted') {
    newConds.push(`${smStatusIdExpr} IN (${ACCEPTED_IDS.join(',')})`);
  } else if (normalizedCategory === 'closed') {
    newConds.push(`${smStatusIdExpr} IN (${CLOSED_IDS.join(',')})`);
  } else if (normalizedCategory === 'open') {
    newConds.push(`(${smStatusIdExpr} NOT IN (${[...ACCEPTED_IDS, ...CLOSED_IDS].join(',')}) OR ${smStatusIdExpr} IS NULL)`);
  }

  let total = 0;
  let newRows: any[] = [];
  try {
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM (${buildNewQuery(true)} WHERE ${newConds.join(' AND ')}) AS q`,
      newParams
    ) as [any[], any];
    total = Number((countRows as any[])[0]?.total || 0);

    [newRows] = await pool.query(
      `${buildNewQuery(true)} WHERE ${newConds.join(' AND ')} ORDER BY COALESCE(oap.Updated_At, oap.Created_At) DESC, oap.Created_At DESC, si.Inquiry_Id DESC LIMIT ? OFFSET ?`,
      [...newParams, limit, offset]
    ) as [any[], any];
  } catch (e: any) {
    console.warn('[OnlineAdmission] new query with status joins failed, retrying without:', e?.message);
    try {
      const [countRows] = await pool.query(
        `SELECT COUNT(*) AS total FROM (${buildNewQuery(false)} WHERE ${newConds.join(' AND ')}) AS q`,
        newParams
      ) as [any[], any];
      total = Number((countRows as any[])[0]?.total || 0);

      [newRows] = await pool.query(
        `${buildNewQuery(false)} WHERE ${newConds.join(' AND ')} ORDER BY COALESCE(oap.Updated_At, oap.Created_At) DESC, oap.Created_At DESC, si.Inquiry_Id DESC LIMIT ? OFFSET ?`,
        [...newParams, limit, offset]
      ) as [any[], any];
    } catch (e2: any) {
      console.warn('[OnlineAdmission] new query skipped:', e2?.message);
    }
  }

  // Build status options
  const statusOptions: StatusOption[] = [];
  const seen = new Set<number>();
  const push = (id: number, label: string) => {
    if (!Number.isFinite(id) || seen.has(id)) return;
    statusOptions.push({ id, label });
    seen.add(id);
  };
  try {
    if (statusTable && studentMasterTable) {
      const [dbStatuses] = await pool.query(
        `SELECT DISTINCT sm.Status_id as id, COALESCE(MAX(stm.Status),'') as label
         FROM \`${inquiryTable}\` si
         JOIN \`${studentMasterTable}\` sm ON sm.Student_Id = si.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
         LEFT JOIN \`${statusTable}\` stm ON stm.Id = sm.Status_id
        WHERE EXISTS (SELECT 1 FROM ${PAYLOAD_TABLE} oap WHERE oap.Inquiry_Id = si.Inquiry_Id)
          AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
         GROUP BY sm.Status_id ORDER BY sm.Status_id`
      ) as [any[], any];
      for (const r of dbStatuses) push(Number(r.id), r.label);
    }
  } catch { /* ignore */ }
  for (const [id, label] of Object.entries(FALLBACK_STATUSES)) push(Number(id), label);
  statusOptions.sort((a, b) => a.id - b.id);

  const statusLabelMap = Object.fromEntries(statusOptions.map((s) => [s.id, s.label]));

  const rows: any[] = [
    ...(newRows as any[]).map((r) => ({ ...r, Admission_Id: r.Inquiry_Id, IsLegacy: 0 })),
  ].map((r) => {
    const label = String(r.StatusText || statusLabelMap[r.Status_id] || '').trim() || 'Open';
    return {
      ...r,
      Admission_Date: safeDate(r.Admission_Date),
      PayloadCreatedAt: safeDate(r.PayloadCreatedAt),
      PayloadUpdatedAt: safeDate(r.PayloadUpdatedAt),
      DOB: safeDate(r.DOB),
      RazorpayPaid: Boolean(r.RazorpayPaid),
      RazorpayPaymentId: String(r.RazorpayPaymentId || ''),
      RazorpayOrderId: String(r.RazorpayOrderId || ''),
      RazorpayAmount: r.RazorpayAmount != null ? Number(r.RazorpayAmount) : null,
      StatusLabel: label,
      StatusCategory: resolveCategory(Number(r.Status_id), label),
    };
  });
  return {
    rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    statusOptions,
  };
}

export async function submitOnlineAdmission(
  input: SubmitAdmissionInput,
  uploads?: AdmissionUploadBundle
): Promise<{ inquiryId: number; studentId: number | null }> {
  const { inquiryId, firstName, middleName, lastName, email, mobile, batchCode, ...rest } = input;

  if (!Number.isFinite(inquiryId) || inquiryId <= 0) throw new Error('Invalid Inquiry ID');

  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);

  const [siRows] = await pool.query(
    `SELECT Inquiry_Id, Student_Name, Email FROM \`${inquiryTable}\`
     WHERE Inquiry_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
    [inquiryId]
  ) as [any[], any];
  if (!siRows.length) throw Object.assign(new Error('Inquiry not found'), { status: 404 });
  const inquiry = siRows[0];

  // Strip File objects from KT arrays before persisting
  const stripFiles = (arr: any[]) =>
    Array.isArray(arr)
      ? arr.map((row: any) => {
          const cleanRow = { ...row };
          delete cleanRow.marksheetFile;
          return cleanRow;
        })
      : arr;

  const cleanBody = {
    ...input,
    ssc_ktDetails: stripFiles(rest.ssc_ktDetails),
    hsc_ktDetails: stripFiles(rest.hsc_ktDetails),
    diploma_ktDetails: stripFiles(rest.diploma_ktDetails),
    grad_ktDetails: stripFiles(rest.grad_ktDetails),
    postgrad_ktDetails: stripFiles(rest.postgrad_ktDetails),
  };

  await ensurePayloadTable(pool);
  await pool.query(
    `INSERT INTO ${PAYLOAD_TABLE} (Inquiry_Id, Payload)
     VALUES (?, ?) ON DUPLICATE KEY UPDATE Payload=VALUES(Payload), Updated_At=NOW()`,
    [inquiryId, JSON.stringify(cleanBody)]
  );
  try { await saveStructuredAdmissionData(inquiryId, cleanBody); } catch (e) {
    console.warn('[OnlineAdmission] saveStructuredAdmissionData failed on submit:', e);
  }

  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
  try {
    await pool.query(
      `UPDATE \`${inquiryTable}\`
       SET OnlineState=23,
           Student_Name=COALESCE(NULLIF(?,''), Student_Name),
           Email=COALESCE(NULLIF(?,''), Email),
           Present_Mobile=COALESCE(NULLIF(?,''), Present_Mobile),
           Batch_Code=COALESCE(NULLIF(?,''), Batch_Code)
       WHERE Inquiry_Id=?`,
      [fullName || null, email || null, mobile || null, batchCode || null, inquiryId]
    );
  } catch (e: any) {
    console.warn('[OnlineAdmission] Student_Inquiry update skipped:', e?.message);
  }

  await syncOnlineAdmissionIntoCurrentDb(inquiryId, cleanBody, { statusAction: 'update' });

  const studentId = await resolveStudentIdForInquiry(pool, inquiryId);
  if (hasAdmissionUploads(uploads) && studentId) {
    await saveAdmissionAssetsForStudent(studentId, uploads);
  }

  const recipientEmail = String(email || inquiry.Email || '').trim();
  const studentName = fullName || String(inquiry.Student_Name || '').trim();
  if (recipientEmail) {
    try {
      await sendOnlineAdmissionSubmissionEmail({
        toEmail: recipientEmail,
        studentName,
        applicationId: inquiryId,
      });
    } catch (e) {
      console.error('[OnlineAdmission] confirmation email error:', e);
    }
  }

  return { inquiryId, studentId };
}
