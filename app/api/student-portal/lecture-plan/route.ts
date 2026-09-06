/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getStudentSession } from '@/app/api/student-portal/auth/session/route';

export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const studentId = session.studentId;

    // Same "latest active admission" batch resolution as
    // app/api/student-portal/academics/route.ts — student_master.Batch_Code
    // goes stale after a transfer/re-admission.
    const [studentRows] = await pool.query<any[]>(
      `SELECT b.Batch_Id
       FROM student_master s
       LEFT JOIN (
         SELECT Student_Id, MAX(Admission_Id) AS Admission_Id
         FROM admission_master
         WHERE IsDelete = 0 AND IsActive = 1
         GROUP BY Student_Id
       ) latest ON latest.Student_Id = s.Student_Id
       LEFT JOIN admission_master a ON a.Admission_Id = latest.Admission_Id
       LEFT JOIN batch_mst b ON b.Batch_Id = COALESCE(
         a.Batch_Id,
         (SELECT Batch_Id FROM batch_mst WHERE Batch_code = s.Batch_Code AND Course_Id = s.Course_Id ORDER BY Batch_Id DESC LIMIT 1)
       )
       WHERE s.Student_Id = ?`,
      [studentId]
    );
    const batchId = studentRows[0]?.Batch_Id ?? null;
    if (!batchId) return NextResponse.json({ lectures: [] });

    const [lectures] = await pool.query<any[]>(
      `SELECT id, lecture_no, subject_topic, subject, faculty_name, date,
              starttime, endtime, duration, class_room, assignment, unit_test, status
       FROM batch_lecture_master
       WHERE batch_id = ? AND (deleted = '0' OR deleted IS NULL)
       ORDER BY lecture_no ASC, date ASC`,
      [batchId]
    );

    return NextResponse.json({ lectures });
  } catch (err: unknown) {
    console.error('Student portal lecture-plan GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
