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
  EMAIL: 'E-mail',
  PHONE: 'Phone',
  SECONDARY_EMAIL: 'secondary_email',
  DOB: 'DoB',
  BATCH_NUMBER: 'Batch Number (eg.01157)',
  TRAINING_PROGRAM: 'Training Program',
} as const;

const REQUIRED_HEADERS = [HEADERS.FIRST_NAME, HEADERS.LAST_NAME, HEADERS.PHONE];

// The full set of CSV columns shown in the preview table — same names/order as the
// Excel/CSV export, so the preview reads as "the sheet" rather than a derived view.
export interface AlumniCsvRow {
  csvName: string;
  csvPhone: string;
  firstName: string;
  lastName: string;
  email: string;
  secondaryEmail: string;
  dob: string;
  batchNumber: string;
  trainingProgram: string;
}

export interface AlumniMatch extends AlumniCsvRow {
  matchType: 'phone' | 'name';
  studentId: number;
  studentName: string;
  currentAlumniStatus: string | null;
}

export interface AlumniPreviewResult {
  totalRows: number;
  matches: AlumniMatch[];
  unmatched: AlumniCsvRow[];
  /** Active students with no matching row anywhere in this CSV — i.e. no alumni portal
   * account found for them. These get explicitly marked 'No' on apply (see
   * applyAlumniMatches), not just left blank. */
  noAccountCount: number;
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
  const emailIdx = colIndex(HEADERS.EMAIL);
  const phoneIdx = colIndex(HEADERS.PHONE);
  const secondaryEmailIdx = colIndex(HEADERS.SECONDARY_EMAIL);
  const dobIdx = colIndex(HEADERS.DOB);
  const batchNumberIdx = colIndex(HEADERS.BATCH_NUMBER);
  const trainingProgramIdx = colIndex(HEADERS.TRAINING_PROGRAM);
  const cell = (row: any[], idx: number) => (idx === -1 ? '' : String(row[idx] ?? '').trim());

  return raw
    .slice(headerRowIdx + 1)
    .filter((row) => row.some((c) => String(c ?? '').trim()))
    .map((row) => {
      const firstName = cell(row, firstNameIdx);
      const lastName = cell(row, lastNameIdx);
      return {
        csvName: [firstName, lastName].filter(Boolean).join(' '),
        csvPhone: cell(row, phoneIdx),
        firstName,
        lastName,
        email: cell(row, emailIdx),
        secondaryEmail: cell(row, secondaryEmailIdx),
        dob: cell(row, dobIdx),
        batchNumber: cell(row, batchNumberIdx),
        trainingProgram: cell(row, trainingProgramIdx),
      };
    })
    .filter((row) => row.firstName || row.lastName);
}

interface StudentLookupRow {
  Student_Id: number;
  Student_Name: string;
  FName: string | null;
  LName: string | null;
  Present_Mobile: string | null;
  Present_Mobile2: string | null;
  Alumni_Registered: string | null;
}

function nameKey(first: string, last: string): string {
  return `${first.trim().toLowerCase()}|${last.trim().toLowerCase()}`;
}

/** Matches CSV rows against student_master: phone first (primary/most reliable key in
 * this export), falling back to an exact first+last name match when phone is missing,
 * ambiguous (shared by multiple students), or doesn't match. Read-only.
 *
 * Loads a lean student roster once and matches in memory — no per-row DB query, so this
 * stays fast regardless of file size. */
export async function matchAlumniRows(rows: AlumniCsvRow[]): Promise<AlumniPreviewResult> {
  const pool = getPool();
  const [studentRows] = await pool.query(
    `SELECT Student_Id, Student_Name, FName, LName, Present_Mobile, Present_Mobile2, Alumni_Registered
     FROM student_master
     WHERE (IsDelete = 0 OR IsDelete IS NULL)`
  );
  const students = studentRows as StudentLookupRow[];

  const byMobile = new Map<string, StudentLookupRow[]>();
  const byName = new Map<string, StudentLookupRow[]>();
  for (const s of students) {
    for (const rawMobile of [s.Present_Mobile, s.Present_Mobile2]) {
      const normalized = normalizeMobile(rawMobile);
      if (!normalized) continue;
      const list = byMobile.get(normalized) ?? [];
      if (!list.some((existing) => existing.Student_Id === s.Student_Id)) list.push(s);
      byMobile.set(normalized, list);
    }
    if (s.FName && s.LName) {
      const key = nameKey(s.FName, s.LName);
      const list = byName.get(key) ?? [];
      list.push(s);
      byName.set(key, list);
    }
  }

  const matches: AlumniMatch[] = [];
  const unmatched: AlumniCsvRow[] = [];

  for (const row of rows) {
    let matched: StudentLookupRow | null = null;
    let matchType: 'phone' | 'name' | null = null;

    const normalizedPhone = normalizeMobile(row.csvPhone);
    if (normalizedPhone) {
      const found = byMobile.get(normalizedPhone);
      if (found && found.length === 1) {
        matched = found[0];
        matchType = 'phone';
      }
    }

    if (!matched && row.firstName && row.lastName) {
      const found = byName.get(nameKey(row.firstName, row.lastName));
      if (found && found.length === 1) {
        matched = found[0];
        matchType = 'name';
      }
    }

    if (matched && matchType) {
      matches.push({
        ...row,
        matchType,
        studentId: matched.Student_Id,
        studentName: matched.Student_Name,
        currentAlumniStatus: matched.Alumni_Registered,
      });
    } else {
      unmatched.push(row);
    }
  }

  const matchedStudentIds = new Set(matches.map((m) => m.studentId));
  const noAccountCount = students.filter((s) => !matchedStudentIds.has(s.Student_Id)).length;

  return { totalRows: rows.length, matches, unmatched, noAccountCount };
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

/** Marks the given students as registered alumni ('Yes'), and — unless disabled —
 * everyone else who was never checked before ('No', since they have no matching
 * account anywhere in the CSV) as explicitly not registered. Idempotent: only touches
 * rows that actually need to change, and never overwrites an existing explicit status
 * (e.g. set manually via the Student Master edit page) with 'No'. Logs one summary
 * row per apply for basic audit traceability. */
export async function applyAlumniMatches(opts: {
  studentIds: number[];
  fileName?: string | null;
  totalRows: number;
  matchedCount: number;
  importedBy?: number | null;
  markOthersAsNo?: boolean;
}): Promise<{ updatedCount: number; markedNoCount: number }> {
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

  let markedNoCount = 0;
  if (opts.markOthersAsNo) {
    const excludeClause = uniqueIds.length > 0
      ? `AND Student_Id NOT IN (${uniqueIds.map(() => '?').join(',')})`
      : '';
    const [noResult] = await pool.query<any>(
      `UPDATE student_master
       SET Alumni_Registered = 'No'
       WHERE (IsDelete = 0 OR IsDelete IS NULL)
         AND Alumni_Registered IS NULL
         ${excludeClause}`,
      uniqueIds
    );
    markedNoCount = Number(noResult.affectedRows || 0);
  }

  await pool.query(
    `INSERT INTO alumni_import_log (File_Name, Total_Rows, Matched_Count, Applied_Count, Imported_By)
     VALUES (?, ?, ?, ?, ?)`,
    [opts.fileName || null, opts.totalRows, opts.matchedCount, uniqueIds.length, opts.importedBy || null]
  );

  return { updatedCount, markedNoCount };
}
