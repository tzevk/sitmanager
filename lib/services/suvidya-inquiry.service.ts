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
  phone?: unknown;
  select_qualification?: unknown;
  your_location?: unknown;
  select_course?: unknown;
  page_source?: unknown;
  created_date?: unknown;
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
  fetchImpl?: typeof fetch;
}

export interface SyncSuvidyaInquirySummary {
  apiUrl: string;
  fetched: number;
  considered: number;
  created: number;
  skippedExisting: number;
  skippedInvalid: number;
  skippedOld: number;
  failed: number;
  totalRecordsHint: number | null;
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
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

export async function syncSuvidyaInquiries(
  options: SyncSuvidyaInquiryOptions = {}
): Promise<SyncSuvidyaInquirySummary> {
  const apiUrl = normalizeText(options.apiUrl)
    || normalizeText(process.env.SUVIDYA_INQUIRY_API_URL)
    || DEFAULT_SUVIDYA_INQUIRY_API_URL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const pool = getPool();

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
  const consideredRecords = maxRecords ? filteredRecords.slice(0, maxRecords) : filteredRecords;

  const summary: SyncSuvidyaInquirySummary = {
    apiUrl,
    fetched: allRecords.length,
    considered: consideredRecords.length,
    created: 0,
    skippedExisting: 0,
    skippedInvalid: 0,
    skippedOld: allRecords.length - filteredRecords.length,
    failed: 0,
    totalRecordsHint: toPositiveInt(payload.total_records),
  };

  const inquiryTable = await resolveInquiryTableName(pool);

  for (const record of consideredRecords) {
    const sourceId = toPositiveInt(record.id);
    const tableName = normalizeText(record.table_name);
    const studentName = normalizeText(record.first_name);

    if (!sourceId || !tableName || !studentName) {
      summary.skippedInvalid += 1;
      continue;
    }

    const [existingRows] = await pool.query(
      `SELECT inquiry_id
       FROM suvidya_inquiry_sync
       WHERE source_table_name = ? AND source_inquiry_id = ?
       LIMIT 1`,
      [tableName, sourceId]
    );

    if ((existingRows as unknown[]).length > 0) {
      summary.skippedExisting += 1;
      continue;
    }

    const email = normalizeText(record.email_id);
    const mobile = normalizeText(record.phone);
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

    let connection: mysql.PoolConnection | null = null;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const inquiryId = await insertInquiry(connection, inquiryTable, {
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

      await connection.query(
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

      await connection.commit();
      summary.created += 1;
    } catch (error) {
      summary.failed += 1;
      if (connection) {
        await connection.rollback().catch(() => {});
      }
      console.error('Suvidya inquiry sync record failed:', {
        tableName,
        sourceId,
        error,
      });
    } finally {
      connection?.release();
    }
  }

  return summary;
}