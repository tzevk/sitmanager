/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getTrainerSession } from '@/app/api/trainer-portal/auth/session/route';
import { ensureTrainerPlanColumns } from '@/lib/trainer-plan-columns';
import { ensureBatchTrainerTable, TRAINER_BATCH_CONDITION, trainerBatchParams, trainerCanAccessBatch } from '@/lib/batch-trainers';

/* GET — The trainer's batches, or one batch's lecture plan (whole plan, or one month with ?month=YYYY-MM)
   from the Standard Lecture Plan (batch_slecture_master), fallback to batch_lecture_master */
export async function GET(req: NextRequest) {
  try {
    const session = await getTrainerSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    const month = searchParams.get('month'); // YYYY-MM format
    const facultyId = session.facultyId;

    await ensureBatchTrainerTable(pool);

    // Batches linked to this trainer (Batch Master "Trainers", see
    // lib/batch-trainers.ts), auto-classified as current vs closed by end date.
    if (!batchId) {
      const [batches] = await pool.query<any[]>(
        `SELECT b.Batch_Id, b.Batch_code, c.Course_Name, b.SDate, b.EDate, b.Timings,
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
         WHERE ${TRAINER_BATCH_CONDITION}
           AND (b.Cancel = 0 OR b.Cancel IS NULL)
         ORDER BY Is_Closed ASC, Is_Current DESC, b.EDate DESC, b.Batch_Id DESC
         LIMIT 20`,
        trainerBatchParams(facultyId)
      );

      const currentBatches = (batches || []).filter((b) => Number(b.Is_Closed || 0) === 0);
      const closedBatches = (batches || []).filter((b) => Number(b.Is_Closed || 0) === 1);

      return NextResponse.json({
        batches: currentBatches,
        current_batches: currentBatches,
        closed_batches: closedBatches,
      });
    }

    if (!(await trainerCanAccessBatch(pool, facultyId, Number(batchId)))) {
      return NextResponse.json({ error: 'This batch is not linked to you.' }, { status: 403 });
    }
    await ensureTrainerPlanColumns(pool);

    // Get planned lectures for month from Standard Lecture Plan first
    let dateFilter = '';
    const params: any[] = [batchId];

    if (month) {
      dateFilter = ` AND s.date LIKE ?`;
      params.push(`${month}%`);
    }

    // Same fields the Student Portal lecture plan shows (session, timings,
    // topics, unit test date), plus what the trainer needs to record the day.
    const [stdLecturesRaw] = await pool.query<any[]>(
      `SELECT s.id, s.lecture_no, s.subject_topic, s.subject, s.faculty_id, s.faculty_name, s.date,
              s.starttime, s.endtime, s.duration, s.class_room, s.assignment, s.unit_test,
              u.utdate AS unit_test_date, s.session, s.lecture_status, s.covered_subtopics,
              s.trainer_in_time, s.trainer_out_time,
              s.module, s.planned, s.status, s.marks,
              s.lecturecontent,
              EXISTS (SELECT 1 FROM lecture_taken_master lt
                      WHERE lt.Lecture_Id = s.id AND lt.Batch_Id = s.batch_id
                        AND (lt.IsDelete = 0 OR lt.IsDelete IS NULL)) AS taken
       FROM batch_slecture_master s
       LEFT JOIN awt_unittesttaken u ON u.id = CAST(s.unit_test AS UNSIGNED)
       WHERE s.batch_id = ? AND (s.deleted = '0' OR s.deleted IS NULL OR s.deleted = 0)${dateFilter}
       ORDER BY s.date ASC, s.lecture_no ASC`,
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
       WHERE batch_id = ? AND (deleted = '0' OR deleted IS NULL OR deleted = 0)${dateFilter.replace('s.date', 'date')}
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
