/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool } from '@/lib/db';
import { ensureAlumniColumn } from '@/lib/student-alumni';
import type { AlumniCsvRow } from '@/lib/services/alumni-import.service';

/**
 * Batch-wise alumni registration, from the LAST uploaded alumni-portal report —
 * so nobody has to re-upload the file to see it.
 *
 * Each upload (Check Accounts) is stored in alumni_report_upload with its parsed
 * rows and the students it matched; Save updates that record with the final list
 * (including manual links). A student counts as registered when they are in the
 * latest upload's matched list or are marked Alumni_Registered = 'Yes' (set by a
 * Save or on the Student Master page).
 */

const UPLOAD_TABLE = 'alumni_report_upload';

let tableReady = false;
async function ensureUploadTable(pool: any) {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${UPLOAD_TABLE} (
      Id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      File_Name VARCHAR(255) NULL,
      Total_Rows INT NOT NULL DEFAULT 0,
      Matched_Count INT NOT NULL DEFAULT 0,
      Matched_Student_Ids LONGTEXT NOT NULL,
      Csv_Rows LONGTEXT NOT NULL,
      Uploaded_By INT NULL,
      Uploaded_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      Saved_At DATETIME NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tableReady = true;
}

export async function recordAlumniUpload(opts: {
  fileName: string | null;
  rows: AlumniCsvRow[];
  matchedStudentIds: number[];
  uploadedBy: number | null;
}): Promise<number> {
  const pool = getPool();
  await ensureUploadTable(pool);
  const [res] = await pool.query<any>(
    `INSERT INTO ${UPLOAD_TABLE} (File_Name, Total_Rows, Matched_Count, Matched_Student_Ids, Csv_Rows, Uploaded_By)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [opts.fileName, opts.rows.length, opts.matchedStudentIds.length, JSON.stringify(opts.matchedStudentIds), JSON.stringify(opts.rows), opts.uploadedBy]
  );
  return Number(res.insertId);
}

/** Save: store the final matched list (auto + manual links) on that upload. */
export async function finalizeAlumniUpload(uploadId: number, studentIds: number[]): Promise<void> {
  const pool = getPool();
  await ensureUploadTable(pool);
  await pool.query(
    `UPDATE ${UPLOAD_TABLE} SET Matched_Student_Ids = ?, Matched_Count = ?, Saved_At = NOW() WHERE Id = ?`,
    [JSON.stringify([...new Set(studentIds)]), new Set(studentIds).size, uploadId]
  );
}

export interface LatestAlumniUpload {
  id: number;
  fileName: string | null;
  totalRows: number;
  matchedCount: number;
  uploadedAt: string;
  uploadedByName: string | null;
  savedAt: string | null;
  matchedStudentIds: number[];
  rows: AlumniCsvRow[];
}

export async function getLatestAlumniUpload(withRows = false): Promise<LatestAlumniUpload | null> {
  const pool = getPool();
  await ensureUploadTable(pool);
  const [rows] = await pool.query<any[]>(
    `SELECT u.Id, u.File_Name, u.Total_Rows, u.Matched_Count, u.Matched_Student_Ids,
            ${withRows ? 'u.Csv_Rows' : "'[]' AS Csv_Rows"},
            DATE_FORMAT(u.Uploaded_At, '%Y-%m-%d %H:%i:%s') AS Uploaded_At,
            DATE_FORMAT(u.Saved_At, '%Y-%m-%d %H:%i:%s') AS Saved_At,
            NULLIF(TRIM(CONCAT(COALESCE(e.firstname, ''), ' ', COALESCE(e.lastname, ''))), '') AS Uploaded_By_Name
     FROM ${UPLOAD_TABLE} u
     LEFT JOIN awt_adminuser e ON e.id = u.Uploaded_By
     ORDER BY u.Id DESC LIMIT 1`
  ).catch(async () => pool.query<any[]>(
    // Staff table unavailable — fall back without the uploader's name.
    `SELECT Id, File_Name, Total_Rows, Matched_Count, Matched_Student_Ids, ${withRows ? 'Csv_Rows' : "'[]' AS Csv_Rows"},
            DATE_FORMAT(Uploaded_At, '%Y-%m-%d %H:%i:%s') AS Uploaded_At, DATE_FORMAT(Saved_At, '%Y-%m-%d %H:%i:%s') AS Saved_At,
            NULL AS Uploaded_By_Name
     FROM ${UPLOAD_TABLE} ORDER BY Id DESC LIMIT 1`
  ));
  const r = rows[0];
  if (!r) return null;
  const parse = (v: unknown, fallback: any) => { try { return JSON.parse(String(v)); } catch { return fallback; } };
  return {
    id: Number(r.Id),
    fileName: r.File_Name ?? null,
    totalRows: Number(r.Total_Rows) || 0,
    matchedCount: Number(r.Matched_Count) || 0,
    uploadedAt: r.Uploaded_At,
    uploadedByName: r.Uploaded_By_Name ?? null,
    savedAt: r.Saved_At ?? null,
    matchedStudentIds: (parse(r.Matched_Student_Ids, []) as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n > 0),
    rows: parse(r.Csv_Rows, []) as AlumniCsvRow[],
  };
}

export interface AlumniBatchRow {
  batchId: number;
  batchCode: string;
  batchName: string;
  startDate: string | null;
  endDate: string | null;
  totalStudents: number;
  registered: number;
  left: number;
  percentage: number;
}

/** Live admissions (not deleted, not cancelled) with each student's registration. */
async function loadAdmissions(pool: any, matched: Set<number>) {
  await ensureAlumniColumn(pool);
  const [rows] = await pool.query(
    `SELECT a.Batch_Id, a.Student_Id, s.Student_Name, a.Roll_No, s.Present_Mobile, s.Email, s.Alumni_Registered
     FROM admission_master a
     JOIN student_master s ON s.Student_Id = a.Student_Id AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
     WHERE (a.IsDelete = 0 OR a.IsDelete IS NULL)
       AND UPPER(TRIM(COALESCE(a.Cancel, ''))) NOT IN ('YES', '1')
       AND a.Batch_Id IS NOT NULL`
  );
  return (rows as any[]).map((r) => ({
    batchId: Number(r.Batch_Id),
    studentId: Number(r.Student_Id),
    name: r.Student_Name ?? '',
    rollNo: r.Roll_No ? String(r.Roll_No).trim() : '',
    mobile: r.Present_Mobile ?? '',
    email: r.Email ?? '',
    registered: matched.has(Number(r.Student_Id)) || String(r.Alumni_Registered ?? '').trim().toLowerCase() === 'yes',
  }));
}

export async function getAlumniBatchSummary() {
  const pool = getPool();
  const latest = await getLatestAlumniUpload(false);
  const matched = new Set(latest?.matchedStudentIds ?? []);
  const admissions = await loadAdmissions(pool, matched);

  // One count per student per batch (a student can hold two admissions in a batch).
  const perBatch = new Map<number, Map<number, boolean>>();
  for (const a of admissions) {
    const m = perBatch.get(a.batchId) ?? new Map<number, boolean>();
    m.set(a.studentId, (m.get(a.studentId) ?? false) || a.registered);
    perBatch.set(a.batchId, m);
  }
  const ids = [...perBatch.keys()];
  const batchInfo = new Map<number, any>();
  for (let i = 0; i < ids.length; i += 1000) {
    const [rows] = await pool.query<any[]>(
      `SELECT b.Batch_Id, b.Batch_code, b.SDate, b.EDate, COALESCE(NULLIF(TRIM(c.Course_Name), ''), NULLIF(TRIM(b.CourseName), '')) AS Course_Name
       FROM batch_mst b LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id
       WHERE b.Batch_Id IN (?) AND (b.IsDelete = 0 OR b.IsDelete IS NULL)`,
      [ids.slice(i, i + 1000)]
    );
    for (const r of rows) batchInfo.set(Number(r.Batch_Id), r);
  }

  const dateOrNull = (v: unknown) => (/^\d{4}-\d{2}-\d{2}/.test(String(v ?? '')) ? String(v).slice(0, 10) : null);
  const batches: AlumniBatchRow[] = [];
  for (const [batchId, students] of perBatch) {
    const b = batchInfo.get(batchId);
    if (!b) continue;
    const total = students.size;
    const registered = [...students.values()].filter(Boolean).length;
    batches.push({
      batchId,
      batchCode: String(b.Batch_code ?? ''),
      batchName: b.Course_Name ?? '',
      startDate: dateOrNull(b.SDate),
      endDate: dateOrNull(b.EDate),
      totalStudents: total,
      registered,
      left: total - registered,
      percentage: total ? Math.round((registered / total) * 1000) / 10 : 0,
    });
  }
  // Latest end date first; batches without an end date go last.
  batches.sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? '') || b.batchId - a.batchId);

  const { rows: _rows, matchedStudentIds: _ids, ...upload } = latest ?? ({} as any);
  void _rows; void _ids;
  return { lastUpload: latest ? upload : null, batches };
}

/** One batch's students with registered yes/no — for the per-batch download. */
export async function getAlumniBatchStudents(batchId: number) {
  const pool = getPool();
  const latest = await getLatestAlumniUpload(false);
  const matched = new Set(latest?.matchedStudentIds ?? []);
  const all = (await loadAdmissions(pool, matched)).filter((a) => a.batchId === batchId);
  const seen = new Map<number, (typeof all)[number]>();
  for (const a of all) {
    const prev = seen.get(a.studentId);
    seen.set(a.studentId, prev ? { ...prev, registered: prev.registered || a.registered } : a);
  }
  return [...seen.values()].sort((a, b) => (Number(a.rollNo) || 1e9) - (Number(b.rollNo) || 1e9) || a.name.localeCompare(b.name));
}
