/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { ensureStudentTransferColumns } from '@/lib/student-transfer';

export const runtime = 'nodejs';
export const maxDuration = 60;

const REPORT_TYPES = [
  'student-list', 'batch-wise', 'yearly', 'card-list', 'month-wise',
  'documents', 'left', 'cancelled', 'transferred', 'placed',
] as const;
type ReportType = (typeof REPORT_TYPES)[number];

function guarded(sql: string, seconds = 25): string {
  return `SET STATEMENT max_statement_time=${seconds} FOR ${sql}`;
}

// Latest non-deleted admission per student. Reports are about admitted students
// (admission_master ~18k rows) — driving from here keeps them fast, unlike a
// correlated scan over student_master (~170k rows, mostly inquiries).
const LATEST_ADMISSION_JOIN = `
  JOIN admission_master am ON am.Student_Id = sm.Student_Id
  JOIN (
    SELECT Student_Id, MAX(Admission_Id) AS mid
    FROM admission_master
    WHERE (IsDelete = 0 OR IsDelete IS NULL)
    GROUP BY Student_Id
  ) latest ON latest.mid = am.Admission_Id`;

const TRUTHY = `IN ('1', 'yes', 'y', 'true')`;

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, ['student.view', 'report_fees.view']);
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getPool();
    await ensureStudentTransferColumns(pool);
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || '';

    // ── Dropdown data ──────────────────────────────────────────────
    if (action === 'courses') {
      const [rows] = await pool.query<any[]>(
        `SELECT Course_Id, Course_Name FROM course_mst
         WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Course_Name`
      );
      return NextResponse.json({ courses: rows });
    }
    if (action === 'batches') {
      const courseId = searchParams.get('courseId') || '';
      const params: any[] = [];
      let where = '(IsDelete = 0 OR IsDelete IS NULL)';
      if (courseId) { where += ' AND Course_Id = ?'; params.push(Number(courseId)); }
      const [rows] = await pool.query<any[]>(
        `SELECT Batch_Id, Batch_code FROM batch_mst WHERE ${where} ORDER BY Batch_Id DESC`,
        params
      );
      return NextResponse.json({ batches: rows });
    }

    // ── Report data ────────────────────────────────────────────────
    const type = (searchParams.get('type') || 'student-list') as ReportType;
    if (!REPORT_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }
    const courseId = searchParams.get('courseId') || '';
    const batchCode = searchParams.get('batchCode') || '';

    // ── Placed students — from the placement (cvchild) tables ──────
    if (type === 'placed') {
      const conds: string[] = ['(cc.IsDelete = 0 OR cc.IsDelete IS NULL)'];
      const params: any[] = [];
      conds.push(`(
        LOWER(TRIM(CAST(cc.Placement AS CHAR))) IN ('1','yes','y','true','placed')
        OR LOWER(IFNULL(cc.Result, '')) LIKE '%plac%'
        OR LOWER(IFNULL(cc.Result, '')) LIKE '%select%'
      )`);
      if (courseId) { conds.push('sm.Course_Id = ?'); params.push(Number(courseId)); }
      if (batchCode) { conds.push('b2.Batch_code = ?'); params.push(batchCode); }
      const [rows] = await pool.query<any[]>(
        guarded(`
          SELECT
            cc.Student_Id,
            COALESCE(NULLIF(sm.Student_Name, ''), cc.Student_Name, '') AS Student_Name,
            COALESCE(sm.Present_Mobile, '') AS Present_Mobile,
            COALESCE(sm.Email, '') AS Email,
            COALESCE(c.Course_Name, '') AS Course_Name,
            COALESCE(b2.Batch_code, NULLIF(TRIM(sm.Batch_Code), ''), '') AS Batch_Code,
            COALESCE(cv.CompanyName, '') AS CompanyName,
            COALESCE(cc.Result, '') AS Result,
            DATE_FORMAT(cv.TDate, '%Y-%m-%d') AS Admission_Date
          FROM cvchild cc
          LEFT JOIN cv_shortlisted cv ON cv.id = cc.CV_Id
          LEFT JOIN student_master sm ON sm.Student_Id = cc.Student_Id
          LEFT JOIN course_mst c ON c.Course_Id = sm.Course_Id
          LEFT JOIN batch_mst b2 ON b2.Batch_Id = cc.Batch_id
          WHERE ${conds.join(' AND ')}
          ORDER BY cv.TDate DESC, cc.Id DESC
          LIMIT 5000`),
        params
      );
      return NextResponse.json({ rows, type });
    }

    // ── Admission-driven reports ───────────────────────────────────
    const conds: string[] = ['(sm.IsDelete = 0 OR sm.IsDelete IS NULL)'];
    const params: any[] = [];
    if (courseId) { conds.push('sm.Course_Id = ?'); params.push(Number(courseId)); }
    if (batchCode) { conds.push('b.Batch_code = ?'); params.push(batchCode); }

    if (type === 'cancelled') {
      conds.push(`LOWER(TRIM(CAST(COALESCE(am.Cancel, '') AS CHAR))) ${TRUTHY}`);
    } else if (type === 'left') {
      conds.push(`LOWER(TRIM(CAST(COALESCE(am.Lefted, '') AS CHAR))) ${TRUTHY}`);
    } else if (type === 'transferred') {
      conds.push(`LOWER(TRIM(CAST(COALESCE(sm.Transfered, '') AS CHAR))) ${TRUTHY}`);
    } else {
      conds.push(`LOWER(TRIM(CAST(COALESCE(am.Cancel, '') AS CHAR))) NOT ${TRUTHY}`);
      conds.push(`LOWER(TRIM(CAST(COALESCE(am.Lefted, '') AS CHAR))) NOT ${TRUTHY}`);
    }

    const docCountSelect = type === 'documents'
      ? `(SELECT COUNT(*) FROM documents d WHERE d.Student_id = sm.Student_Id) AS DocCount,`
      : '';

    const orderBy =
      type === 'batch-wise' ? 'b.Batch_code ASC, sm.Student_Name ASC'
      : type === 'yearly' || type === 'month-wise' || type === 'transferred' || type === 'cancelled' || type === 'left'
        ? 'Admission_Date DESC, sm.Student_Name ASC'
      : 'sm.Student_Name ASC';

    const [rows] = await pool.query<any[]>(
      guarded(`
        SELECT
          sm.Student_Id,
          COALESCE(am.Roll_No, '') AS Roll_No,
          COALESCE(sm.Student_Name, '') AS Student_Name,
          COALESCE(sm.Present_Mobile, '') AS Present_Mobile,
          COALESCE(sm.Email, '') AS Email,
          COALESCE(sm.Photo, '') AS Photo,
          COALESCE(c.Course_Name, '') AS Course_Name,
          COALESCE(b.Batch_code, NULLIF(TRIM(sm.Batch_Code), ''), '') AS Batch_Code,
          ${docCountSelect}
          COALESCE(stt.Status, '') AS Status_Name,
          COALESCE(sm.Moved_From_Batch_Code, '') AS Moved_From_Batch_Code,
          COALESCE(sm.Moved_To_Batch_Code, '') AS Moved_To_Batch_Code,
          COALESCE(mtc.Course_Name, '') AS Moved_To_Course_Name,
          DATE_FORMAT(
            COALESCE(
              am.Admission_Date,
              STR_TO_DATE(CAST(sm.Admission_Dt AS CHAR), '%Y-%m-%d')
            ), '%Y-%m-%d'
          ) AS Admission_Date
        FROM student_master sm
        ${LATEST_ADMISSION_JOIN}
        LEFT JOIN course_mst c ON c.Course_Id = sm.Course_Id
        LEFT JOIN batch_mst b ON b.Batch_Id = am.Batch_Id
        LEFT JOIN status_master stt ON stt.Id = sm.Status_id
        LEFT JOIN course_mst mtc ON mtc.Course_Id = sm.Moved_To_Course_Id
        WHERE ${conds.join(' AND ')}
        ORDER BY ${orderBy}
        LIMIT 5000`),
      params
    );
    return NextResponse.json({ rows, type });
  } catch (err: any) {
    console.error('Student report error:', err);
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}
