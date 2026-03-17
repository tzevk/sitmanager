/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getTrainerSession } from '@/app/api/trainer-portal/auth/session/route';

/* GET — Students with assignment status for a lecture (takeId) */
/* POST — Update assignment received status for students */
export async function GET(req: NextRequest) {
  try {
    const session = await getTrainerSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const takeId = searchParams.get('takeId');
    const batchId = searchParams.get('batchId');
    const facultyId = session.facultyId;

    if (takeId) {
      // Verify ownership
      const [check] = await pool.query<any[]>(
        `SELECT Take_Id FROM lecture_taken_master WHERE Take_Id = ? AND Faculty_Id = ?`,
        [takeId, facultyId]
      );
      if (!check.length) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

      const [students] = await pool.query<any[]>(
        `SELECT ltc.ID, ltc.Student_Id, ltc.Student_Name, ltc.Student_Atten,
                ltc.AssignmentReceived, ltc.Late
         FROM lecture_taken_child ltc
         WHERE ltc.Take_Id = ? AND (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)
         ORDER BY ltc.Student_Name`,
        [takeId]
      );
      return NextResponse.json({ students });
    }

    // Get lectures that have assignments for a batch
    if (!batchId) {
      return NextResponse.json({ error: 'takeId or batchId required' }, { status: 400 });
    }

    const [lectures] = await pool.query<any[]>(
      `SELECT ltm.Take_Id, ltm.Take_Dt, ltm.Topic, ltm.Lecture_Name,
              ltm.Assign_Given,
              (SELECT COUNT(*) FROM lecture_taken_child ltc
               WHERE ltc.Take_Id = ltm.Take_Id AND (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)) as total_students,
              (SELECT COUNT(*) FROM lecture_taken_child ltc
               WHERE ltc.Take_Id = ltm.Take_Id AND ltc.AssignmentReceived = 1
               AND (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)) as assignments_received
       FROM lecture_taken_master ltm
       WHERE ltm.Batch_Id = ? AND ltm.Faculty_Id = ?
         AND (ltm.IsDelete = 0 OR ltm.IsDelete IS NULL)
       ORDER BY ltm.Take_Dt DESC
       LIMIT 50`,
      [batchId, facultyId]
    );

    return NextResponse.json({ lectures });
  } catch (err: unknown) {
    console.error('Assignments GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTrainerSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const body = await req.json();
    const { take_id, updates } = body;
    // updates: Array<{ student_id: number, assignment_received: 0 | 1 }>
    const facultyId = session.facultyId;

    if (!take_id || !updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'take_id and updates[] required' }, { status: 400 });
    }

    // Verify ownership
    const [check] = await pool.query<any[]>(
      `SELECT Take_Id FROM lecture_taken_master WHERE Take_Id = ? AND Faculty_Id = ?`,
      [take_id, facultyId]
    );
    if (!check.length) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    for (const u of updates) {
      await pool.query(
        `UPDATE lecture_taken_child SET AssignmentReceived = ? WHERE Take_Id = ? AND Student_Id = ?`,
        [u.assignment_received ? 1 : 0, take_id, u.student_id]
      );
    }

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (err: unknown) {
    console.error('Assignments POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
