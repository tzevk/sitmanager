/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

/* ---------- GET — Full Attendance Report ---------- */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'report_attendance.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const url = req.nextUrl;

    /* --- Dropdown options --- */
    const fetchOptions = url.searchParams.get('options');

    if (fetchOptions === 'courses') {
      const [courses] = await pool.query(
        `SELECT Course_Id AS id, Course_Name AS name
         FROM course_mst
         WHERE (IsDelete = 0 OR IsDelete IS NULL) AND IsActive = 1
         ORDER BY Course_Name`
      );
      return NextResponse.json({ courses });
    }

    if (fetchOptions === 'batches') {
      const courseId = url.searchParams.get('courseId');
      if (!courseId) return NextResponse.json({ batches: [] });
      const [batches] = await pool.query(
        `SELECT Batch_Id AS id, Batch_code AS name, Category AS category
         FROM batch_mst
         WHERE Course_Id = ? AND IsActive = 1
           AND (IsDelete = 0 OR IsDelete IS NULL)
           AND (Cancel = 0 OR Cancel IS NULL)
         ORDER BY Batch_Id DESC`,
        [parseInt(courseId)]
      );
      return NextResponse.json({ batches });
    }

    /* --- Report data --- */
    const courseId = url.searchParams.get('courseId');
    const batchId = url.searchParams.get('batchId');

    if (!courseId || !batchId) {
      return NextResponse.json(
        { error: 'courseId and batchId are required' },
        { status: 400 }
      );
    }

    const batchIdInt = parseInt(batchId);

    /* --- Get batch & course info --- */
    const [batchInfo] = await pool.query(
      `SELECT b.Batch_Id, b.Batch_code, b.Category, b.No_of_Lectures,
              c.Course_Name
       FROM batch_mst b
       LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
       WHERE b.Batch_Id = ?`,
      [batchIdInt]
    );
    const batch = (batchInfo as any[])[0] || {};

    /* --- Get unique lectures per (date, start-time) slot ---
         Duplicate entries exist where the same slot was entered multiple times.
         We keep MAX(Take_Id) per (Take_Dt, Lecture_Start) so the most-recent
         (and correct) attendance record is used. */
    const [lectures] = await pool.query(
      `SELECT lt.Take_Id, lt.Take_Dt, lt.Lecture_Start, lt.Lecture_End,
              lt.Duration, lt.Topic
       FROM lecture_taken_master lt
       INNER JOIN (
         SELECT MAX(Take_Id) AS Take_Id
         FROM lecture_taken_master
         WHERE Batch_Id = ?
           AND (IsDelete = 0 OR IsDelete IS NULL)
         GROUP BY Take_Dt, Lecture_Start
       ) dedup ON lt.Take_Id = dedup.Take_Id
       ORDER BY lt.Take_Dt, lt.Lecture_Start`,
      [batchIdInt]
    );
    const lectureRows = lectures as any[];

    /* --- Get students enrolled in this batch via admission_master --- */
    const [enrolledRows] = await pool.query(
      `SELECT DISTINCT sm.Student_Id, sm.Student_Name
       FROM admission_master am
       JOIN student_master sm ON sm.Student_Id = am.Student_Id
       WHERE am.Batch_Id = ?
         AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
         AND am.IsActive = 1
         AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
       ORDER BY sm.Student_Name`,
      [batchIdInt]
    );
    const students = enrolledRows as any[];

    if (lectureRows.length === 0) {
      return NextResponse.json({
        batch,
        lectures: [],
        students,
        attendanceMap: {},
        studentSummary: {},
        summary: { totalStudents: students.length, totalLectures: 0 },
        filters: { courseId, batchId },
      });
    }

    const takeIds = lectureRows.map((l: any) => l.Take_Id);

    /* --- Get attendance for all lectures --- */
    const [attendanceData] = await pool.query(
      `SELECT ltc.Take_Id, ltc.Student_Id, ltc.Student_Atten, ltc.Late
       FROM lecture_taken_child ltc
       WHERE ltc.Take_Id IN (${takeIds.map(() => '?').join(',')})
         AND (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)`,
      takeIds
    );
    const attendanceRows = attendanceData as any[];

    /* --- Build attendance map: { [Take_Id]: { [Student_Id]: { status, late } } } --- */
    const attendanceMap: Record<string, Record<string, { status: string; late: boolean }>> = {};
    const summaryAcc: Record<string, { lateCount: number; presentCount: number }> = {};

    for (const s of students) {
      summaryAcc[String(s.Student_Id)] = { lateCount: 0, presentCount: 0 };
    }

    for (const a of attendanceRows) {
      const takeKey = String(a.Take_Id);
      const studKey = String(a.Student_Id);
      if (!attendanceMap[takeKey]) attendanceMap[takeKey] = {};
      const status = (a.Student_Atten || '').trim();
      const late = (a.Late || '').trim() === 'Yes';
      attendanceMap[takeKey][studKey] = { status, late };
      if (summaryAcc[studKey]) {
        if (status === 'Present') summaryAcc[studKey].presentCount++;
        if (late) summaryAcc[studKey].lateCount++;
      }
    }

    const totalLectures = lectureRows.length;
    const studentSummary: Record<string, { lateCount: number; presentCount: number; effectivePresent: number; percentage: string }> = {};
    for (const s of students) {
      const key = String(s.Student_Id);
      const ss = summaryAcc[key] || { lateCount: 0, presentCount: 0 };
      // Every 3 late marks counts as 1 absent (deducted from present count)
      const lateDeductions = Math.floor(ss.lateCount / 3);
      const effectivePresent = Math.max(0, ss.presentCount - lateDeductions);
      studentSummary[key] = {
        lateCount: ss.lateCount,
        presentCount: ss.presentCount,
        effectivePresent,
        percentage: totalLectures > 0
          ? ((effectivePresent / totalLectures) * 100).toFixed(2)
          : '0.00',
      };
    }

    return NextResponse.json({
      batch,
      lectures: lectureRows,
      students,
      attendanceMap,
      studentSummary,
      summary: { totalStudents: students.length, totalLectures },
      filters: { courseId, batchId },
    });
  } catch (err: any) {
    console.error('Attendance report error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
