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

    // Get batch info
    const [studentRows] = await pool.query<any[]>(
      `SELECT s.Batch_Code, s.Course_Id, b.Batch_Id
       FROM student_master s
       LEFT JOIN batch_mst b ON b.Batch_code = s.Batch_Code AND b.Course_Id = s.Course_Id
       WHERE s.Student_Id = ?`,
      [studentId]
    );
    const batchId = studentRows[0]?.Batch_Id ?? null;

    if (!batchId) {
      return NextResponse.json({
        summary: { total_given: 0, received: 0, pending: 0, percentage: 0 },
        assignments: [],
      });
    }

    // Summary counts
    const [givenRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as total FROM lecture_taken_master
       WHERE Batch_Id = ? AND Assign_Given = 1
         AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [batchId]
    );
    const totalGiven = givenRows[0]?.total ?? 0;

    const [receivedRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as received FROM lecture_taken_child ltc
       INNER JOIN lecture_taken_master ltm ON ltc.Take_Id = ltm.Take_Id
       WHERE ltm.Batch_Id = ? AND ltc.Student_Id = ?
         AND ltm.Assign_Given = 1 AND ltc.AssignmentReceived = 1
         AND (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)
         AND (ltm.IsDelete = 0 OR ltm.IsDelete IS NULL)`,
      [batchId, studentId]
    );
    const received = receivedRows[0]?.received ?? 0;
    const pending = totalGiven - received;
    const percentage = totalGiven > 0 ? Math.round((received / totalGiven) * 100) : 0;

    // All assignments with details
    const [assignments] = await pool.query<any[]>(
      `SELECT ltm.Take_Id, ltm.Take_Dt, ltm.Topic, ltm.Lecture_Name,
              ltm.Duration, ltm.ClassRoom,
              f.Faculty_Name,
              COALESCE(ltc.AssignmentReceived, 0) as received,
              COALESCE(ltc.Student_Atten, 0) as was_present
       FROM lecture_taken_master ltm
       LEFT JOIN lecture_taken_child ltc ON ltm.Take_Id = ltc.Take_Id AND ltc.Student_Id = ?
       LEFT JOIN faculty_master f ON ltm.Faculty_Id = f.Faculty_Id
       WHERE ltm.Batch_Id = ? AND ltm.Assign_Given = 1
         AND (ltm.IsDelete = 0 OR ltm.IsDelete IS NULL)
       ORDER BY ltm.Take_Dt DESC`,
      [studentId, batchId]
    );

    return NextResponse.json({
      summary: { total_given: totalGiven, received, pending, percentage },
      assignments,
    });
  } catch (err: unknown) {
    console.error('Student assignments API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
