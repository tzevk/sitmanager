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
    const takeDate = url.searchParams.get('takeDate');

    if (!courseId || !batchId || !takeDate) {
      return NextResponse.json(
        { error: 'courseId, batchId and takeDate are required' },
        { status: 400 }
      );
    }

    /* --- Get batch & course info --- */
    const [batchInfo] = await pool.query(
      `SELECT b.Batch_Id, b.Batch_code, b.Category, b.No_of_Lectures,
              c.Course_Name
       FROM batch_mst b
       LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
       WHERE b.Batch_Id = ?`,
      [parseInt(batchId)]
    );
    const batch = (batchInfo as any[])[0] || {};

    /* --- Get all lectures taken for this batch on the given date --- */
    const [lectures] = await pool.query(
      `SELECT lt.Take_Id, lt.Lecture_Name, lt.Take_Dt,
              lt.Lecture_Start, lt.Lecture_End, lt.Duration,
              lt.ClassRoom, lt.Topic,
              f.Faculty_Name
       FROM lecture_taken_master lt
       LEFT JOIN faculty_master f ON lt.Faculty_Id = f.Faculty_Id
       WHERE lt.Batch_Id = ?
         AND lt.Take_Dt = ?
         AND (lt.IsDelete = 0 OR lt.IsDelete IS NULL)
       ORDER BY lt.Lecture_Start, lt.Take_Id`,
      [parseInt(batchId), takeDate]
    );
    const lectureRows = lectures as any[];

    if (lectureRows.length === 0) {
      return NextResponse.json({
        batch,
        lectures: [],
        students: [],
        summary: { totalStudents: 0, totalLectures: 0 },
        filters: { courseId, batchId, takeDate },
      });
    }

    const takeIds = lectureRows.map((l: any) => l.Take_Id);

    /* --- Get attendance records for all lectures on that date --- */
    const [attendance] = await pool.query(
      `SELECT ltc.Take_Id, ltc.Student_Id, ltc.Student_Name,
              ltc.Student_Atten, ltc.In_Time, ltc.Out_Time, ltc.Late
       FROM lecture_taken_child ltc
       WHERE ltc.Take_Id IN (${takeIds.map(() => '?').join(',')})
         AND (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)
       ORDER BY ltc.Student_Name, ltc.Take_Id`,
      takeIds
    );
    const attendanceRows = attendance as any[];

    /* --- Build student-level data with per-lecture attendance --- */
    const studentMap = new Map<number, any>();

    for (const a of attendanceRows) {
      if (!studentMap.has(a.Student_Id)) {
        studentMap.set(a.Student_Id, {
          Student_Id: a.Student_Id,
          Student_Name: a.Student_Name,
          lectures: {},
          presentCount: 0,
          absentCount: 0,
          lateCount: 0,
        });
      }
      const s = studentMap.get(a.Student_Id)!;
      const status = (a.Student_Atten || '').trim();
      s.lectures[a.Take_Id] = {
        status,
        inTime: a.In_Time || '',
        outTime: a.Out_Time || '',
        late: (a.Late || '').trim(),
      };
      if (status === 'Present') s.presentCount++;
      else s.absentCount++;
      if ((a.Late || '').trim() === 'Yes') s.lateCount++;
    }

    /* --- Build result arrays --- */
    const students = Array.from(studentMap.values())
      .sort((a, b) => a.Student_Name.localeCompare(b.Student_Name))
      .map((s, idx) => ({
        srNo: idx + 1,
        ...s,
        percentage: lectureRows.length > 0
          ? Math.round((s.presentCount / lectureRows.length) * 100)
          : 0,
      }));

    const totalStudents = students.length;
    const totalLectures = lectureRows.length;
    const overallPresent = students.reduce((sum: number, s: any) => sum + s.presentCount, 0);
    const overallAbsent = students.reduce((sum: number, s: any) => sum + s.absentCount, 0);

    /* --- Per-lecture summary (present count per lecture) --- */
    const lectureSummary = lectureRows.map((l: any) => {
      const present = attendanceRows.filter(
        (a: any) => a.Take_Id === l.Take_Id && (a.Student_Atten || '').trim() === 'Present'
      ).length;
      const absent = attendanceRows.filter(
        (a: any) => a.Take_Id === l.Take_Id && (a.Student_Atten || '').trim() !== 'Present'
      ).length;
      return {
        ...l,
        presentCount: present,
        absentCount: absent,
        totalStudents,
      };
    });

    return NextResponse.json({
      batch,
      lectures: lectureSummary,
      students,
      summary: {
        totalStudents,
        totalLectures,
        overallPresent,
        overallAbsent,
        averageAttendance: totalStudents > 0 && totalLectures > 0
          ? Math.round((overallPresent / (totalStudents * totalLectures)) * 100)
          : 0,
      },
      filters: { courseId, batchId, takeDate },
    });
  } catch (err: any) {
    console.error('Attendance report error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
