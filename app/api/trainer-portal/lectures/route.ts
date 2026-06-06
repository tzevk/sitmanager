/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getTrainerSession } from '@/app/api/trainer-portal/auth/session/route';

/* GET — Monthly lecture plan from Standard Lecture Plan (batch_slecture_master), fallback to batch_lecture_master */
export async function GET(req: NextRequest) {
  try {
    const session = await getTrainerSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    const month = searchParams.get('month'); // YYYY-MM format
    const facultyId = session.facultyId;

    // Get batches this trainer is assigned to (from both standard plan and taken lectures),
    // and auto-classify them as current vs closed by end date.
    if (!batchId) {
      const [batches] = await pool.query<any[]>(
        `SELECT DISTINCT b.Batch_Id, b.Batch_code, c.Course_Name, b.SDate, b.EDate, b.Timings,
                CASE
                  WHEN b.EDate IS NOT NULL AND DATE(b.EDate) < CURDATE() THEN 1
                  ELSE 0
                END AS Is_Closed,
                CASE
                  WHEN b.SDate IS NOT NULL AND b.EDate IS NOT NULL AND CURDATE() BETWEEN DATE(b.SDate) AND DATE(b.EDate)
                    THEN 1
                  ELSE 0
                END AS Is_Current
         FROM batch_mst b
         LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
         LEFT JOIN batch_slecture_master bsl
           ON bsl.batch_id = b.Batch_Id
          AND (bsl.deleted IS NULL OR bsl.deleted = '0' OR bsl.deleted = 0)
          AND bsl.faculty_id = ?
         LEFT JOIN lecture_taken_master ltm
           ON ltm.Batch_Id = b.Batch_Id
          AND (ltm.IsDelete = 0 OR ltm.IsDelete IS NULL)
          AND ltm.Faculty_Id = ?
         WHERE (bsl.id IS NOT NULL OR ltm.Take_Id IS NOT NULL)
           AND (b.Cancel = 0 OR b.Cancel IS NULL)
         ORDER BY Is_Closed ASC, Is_Current DESC, b.EDate DESC, b.Batch_Id DESC
         LIMIT 20`,
        [facultyId, facultyId]
      );

      const currentBatches = (batches || []).filter((b) => Number(b.Is_Closed || 0) === 0);
      const closedBatches = (batches || []).filter((b) => Number(b.Is_Closed || 0) === 1);

      return NextResponse.json({
        batches: currentBatches,
        current_batches: currentBatches,
        closed_batches: closedBatches,
      });
    }

    // Get planned lectures for month from Standard Lecture Plan first
    let dateFilter = '';
    const params: any[] = [batchId];

    if (month) {
      dateFilter = ` AND date LIKE ?`;
      params.push(`${month}%`);
    }

    const [stdLecturesRaw] = await pool.query<any[]>(
      `SELECT id, lecture_no, subject_topic, subject, faculty_name, date,
              starttime, endtime, duration, class_room, assignment, unit_test,
              module, planned, status, marks,
              lecturecontent
       FROM batch_slecture_master
       WHERE batch_id = ? AND (deleted = '0' OR deleted IS NULL OR deleted = 0)${dateFilter}
       ORDER BY date ASC, lecture_no ASC`,
      params
    );

    const stdLectures = (stdLecturesRaw || []).map((l: any) => ({
      ...l,
      lecturecontent: l.lecturecontent ?? l.lecture_content ?? null,
    }));

    const hasStandardData = stdLectures.some((l: any) =>
      String(l?.lecturecontent ?? l?.subject ?? l?.subject_topic ?? '').trim()
    );

    if (hasStandardData) {
      return NextResponse.json({ lectures: stdLectures, source: 'standard' });
    }

    // Fallback to lecture plan only when standard lecture plan has no usable rows.
    const [legacyLecturesRaw] = await pool.query<any[]>(
      `SELECT id, lecture_no, subject_topic, subject, faculty_name, date,
              starttime, endtime, duration, class_room, assignment, unit_test,
              module, planned, status, marks,
              lecturecontent
       FROM batch_lecture_master
       WHERE batch_id = ? AND (deleted = '0' OR deleted IS NULL OR deleted = 0)${dateFilter}
       ORDER BY date ASC, lecture_no ASC`,
      params
    );

    const lectures = (legacyLecturesRaw || []).map((l: any) => ({
      ...l,
      lecturecontent: l.lecturecontent ?? l.lecture_content ?? null,
    }));

    return NextResponse.json({ lectures, source: 'fallback-lecture-plan' });
  } catch (err: unknown) {
    console.error('Lecture plan error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
