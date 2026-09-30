/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { buildFinalExamReport } from '@/lib/final-exam-report';

/* ─── Route handler ────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'report_final_exam.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const url = req.nextUrl;
    const options = url.searchParams.get('options');

    /* ---------- Dropdown: courses ---------- */
    if (options === 'courses') {
      const [courses] = await pool.query(
        `SELECT Course_Id AS id, Course_Name AS name
         FROM course_mst
         WHERE (IsDelete = 0 OR IsDelete IS NULL) AND IsActive = 1
         ORDER BY Course_Name`
      );
      return NextResponse.json({ courses });
    }

    /* ---------- Dropdown: batches ---------- */
    if (options === 'batches') {
      const courseId = url.searchParams.get('courseId');
      if (!courseId) return NextResponse.json({ batches: [] });
      // This is a read-only historical report, so list every non-deleted batch
      // for the course — including completed/older ones. We deliberately do NOT
      // filter on IsActive (older batches are commonly marked inactive) or on
      // batch_mst.Cancel: that column is a small-integer status code (values
      // 0-14), NOT a boolean "cancelled" flag — real cancellations live in
      // awt_batchcancellation — so treating Cancel<>0 as cancelled wrongly hid
      // ~150 batches that had already completed their final exams.
      const [batches] = await pool.query(
        `SELECT Batch_Id AS id, Batch_code AS name, Category AS category
         FROM batch_mst
         WHERE Course_Id = ?
           AND (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY Batch_Id DESC`,
        [parseInt(courseId)]
      );
      return NextResponse.json({ batches });
    }

    /* ---------- Dropdown: students in batch ---------- */
    if (options === 'students') {
      const batchId = url.searchParams.get('batchId');
      if (!batchId) return NextResponse.json({ students: [] });
      const [students] = await pool.query(
        `SELECT a.Admission_Id, s.Student_Id, s.Student_Name,
                COALESCE(a.Roll_No, '') AS Roll_No
         FROM admission_master a
         JOIN student_master s ON a.Student_Id = s.Student_Id
         WHERE a.Batch_Id = ?
           AND (a.IsDelete = 0 OR a.IsDelete IS NULL)
           AND (a.Cancel = 0 OR a.Cancel IS NULL)
         ORDER BY CAST(COALESCE(a.Roll_No, '9999') AS UNSIGNED), s.Student_Name`,
        [parseInt(batchId)]
      );
      return NextResponse.json({ students });
    }

    /* ---------- Report data ---------- */
    const batchIdRaw = url.searchParams.get('batchId');
    const studentIdRaw = url.searchParams.get('studentId');

    if (!batchIdRaw) {
      return NextResponse.json({ error: 'batchId is required' }, { status: 400 });
    }
    const batchId = parseInt(batchIdRaw);
    const studentId = studentIdRaw ? parseInt(studentIdRaw) : null;

    const report = await buildFinalExamReport(pool, batchId, studentId);
    if (!report) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }
    return NextResponse.json(report);
  } catch (error: any) {
    console.error('Final exam report GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch final exam report', details: error.message },
      { status: 500 }
    );
  }
}
