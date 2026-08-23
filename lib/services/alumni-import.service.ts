/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from 'xlsx';
import { getPool } from '@/lib/db';
import { ensureAlumniColumn } from '@/lib/student-alumni';
import { normalizeMobile } from '@/lib/services/person.service';

// Fixed, named header mapping — the single source of truth for column names expected
// from the Sitians Alumni portal export. If a future re-import is missing one of these
// exact headers, parsing fails loudly (see parseAlumniCsv) instead of silently drifting.
const HEADERS = {
  FIRST_NAME: 'First Name',
  LAST_NAME: 'Last Name',
  PHONE: 'Phone',
} as const;

const REQUIRED_HEADERS = [HEADERS.FIRST_NAME, HEADERS.LAST_NAME, HEADERS.PHONE];

export interface AlumniCsvRow {
  csvName: string;
  csvPhone: string;
  firstName: string;
  lastName: string;
}

export interface AlumniMatch {
  csvName: string;
  csvPhone: string;
  matchType: 'phone' | 'name';
  studentId: number;
  studentName: string;
  currentAlumniStatus: string | null;
}

export interface AlumniPreviewResult {
  totalRows: number;
  matches: AlumniMatch[];
  unmatched: AlumniCsvRow[];
}

/** Parses the alumni CSV/XLSX export. Auto-detects the header row (the export has a
 * blank line and a "Filters : none" line before it) by scanning for the first row
 * containing the expected column names, rather than a hardcoded line offset. */
export function parseAlumniCsv(buffer: Buffer): AlumniCsvRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const headerRowIdx = raw.findIndex((row) =>
    REQUIRED_HEADERS.every((h) => row.some((cell) => String(cell).trim() === h))
  );
  if (headerRowIdx === -1) {
    const missing = REQUIRED_HEADERS.join(', ');
    throw Object.assign(
      new Error(`Could not find a header row containing all expected columns: ${missing}`),
      { status: 422 }
    );
  }

  const headers = raw[headerRowIdx].map((h) => String(h).trim());
  const colIndex = (name: string) => headers.indexOf(name);
  const firstNameIdx = colIndex(HEADERS.FIRST_NAME);
  const lastNameIdx = colIndex(HEADERS.LAST_NAME);
  const phoneIdx = colIndex(HEADERS.PHONE);

  return raw
    .slice(headerRowIdx + 1)
    .filter((row) => row.some((cell) => String(cell ?? '').trim()))
    .map((row) => {
      const firstName = String(row[firstNameIdx] ?? '').trim();
      const lastName = String(row[lastNameIdx] ?? '').trim();
      const csvPhone = String(row[phoneIdx] ?? '').trim();
      return {
        csvName: [firstName, lastName].filter(Boolean).join(' '),
        csvPhone,
        firstName,
        lastName,
      };
    })
    .filter((row) => row.firstName || row.lastName);
}

const MOBILE_NORMALIZE_EXPR = (col: string) =>
  `RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(${col}),' ',''),'-',''),'+',''),'(',''),')',''),10)`;

/** Matches CSV rows against student_master: phone first (primary/most reliable key in
 * this export), falling back to an exact first+last name match when phone is missing,
 * ambiguous (shared by multiple students), or doesn't match. Read-only. */
export async function matchAlumniRows(rows: AlumniCsvRow[]): Promise<AlumniPreviewResult> {
  const pool = getPool();
  const matches: AlumniMatch[] = [];
  const unmatched: AlumniCsvRow[] = [];

  for (const row of rows) {
    const normalizedPhone = normalizeMobile(row.csvPhone);
    let matched: { Student_Id: number; Student_Name: string; Alumni_Registered: string | null } | null = null;
    let matchType: 'phone' | 'name' | null = null;

    if (normalizedPhone) {
      const [phoneRows] = await pool.query(
        `SELECT Student_Id, Student_Name, Alumni_Registered
         FROM student_master
         WHERE (IsDelete = 0 OR IsDelete IS NULL)
           AND (
             ${MOBILE_NORMALIZE_EXPR('Present_Mobile')} = ?
             OR ${MOBILE_NORMALIZE_EXPR('Present_Mobile2')} = ?
           )
         LIMIT 2`,
        [normalizedPhone, normalizedPhone]
      );
      const found = phoneRows as any[];
      if (found.length === 1) {
        matched = found[0];
        matchType = 'phone';
      }
    }

    if (!matched && row.firstName && row.lastName) {
      const [nameRows] = await pool.query(
        `SELECT Student_Id, Student_Name, Alumni_Registered
         FROM student_master
         WHERE (IsDelete = 0 OR IsDelete IS NULL)
           AND LOWER(TRIM(FName)) = LOWER(TRIM(?))
           AND LOWER(TRIM(LName)) = LOWER(TRIM(?))
         LIMIT 2`,
        [row.firstName, row.lastName]
      );
      const found = nameRows as any[];
      if (found.length === 1) {
        matched = found[0];
        matchType = 'name';
      }
    }

    if (matched && matchType) {
      matches.push({
        csvName: row.csvName,
        csvPhone: row.csvPhone,
        matchType,
        studentId: matched.Student_Id,
        studentName: matched.Student_Name,
        currentAlumniStatus: matched.Alumni_Registered,
      });
    } else {
      unmatched.push(row);
    }
  }

  return { totalRows: rows.length, matches, unmatched };
}

let importLogTableReady = false;

async function ensureImportLogTable(pool: ReturnType<typeof getPool>): Promise<void> {
  if (importLogTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alumni_import_log (
      Id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      File_Name VARCHAR(255) NULL,
      Total_Rows INT NOT NULL DEFAULT 0,
      Matched_Count INT NOT NULL DEFAULT 0,
      Applied_Count INT NOT NULL DEFAULT 0,
      Imported_By INT NULL,
      Imported_At TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (Id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  importLogTableReady = true;
}

/** Marks the given students as registered alumni. Idempotent — already-'Yes' students
 * are a no-op. Logs one summary row per apply for basic audit traceability. */
export async function applyAlumniMatches(opts: {
  studentIds: number[];
  fileName?: string | null;
  totalRows: number;
  matchedCount: number;
  importedBy?: number | null;
}): Promise<{ updatedCount: number }> {
  const pool = getPool();
  await ensureAlumniColumn(pool);
  await ensureImportLogTable(pool);

  const uniqueIds = [...new Set(opts.studentIds)].filter((id) => Number.isInteger(id) && id > 0);
  let updatedCount = 0;
  if (uniqueIds.length > 0) {
    const placeholders = uniqueIds.map(() => '?').join(',');
    const [result] = await pool.query<any>(
      `UPDATE student_master
       SET Alumni_Registered = 'Yes'
       WHERE Student_Id IN (${placeholders})
         AND (Alumni_Registered IS NULL OR Alumni_Registered <> 'Yes')`,
      uniqueIds
    );
    updatedCount = Number(result.affectedRows || 0);
  }

  await pool.query(
    `INSERT INTO alumni_import_log (File_Name, Total_Rows, Matched_Count, Applied_Count, Imported_By)
     VALUES (?, ?, ?, ?, ?)`,
    [opts.fileName || null, opts.totalRows, opts.matchedCount, uniqueIds.length, opts.importedBy || null]
  );

  return { updatedCount };
}
