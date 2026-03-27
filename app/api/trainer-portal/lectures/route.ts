/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getTrainerSession } from '@/app/api/trainer-portal/auth/session/route';

/* GET — Monthly lecture plan from batch_lecture_master */
export async function GET(req: NextRequest) {
  try {
    const session = await getTrainerSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    const month = searchParams.get('month'); // YYYY-MM format
    const facultyId = session.facultyId;

    // Get batches this trainer is assigned to
    if (!batchId) {
      const [batches] = await pool.query<any[]>(
        `SELECT DISTINCT ltm.Batch_Id, b.Batch_code, c.Course_Name
         FROM lecture_taken_master ltm
         JOIN batch_mst b ON ltm.Batch_Id = b.Batch_Id
         LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
         WHERE ltm.Faculty_Id = ? AND (ltm.IsDelete = 0 OR ltm.IsDelete IS NULL)
           AND (b.Cancel = 0 OR b.Cancel IS NULL)
         ORDER BY b.Batch_Id DESC
         LIMIT 20`,
        [facultyId]
      );
      return NextResponse.json({ batches });
    }

    // Get planned lectures for month
    let dateFilter = '';
    const params: any[] = [batchId];

    if (month) {
      dateFilter = ` AND date LIKE ?`;
      params.push(`${month}%`);
    }

    const [lecturesRaw] = await pool.query<any[]>(
      `SELECT id, lecture_no, subject_topic, subject, faculty_name, date,
              starttime, endtime, duration, class_room, assignment, unit_test,
              module, planned, status, marks,
              lecturecontent
       FROM batch_lecture_master
       WHERE batch_id = ? AND (deleted = '0' OR deleted IS NULL)${dateFilter}
       ORDER BY date ASC, lecture_no ASC`,
      params
    );

    // Normalize lecture content field (DB may return `lecturecontent` or `lecture_content`)
    const lectures = (lecturesRaw || []).map((l: any) => ({
      ...l,
      lecturecontent: l.lecturecontent ?? l.lecture_content ?? null,
    }));

    return NextResponse.json({ lectures });
  } catch (err: unknown) {
    console.error('Lecture plan error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
