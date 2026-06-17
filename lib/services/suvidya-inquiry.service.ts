import type mysql from 'mysql2/promise';
import { cached, getPool } from '@/lib/db';
import { resolveInquiryTableName } from '@/lib/services/inquiry.service';

const DEFAULT_SUVIDYA_INQUIRY_API_URL = 'https://suvidya.ac.in/admission/GetInquiry.php';

type StudentInquirySyncTextField =
  | 'Student_Name'
  | 'Present_Mobile'
  | 'Email'
  | 'Discussion'
  | 'Inquiry_From'
  | 'Inquiry_Type'
  | 'Qualification';

interface SuvidyaInquiryRecord {
  table_name?: unknown;
  id?: unknown;
  first_name?: unknown;
  email_id?: unknown;
  // Phone — many field names observed across Suvidya form types
  phone?: unknown;
  mobile?: unknown;
  phone_number?: unknown;
  contact?: unknown;
  contact_number?: unknown;
  whatsapp?: unknown;
  whatsapp_number?: unknown;
  your_mobile?: unknown;
  your_phone?: unknown;
  your_number?: unknown;
  mobile_no?: unknown;
  phone_no?: unknown;
  mob_no?: unknown;
  mob?: unknown;
  tel?: unknown;
  telephone?: unknown;
  cell?: unknown;
  cellphone?: unknown;
  student_mobile?: unknown;
  student_phone?: unknown;
  number?: unknown;
  select_qualification?: unknown;
  your_location?: unknown;
  select_course?: unknown;
  page_source?: unknown;
  created_date?: unknown;
  [key: string]: unknown;
}

interface SuvidyaInquiryApiResponse {
  status?: unknown;
  total_records?: unknown;
  data?: unknown;
}

export interface SyncSuvidyaInquiryOptions {
  apiUrl?: string;
  sinceHours?: number;
  maxRecords?: number;
  puneOnly?: boolean;
  fetchImpl?: typeof fetch;
}

export interface SyncSuvidyaInquirySummary {
  apiUrl: string;
  fetched: number;
  considered: number;
  created: number;
  createdWithoutPhone: number;
  skippedExisting: number;
  skippedInvalid: number;
  skippedOld: number;
  skippedNonPune: number;
  failed: number;
  totalRecordsHint: number | null;
}

const SUVIDYA_SYNC_DB_LOCK_MAIN = 'sit:suvidya_inquiry_sync:main';
const SUVIDYA_SYNC_DB_LOCK_PUNE = 'sit:suvidya_inquiry_sync:pune';

function normalizeText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizePhoneText(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  const digits = text.replace(/\D/g, '');
  if (!digits) return null;

  // Filter overflow / garbage values the legacy source sometimes emits.
  if (digits === '2147483647' || digits === '9999999999' || /^0+$/.test(digits)) return null;

  // Must have at least 10 digits to be a valid Indian mobile.
  if (digits.length < 10) return null;

  // Strip country code: take the last 10 digits for Indian mobiles.
  // e.g. "919876543210" (12 digits) → "9876543210"
  //      "+91 98765 43210" (12 digits stripped) → "9876543210"
  const normalized = digits.length > 10 ? digits.slice(-10) : digits;

  // Reject sequences that are clearly not mobile numbers.
  if (/^0+$/.test(normalized)) return null;

  return normalized;
}

function normalizeMobileForDedup(value: unknown): string | null {
  const normalized = normalizePhoneText(value);
  if (!normalized) return null;
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

function normalizeEmailForDedup(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const lowered = text.toLowerCase();
  return lowered.includes('@') ? lowered : null;
}

// Ordered list of field names to try when extracting a phone number.
// More specific names come first so we don't accidentally pick up a
// "contact" field that stores free-text rather than a number.
const PHONE_FIELD_CANDIDATES = [
  'phone', 'mobile', 'phone_number', 'mobile_number',
  'your_mobile', 'your_phone', 'your_number',
  'mobile_no', 'phone_no', 'mob_no', 'mob',
  'tel', 'telephone', 'cell', 'cellphone',
  'student_mobile', 'student_phone',
  'contact_number', 'contact', 'whatsapp', 'whatsapp_number',
  'number',
] as const;

function pickRawPhoneText(record: SuvidyaInquiryRecord): string | null {
  // 1. Try known field names in priority order
  for (const field of PHONE_FIELD_CANDIDATES) {
    const value = normalizeText(record[field]);
    if (value) return value;
  }

  // 2. Generic fallback: scan every value in the payload for a phone-shaped string.
  //    This catches any field name the API might introduce in the future.
  for (const [key, raw] of Object.entries(record)) {
    if (key === 'id' || key === 'table_name' || key === 'first_name' ||
        key === 'email_id' || key === 'select_qualification' ||
        key === 'your_location' || key === 'select_course' ||
        key === 'page_source' || key === 'created_date') continue;

    const text = normalizeText(raw);
    if (!text) continue;
    // Must look like a phone: mostly digits, at least 10 of them
    const digits = text.replace(/[\s\-\+\(\)\.]/g, '');
    if (/^\d{10,15}$/.test(digits)) return text;
  }

  return null;
}

function extractPhoneForSync(record: SuvidyaInquiryRecord): string | null {
  const raw = pickRawPhoneText(record);
  if (!raw) return null;

  const normalized = normalizePhoneText(raw);
  if (normalized) return normalized;

  // Both form types can emit slightly truncated values (9 digits instead of 10).
  // Keep the raw digits rather than silently dropping the phone entirely.
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 9 && digits.length <= 15) return digits;

  return null;
}

function normalizeCourseKey(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function toPositiveInt(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function parseSuvidyaDate(value: unknown): Date | null {
  const raw = normalizeText(value);
  if (!raw) return null;

  const mysqlLike = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (mysqlLike) {
    const [, year, month, day, hour, minute, second = '00'] = mysqlLike;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinSinceHours(createdDate: unknown, sinceHours: number | undefined): boolean {
  if (!sinceHours || !Number.isFinite(sinceHours) || sinceHours <= 0) return true;
  const parsed = parseSuvidyaDate(createdDate);
  if (!parsed) return true;
  return parsed.getTime() >= Date.now() - sinceHours * 60 * 60 * 1000;
}

function isPuneRecord(record: SuvidyaInquiryRecord): boolean {
  const location = normalizeText(record.your_location)?.toLowerCase() || '';
  const source = normalizeText(record.page_source)?.toLowerCase() || '';
  return location.includes('pune') || source.includes('pune');
}

function mapInquiryType(tableName: string | null): string {
  if (tableName === 'quick_enquiry_form') return 'Quick Inquiry';
  return 'Online Inquiry';
}

function summarizeInquirySource(pageSource: string | null): string | null {
  if (!pageSource) return 'Suvidya Website';

  try {
    const url = new URL(pageSource);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/' || path === '') return url.hostname;

    const lastSegment = path.split('/').filter(Boolean).pop();
    if (!lastSegment) return url.hostname;

    const label = lastSegment
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return label || url.hostname;
  } catch {
    return pageSource;
  }
}

async function getStudentInquiryColumnMaxLength(
  queryable: mysql.Pool | mysql.PoolConnection,
  inquiryTable: string,
  columnName: StudentInquirySyncTextField
): Promise<number | null> {
  return cached(
    `schema:student-inquiry-maxlen:${inquiryTable}:${columnName}`,
    60 * 60 * 1000,
    async () => {
      const [rows] = await queryable.query(
        `SELECT CHARACTER_MAXIMUM_LENGTH
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [inquiryTable, columnName]
      );

      const maxLength = Number((rows as Array<{ CHARACTER_MAXIMUM_LENGTH?: unknown }>)[0]?.CHARACTER_MAXIMUM_LENGTH ?? null);
      return Number.isFinite(maxLength) && maxLength > 0 ? maxLength : null;
    }
  );
}

async function fitStudentInquiryText(
  queryable: mysql.Pool | mysql.PoolConnection,
  inquiryTable: string,
  columnName: StudentInquirySyncTextField,
  value: string | null
): Promise<string | null> {
  if (!value) return null;

  const maxLength = await getStudentInquiryColumnMaxLength(queryable, inquiryTable, columnName);
  if (!maxLength || value.length <= maxLength) return value;

  return value.slice(0, maxLength).trim() || value.slice(0, maxLength);
}

function buildDiscussion(record: {
  tableName: string | null;
  sourceId: number;
  location: string | null;
  pageSource: string | null;
  courseName: string | null;
  matchedCourseId: number | null;
}): string {
  const parts = [`Imported from Suvidya ${record.tableName || 'inquiry'} #${record.sourceId}`];

  if (record.location) parts.push(`Location: ${record.location}`);
  if (record.pageSource) parts.push(`Source: ${record.pageSource}`);
  if (record.courseName && !record.matchedCourseId) parts.push(`Course: ${record.courseName}`);

  return parts.join(' | ');
}

async function ensureSuvidyaSyncTable(pool: mysql.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS suvidya_inquiry_sync (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      source_table_name VARCHAR(100) NOT NULL,
      source_inquiry_id BIGINT NOT NULL,
      inquiry_id INT NULL,
      student_name VARCHAR(255) NULL,
      email VARCHAR(191) NULL,
      mobile VARCHAR(30) NULL,
      course_name VARCHAR(255) NULL,
      page_source VARCHAR(255) NULL,
      created_date VARCHAR(100) NULL,
      payload_json LONGTEXT NULL,
      synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_suvidya_source (source_table_name, source_inquiry_id),
      KEY idx_suvidya_inquiry_id (inquiry_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function loadCourseMap(pool: mysql.Pool): Promise<Map<string, number>> {
  const [rows] = await pool.query(
    `SELECT Course_Id, Course_Name
     FROM course_mst
     WHERE Course_Id IS NOT NULL
       AND Course_Name IS NOT NULL
       AND TRIM(Course_Name) != ''`
  );

  const map = new Map<string, number>();
  for (const row of rows as Array<{ Course_Id?: unknown; Course_Name?: unknown }>) {
    const courseId = toPositiveInt(row.Course_Id);
    const courseName = normalizeText(row.Course_Name);
    if (!courseId || !courseName) continue;
    map.set(normalizeCourseKey(courseName), courseId);
  }

  return map;
}

async function insertInquiry(
  connection: mysql.PoolConnection,
  inquiryTable: string,
  payload: {
    studentName: string;
    mobile: string | null;
    email: string | null;
    qualification: string | null;
    inquiryDate: string;
    inquiryFrom: string | null;
    inquiryType: string;
    courseId: number | null;
    discussion: string;
  }
): Promise<number> {
  const studentName = await fitStudentInquiryText(connection, inquiryTable, 'Student_Name', payload.studentName);
  const mobile = await fitStudentInquiryText(connection, inquiryTable, 'Present_Mobile', payload.mobile);
  const email = await fitStudentInquiryText(connection, inquiryTable, 'Email', payload.email);
  const discussion = await fitStudentInquiryText(connection, inquiryTable, 'Discussion', payload.discussion);
  const inquiryFrom = await fitStudentInquiryText(connection, inquiryTable, 'Inquiry_From', payload.inquiryFrom);
  const inquiryType = await fitStudentInquiryText(connection, inquiryTable, 'Inquiry_Type', payload.inquiryType);
  const qualification = await fitStudentInquiryText(connection, inquiryTable, 'Qualification', payload.qualification);

  const [result] = await connection.query(
    `INSERT INTO \`${inquiryTable}\` (
      Student_Name,
      Present_Mobile,
      Email,
      Discussion,
      OnlineState,
      Inquiry_Dt,
      Inquiry_From,
      Inquiry_Type,
      Course_Id,
      Qualification,
      IsDelete,
      Inquiry,
      Date_Added
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'Inquiry', NOW())`,
    [
      studentName,
      mobile,
      email,
      discussion,
      1,
      payload.inquiryDate,
      inquiryFrom,
      inquiryType,
      payload.courseId,
      qualification,
    ]
  );

  const insertId = Number((result as { insertId?: unknown }).insertId || 0);
  if (!Number.isFinite(insertId) || insertId <= 0) {
    throw new Error('Failed to create local inquiry for Suvidya record');
  }

  await connection.query(
    `INSERT INTO awt_inquirydiscussion (Inquiry_id, date, discussion, deleted, created_by, created_date)
     VALUES (?, CURDATE(), ?, 0, 1, NOW())`,
    [insertId, discussion]
  );

  return insertId;
}

async function acquireSyncLock(connection: mysql.PoolConnection, lockName: string): Promise<boolean> {
  const [rows] = await connection.query(
    'SELECT GET_LOCK(?, 0) AS acquired',
    [lockName]
  );

  return Number((rows as Array<{ acquired?: unknown }>)[0]?.acquired ?? 0) === 1;
}

async function releaseSyncLock(connection: mysql.PoolConnection, lockName: string): Promise<void> {
  try {
    await connection.query('DO RELEASE_LOCK(?)', [lockName]);
  } catch {
    // Best-effort; connection close also releases named locks.
  }
}

export async function syncSuvidyaInquiries(
  options: SyncSuvidyaInquiryOptions = {}
): Promise<SyncSuvidyaInquirySummary> {
  const apiUrl = normalizeText(options.apiUrl)
    || normalizeText(process.env.SUVIDYA_INQUIRY_API_URL)
    || DEFAULT_SUVIDYA_INQUIRY_API_URL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const pool = getPool();

  const summary: SyncSuvidyaInquirySummary = {
    apiUrl,
    fetched: 0,
    considered: 0,
    created: 0,
    createdWithoutPhone: 0,
    skippedExisting: 0,
    skippedInvalid: 0,
    skippedOld: 0,
    skippedNonPune: 0,
    failed: 0,
    totalRecordsHint: null,
  };

  const lockName = options.puneOnly ? SUVIDYA_SYNC_DB_LOCK_PUNE : SUVIDYA_SYNC_DB_LOCK_MAIN;

  const syncConnection = await pool.getConnection();

  try {
    const hasLock = await acquireSyncLock(syncConnection, lockName);
    if (!hasLock) {
      throw new Error(`Suvidya inquiry sync is already running for lock ${lockName}`);
    }

    await syncConnection.query('SET SESSION innodb_lock_wait_timeout = 5');

    await ensureSuvidyaSyncTable(pool);
    const courseMap = await loadCourseMap(pool);

    const response = await fetchImpl(apiUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'sitmanager/1.0',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Suvidya API request failed with status ${response.status}`);
    }

    const payload = await response.json() as SuvidyaInquiryApiResponse;
    const allRecords = Array.isArray(payload.data) ? payload.data as SuvidyaInquiryRecord[] : [];
    const maxRecords = Number.isFinite(options.maxRecords) && Number(options.maxRecords) > 0
      ? Math.trunc(Number(options.maxRecords))
      : null;
    const filteredRecords = allRecords
      .filter((record) => isWithinSinceHours(record.created_date, options.sinceHours));
    const scopedRecords = options.puneOnly
      ? filteredRecords.filter((record) => isPuneRecord(record))
      : filteredRecords;
    // Sort newest-first before capping so the most recent leads are always processed
    // even when the API returns more records than the safety limit allows.
    const sortedRecords = scopedRecords.slice().sort((a, b) => {
      const ta = parseSuvidyaDate(a.created_date)?.getTime() ?? 0;
      const tb = parseSuvidyaDate(b.created_date)?.getTime() ?? 0;
      return tb - ta;
    });
    const consideredRecords = maxRecords ? sortedRecords.slice(0, maxRecords) : sortedRecords;

    summary.fetched = allRecords.length;
    summary.considered = consideredRecords.length;
    summary.skippedOld = allRecords.length - filteredRecords.length;
    summary.skippedNonPune = filteredRecords.length - scopedRecords.length;
    summary.totalRecordsHint = toPositiveInt(payload.total_records);

    const inquiryTable = await resolveInquiryTableName(pool);

    // Pre-validate records and batch-check which ones already exist.
    // This replaces N sequential SELECTs with a single query, which is the main
    // cause of the 30-second timeout on large syncs.
    type ValidRecord = { record: SuvidyaInquiryRecord; sourceId: number; tableName: string; studentName: string };
    const validRecords: ValidRecord[] = [];
    for (const record of consideredRecords) {
      const sourceId = toPositiveInt(record.id);
      const tableName = normalizeText(record.table_name);
      const studentName = normalizeText(record.first_name);
      if (!sourceId || !tableName || !studentName) {
        summary.skippedInvalid += 1;
      } else {
        validRecords.push({ record, sourceId, tableName, studentName });
      }
    }

    // One query to find all already-synced records in this batch
    const existingRowsByKey = new Map<string, { inquiry_id: number | null; mobile: string | null }>();
    if (validRecords.length > 0) {
      const whereParts = validRecords.map(() => '(source_table_name = ? AND source_inquiry_id = ?)').join(' OR ');
      const whereParams = validRecords.flatMap(({ tableName, sourceId }) => [tableName, sourceId]);
      const [existingRows] = await syncConnection.query(
        `SELECT source_table_name, source_inquiry_id, inquiry_id, mobile
         FROM suvidya_inquiry_sync
         WHERE ${whereParts}`,
        whereParams
      );
      for (const row of existingRows as Array<{ source_table_name: string; source_inquiry_id: number; inquiry_id: number | null; mobile: string | null }>) {
        existingRowsByKey.set(`${row.source_table_name}:${row.source_inquiry_id}`, {
          inquiry_id: row.inquiry_id ?? null,
          mobile: normalizeText(row.mobile),
        });
      }
    }

    // Batch-check existing inquiry contacts so we do not create duplicates when
    // Suvidya sends the same lead with a new source id.
    const incomingMobiles = Array.from(new Set(
      validRecords
        .map(({ record }) => normalizeMobileForDedup(extractPhoneForSync(record)))
        .filter((v): v is string => Boolean(v))
    ));
    const incomingEmails = Array.from(new Set(
      validRecords
        .map(({ record }) => normalizeEmailForDedup(record.email_id))
        .filter((v): v is string => Boolean(v))
    ));

    const existingInquiryByMobile = new Map<string, number>();
    const existingInquiryByEmail = new Map<string, number>();
    if (incomingMobiles.length > 0 || incomingEmails.length > 0) {
      const conditions: string[] = [];
      const params: Array<string | number> = [];

      if (incomingMobiles.length > 0) {
        const ph = incomingMobiles.map(() => '?').join(', ');
        conditions.push(`RIGHT(REGEXP_REPLACE(COALESCE(Present_Mobile,''),'[^0-9]',''), 10) IN (${ph})`);
        params.push(...incomingMobiles);
      }
      if (incomingEmails.length > 0) {
        const ph = incomingEmails.map(() => '?').join(', ');
        conditions.push(`LOWER(TRIM(COALESCE(Email,''))) IN (${ph})`);
        params.push(...incomingEmails);
      }

      const [existingInquiryRows] = await syncConnection.query(
        `SELECT Inquiry_Id, Present_Mobile, Email
         FROM \`${inquiryTable}\`
         WHERE (IsDelete = 0 OR IsDelete IS NULL)
           AND (${conditions.join(' OR ')})
         ORDER BY Inquiry_Id DESC`,
        params
      );

      for (const row of existingInquiryRows as Array<{ Inquiry_Id: number; Present_Mobile: string | null; Email: string | null }>) {
        const inquiryId = Number(row.Inquiry_Id);
        if (!Number.isFinite(inquiryId) || inquiryId <= 0) continue;
        const mobileKey = normalizeMobileForDedup(row.Present_Mobile);
        const emailKey = normalizeEmailForDedup(row.Email);
        if (mobileKey && !existingInquiryByMobile.has(mobileKey)) existingInquiryByMobile.set(mobileKey, inquiryId);
        if (emailKey && !existingInquiryByEmail.has(emailKey)) existingInquiryByEmail.set(emailKey, inquiryId);
      }
    }

    for (const { record, sourceId, tableName, studentName } of validRecords) {
      const existing = existingRowsByKey.get(`${tableName}:${sourceId}`);
      if (existing) {
        // Repair path: if an existing synced row has empty mobile, try updating it from latest source payload.
        if (!existing.mobile) {
          const repairedMobile = extractPhoneForSync(record);
          if (repairedMobile) {
            try {
              await syncConnection.query(
                `UPDATE suvidya_inquiry_sync
                 SET mobile = ?
                 WHERE source_table_name = ? AND source_inquiry_id = ?`,
                [repairedMobile, tableName, sourceId]
              );

              if (existing.inquiry_id) {
                await syncConnection.query(
                  `UPDATE \`${inquiryTable}\`
                   SET Present_Mobile = COALESCE(NULLIF(Present_Mobile, ''), ?)
                   WHERE Inquiry_Id = ?`,
                  [repairedMobile, existing.inquiry_id]
                );
              }
            } catch (error) {
              console.error('Suvidya inquiry mobile repair failed:', {
                tableName,
                sourceId,
                error,
              });
            }
          }
        }
        summary.skippedExisting += 1;
        continue;
      }

      const email = normalizeText(record.email_id);
      const mobile = extractPhoneForSync(record);
      const qualification = normalizeText(record.select_qualification);
      const location = normalizeText(record.your_location);
      const courseName = normalizeText(record.select_course);
      const fullPageSource = normalizeText(record.page_source);
      const pageSource = summarizeInquirySource(fullPageSource) || 'Suvidya Website';
      const inquiryDate = normalizeText(record.created_date) || new Date().toISOString().slice(0, 19).replace('T', ' ');
      const matchedCourseId = courseName ? (courseMap.get(normalizeCourseKey(courseName)) ?? null) : null;
      const discussion = buildDiscussion({
        tableName,
        sourceId,
        location,
        pageSource: fullPageSource,
        courseName,
        matchedCourseId,
      });

      const mobileDedupKey = normalizeMobileForDedup(mobile);
      const emailDedupKey = normalizeEmailForDedup(email);
      const duplicateInquiryId =
        (mobileDedupKey ? existingInquiryByMobile.get(mobileDedupKey) : undefined)
        ?? (emailDedupKey ? existingInquiryByEmail.get(emailDedupKey) : undefined)
        ?? null;

      if (duplicateInquiryId) {
        await syncConnection.query(
          `INSERT INTO suvidya_inquiry_sync (
             source_table_name,
             source_inquiry_id,
             inquiry_id,
             student_name,
             email,
             mobile,
             course_name,
             page_source,
             created_date,
             payload_json
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             inquiry_id = COALESCE(inquiry_id, VALUES(inquiry_id)),
             email = COALESCE(NULLIF(email, ''), VALUES(email)),
             mobile = COALESCE(NULLIF(mobile, ''), VALUES(mobile)),
             payload_json = VALUES(payload_json)`,
          [
            tableName,
            sourceId,
            duplicateInquiryId,
            studentName,
            email,
            mobile,
            courseName,
            pageSource,
            inquiryDate,
            JSON.stringify(record),
          ]
        );
        summary.skippedExisting += 1;
        continue;
      }

      try {
        const inquiryId = await insertInquiry(syncConnection, inquiryTable, {
          studentName,
          mobile,
          email,
          qualification,
          inquiryDate,
          inquiryFrom: pageSource,
          inquiryType: mapInquiryType(tableName),
          courseId: matchedCourseId,
          discussion,
        });

        await syncConnection.query(
          `INSERT INTO suvidya_inquiry_sync (
            source_table_name,
            source_inquiry_id,
            inquiry_id,
            student_name,
            email,
            mobile,
            course_name,
            page_source,
            created_date,
            payload_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tableName,
            sourceId,
            inquiryId,
            studentName,
            email,
            mobile,
            courseName,
            pageSource,
            inquiryDate,
            JSON.stringify(record),
          ]
        );

        summary.created += 1;
        if (!mobile) summary.createdWithoutPhone += 1;
      } catch (error) {
        summary.failed += 1;
        console.error('Suvidya inquiry sync record failed:', {
          tableName,
          sourceId,
          error,
        });
      }
    }

    return summary;
  } finally {
    await releaseSyncLock(syncConnection, lockName);
    syncConnection.release();
  }
}