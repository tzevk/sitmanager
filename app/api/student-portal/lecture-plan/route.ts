/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getStudentSession } from '@/app/api/student-portal/auth/session/route';
import { getStudentPortalContext } from '@/lib/student-portal/context';

export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const ctx = await getStudentPortalContext(pool, Number(session.studentId));
    const batchId = ctx?.batchId ?? null;
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
              -- normal | cancelled | replacement | pending (set on the Batch Master
              -- lecture plan); read-only, used for the dashboard's Cancelled filter.
              s.lecture_status,
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
