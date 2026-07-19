/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getTrainerSession } from '@/app/api/trainer-portal/auth/session/route';

/* GET — Batch details (students, timings, programme name, duration) plus planned
   assignments from the Standard Lecture Plan, for a batch assigned to this trainer. */
export async function GET(req: NextRequest) {
  try {
    const session = await getTrainerSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    const facultyId = session.facultyId;

    if (!batchId) return NextResponse.json({ error: 'batchId required' }, { status: 400 });

    // Confirm this batch is actually assigned to the trainer before returning anything.
    const [assignedRows] = await pool.query<any[]>(
      `SELECT b.Batch_Id, b.Batch_code, b.Duration, b.Timings, c.Course_Name
       FROM batch_mst b
       LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
       LEFT JOIN batch_slecture_master bsl
         ON bsl.batch_id = b.Batch_Id
        AND (bsl.deleted IS NULL OR bsl.deleted = '0')
        AND bsl.faculty_id = ?
       LEFT JOIN lecture_taken_master ltm
         ON ltm.Batch_Id = b.Batch_Id
        AND (ltm.IsDelete = 0 OR ltm.IsDelete IS NULL)
        AND ltm.Faculty_Id = ?
       WHERE b.Batch_Id = ? AND (bsl.id IS NOT NULL OR ltm.Take_Id IS NOT NULL)
       LIMIT 1`,
      [facultyId, facultyId, batchId]
    );

    const batch = assignedRows?.[0];
    if (!batch) {
      return NextResponse.json({ error: 'This batch is not assigned to you' }, { status: 403 });
    }

    const [studentRows] = await pool.query<any[]>(
      `SELECT Student_Id, Student_Name
       FROM student_master
       WHERE Batch_Code = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Student_Name ASC`,
      [batch.Batch_code]
    );

    const [assignmentRows] = await pool.query<any[]>(
      `SELECT lecture_no, assignment, date
       FROM batch_slecture_master
       WHERE batch_id = ? AND (deleted IS NULL OR deleted = '0')
         AND assignment IS NOT NULL AND assignment != ''
       ORDER BY lecture_no ASC`,
      [batchId]
    );

    return NextResponse.json({
      batch: {
        batch_id: batch.Batch_Id,
        batch_code: batch.Batch_code,
        course_name: batch.Course_Name,
        duration: batch.Duration,
        timings: batch.Timings,
      },
      students: studentRows.map((s: any) => ({ student_id: s.Student_Id, student_name: s.Student_Name })),
      assignments: assignmentRows.map((a: any) => ({
        lecture_no: a.lecture_no,
        assignment: a.assignment,
        date: a.date,
      })),
    });
  } catch (err: unknown) {
    console.error('Trainer batch-details error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
