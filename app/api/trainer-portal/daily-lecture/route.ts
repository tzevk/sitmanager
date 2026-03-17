/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getTrainerSession } from '@/app/api/trainer-portal/auth/session/route';

/* GET — Lectures taken by this trainer, with student data */
/* POST — Update a daily lecture (topic, timing, etc.) */
export async function GET(req: NextRequest) {
  try {
    const session = await getTrainerSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    const takeId = searchParams.get('takeId');
    const facultyId = session.facultyId;

    // Single lecture detail with students
    if (takeId) {
      const [rows] = await pool.query<any[]>(
        `SELECT ltm.*, b.Batch_code, c.Course_Name
         FROM lecture_taken_master ltm
         LEFT JOIN batch_mst b ON ltm.Batch_Id = b.Batch_Id
         LEFT JOIN course_mst c ON ltm.Course_Id = c.Course_Id
         WHERE ltm.Take_Id = ? AND ltm.Faculty_Id = ?`,
        [takeId, facultyId]
      );
      if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const [students] = await pool.query<any[]>(
        `SELECT * FROM lecture_taken_child WHERE Take_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
        [takeId]
      );
      return NextResponse.json({ lecture: rows[0], students });
    }

    // List lectures for a batch
    if (!batchId) {
      return NextResponse.json({ error: 'batchId required' }, { status: 400 });
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = 20;
    const offset = (page - 1) * limit;

    const [lectures] = await pool.query<any[]>(
      `SELECT ltm.Take_Id, ltm.Take_Dt, ltm.Topic, ltm.Lecture_Name, ltm.Duration,
              ltm.ClassRoom, ltm.Faculty_Start, ltm.Faculty_End,
              ltm.Assign_Given, ltm.Test_Given,
              (SELECT COUNT(*) FROM lecture_taken_child ltc
               WHERE ltc.Take_Id = ltm.Take_Id AND (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)) as total_students,
              (SELECT COUNT(*) FROM lecture_taken_child ltc
               WHERE ltc.Take_Id = ltm.Take_Id AND ltc.Student_Atten = 1
               AND (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)) as students_present
       FROM lecture_taken_master ltm
       WHERE ltm.Batch_Id = ? AND ltm.Faculty_Id = ? AND (ltm.IsDelete = 0 OR ltm.IsDelete IS NULL)
       ORDER BY ltm.Take_Dt DESC, ltm.Take_Id DESC
       LIMIT ? OFFSET ?`,
      [batchId, facultyId, limit, offset]
    );

    return NextResponse.json({ lectures });
  } catch (err: unknown) {
    console.error('Daily lecture GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTrainerSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const body = await req.json();
    const { take_id, topic, faculty_start, faculty_end, duration, class_room, next_planning } = body;
    const facultyId = session.facultyId;

    if (!take_id) return NextResponse.json({ error: 'take_id required' }, { status: 400 });

    // Verify ownership
    const [check] = await pool.query<any[]>(
      `SELECT Take_Id FROM lecture_taken_master WHERE Take_Id = ? AND Faculty_Id = ?`,
      [take_id, facultyId]
    );
    if (!check.length) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    await pool.query(
      `UPDATE lecture_taken_master SET
        Topic = COALESCE(?, Topic),
        Faculty_Start = COALESCE(?, Faculty_Start),
        Faculty_End = COALESCE(?, Faculty_End),
        Duration = COALESCE(?, Duration),
        ClassRoom = COALESCE(?, ClassRoom),
        Next_Planning = COALESCE(?, Next_Planning)
       WHERE Take_Id = ?`,
      [topic || null, faculty_start || null, faculty_end || null, duration || null, class_room || null, next_planning || null, take_id]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Daily lecture POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
