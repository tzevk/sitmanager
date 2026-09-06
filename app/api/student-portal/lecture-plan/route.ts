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

    // batch_slecture_master is the table staff actually maintain via the Batch
    // Master "Lecture Plan" tab — batch_lecture_master is a stale legacy table
    // with heavy duplicate junk data, no longer edited there. A lecture shows
    // here once staff mark it published, or once it's actually been taken
    // (matches the same "Converted" linkage the staff-side tab shows).
    const [lectures] = await pool.query<any[]>(
      `SELECT s.id, s.lecture_no, s.subject_topic, s.subject, s.faculty_name, s.date,
              s.starttime, s.endtime, s.class_room, s.assignment, s.unit_test, u.utdate AS unit_test_date,
              s.session,
              (lt.Take_Id IS NOT NULL) AS taken
       FROM batch_slecture_master s
       LEFT JOIN lecture_taken_master lt
         ON lt.Lecture_Id = s.id AND lt.Batch_Id = s.batch_id AND (lt.IsDelete = 0 OR lt.IsDelete IS NULL)
       LEFT JOIN awt_unittesttaken u ON u.id = CAST(s.unit_test AS UNSIGNED)
       WHERE s.batch_id = ? AND (s.deleted = '0' OR s.deleted IS NULL)
         AND (s.publish = 'Yes' OR lt.Take_Id IS NOT NULL)
       ORDER BY s.lecture_no ASC, s.date ASC`,
      [batchId]
    );

    return NextResponse.json({ lectures });
  } catch (err: unknown) {
    console.error('Student portal lecture-plan GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
