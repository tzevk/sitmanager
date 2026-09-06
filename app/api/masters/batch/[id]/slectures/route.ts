import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { computeLectureStatuses } from '@/lib/lecturePlanStatus';
import { ensureBatchTimingColumns } from '@/lib/batchTimingColumns';

/** documents/assignment/etc. are varchar(50) columns; truncate instead of erroring on longer input. */
const truncate = (value: unknown, maxLength = 50): string | null => {
  if (value === null || value === undefined || value === '') return null;
  return String(value).slice(0, maxLength);
};

async function ensureFacultyIdColumn(pool: ReturnType<typeof getPool>) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME AS name
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'batch_slecture_master'
       AND COLUMN_NAME IN ('faculty_id', 'covered_subtopics', 'session')`
  );
  const existing = new Set(rows.map((r) => r.name as string));

  if (!existing.has('faculty_id')) {
    await pool.query(
      `ALTER TABLE batch_slecture_master
       ADD COLUMN faculty_id INT NULL AFTER assignment_date`
    );
  }
  if (!existing.has('covered_subtopics')) {
    await pool.query(
      `ALTER TABLE batch_slecture_master
       ADD COLUMN covered_subtopics TEXT NULL`
    );
  }
  if (!existing.has('session')) {
    await pool.query(
      `ALTER TABLE batch_slecture_master
       ADD COLUMN session VARCHAR(20) NULL AFTER lectureday`
    );
  }
}

// GET - fetch all standard lecture plans for a batch
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const pool = getPool();
    await ensureFacultyIdColumn(pool);
    await ensureBatchTimingColumns(pool);

    // First, get the current batch info (Course_Id -> Course_Name, timing defaults)
    const [batchRows] = await pool.query<RowDataPacket[]>(`
      SELECT b.Course_Id, c.Course_Name, b.Day_Start, b.Day_End, b.Start_Time, b.End_Time
      FROM batch_mst b
      LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id
      WHERE b.Batch_Id = ?
    `, [batchId]);

    const currentBatch = batchRows[0];
    if (!currentBatch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const courseName: string | null = currentBatch.Course_Name || null;
    const batchTimings = {
      dayStart: currentBatch.Day_Start || null,
      dayEnd: currentBatch.Day_End || null,
      startTime: currentBatch.Start_Time || null,
      endTime: currentBatch.End_Time || null,
    };

    // Does the Training Programme have a Standard Lecture Plan at all?
    let hasStandardPlan = false;
    if (courseName) {
      const [templateCountRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM standard_lecture_plan_template WHERE course_name = ?`,
        [courseName]
      );
      hasStandardPlan = Number(templateCountRows[0]?.cnt ?? 0) > 0;
    }

    // Note: the batch's plan is no longer auto-seeded from the template on first load —
    // it starts blank and is populated by dragging topics in (or "Re-sync from Standard Plan").

    // Fetch this batch's lectures
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT
        s.id,
        s.lecture_no,
        s.standard_seq,
        s.actual_seq,
        s.lecture_status,
        s.subject,
        s.subject_topic,
        s.date,
        s.lectureday,
        s.session,
        s.starttime,
        s.endtime,
        s.assignment,
        s.assignment_date,
        s.faculty_id,
        COALESCE(f.Faculty_Name, s.faculty_name) AS faculty_name,
        s.class_room,
        s.documents,
        s.unit_test,
        u.utdate AS unit_test_date,
        u.subject AS unit_test_subject,
        u.duration AS unit_test_duration,
        u.marks AS unit_test_marks,
        s.publish,
        s.lecturecontent,
        s.covered_subtopics,
        lt.Take_Id AS taken_id
      FROM batch_slecture_master s
      LEFT JOIN faculty_master f ON f.Faculty_Id = s.faculty_id
      LEFT JOIN awt_unittesttaken u ON u.id = CAST(s.unit_test AS UNSIGNED)
      LEFT JOIN lecture_taken_master lt
        ON lt.Lecture_Id = s.id AND lt.Batch_Id = s.batch_id AND (lt.IsDelete = 0 OR lt.IsDelete IS NULL)
      WHERE s.batch_id = ? AND (s.deleted IS NULL OR s.deleted = '0')
    `, [batchId]);

    // Recompute Actual Sequence + status on every read (idempotent, self-healing).
    // `lecture_no` is this batch's own, freely-reorderable build position; `standard_seq`
    // stays fixed as the row's original reference number from the Standard Lecture Plan.
    const computed = computeLectureStatuses(
      rows.map((r) => ({ id: r.id, order_seq: r.lecture_no, date: r.date, starttime: r.starttime }))
    );
    const computedById = new Map(computed.map((c) => [c.id, c]));
    const lectures: Array<RowDataPacket & { actual_seq: number | null; lecture_status: string }> = rows
      .map((r) => {
        const c = computedById.get(r.id);
        return { ...r, actual_seq: c?.actual_seq ?? null, lecture_status: c?.lecture_status ?? 'pending' };
      });
    lectures.sort((a, b) => {
        // Conducted rows first, ordered by date ascending; then not-yet-conducted by lecture_no ascending.
        const aConducted = Boolean(a.date);
        const bConducted = Boolean(b.date);
        if (aConducted !== bConducted) return aConducted ? -1 : 1;
        if (aConducted && bConducted) {
          if (a.date !== b.date) return String(a.date) < String(b.date) ? -1 : 1;
          return (a.actual_seq ?? 0) - (b.actual_seq ?? 0);
        }
        const aSeq = a.lecture_no ?? Number.MAX_SAFE_INTEGER;
        const bSeq = b.lecture_no ?? Number.MAX_SAFE_INTEGER;
        return aSeq - bSeq;
      });

    if (computed.length) {
      await Promise.all(
        computed.map((c) =>
          pool.query(`UPDATE batch_slecture_master SET actual_seq = ?, lecture_status = ? WHERE id = ?`, [
            c.actual_seq,
            c.lecture_status,
            c.id,
          ])
        )
      ).catch((err) => console.error('Failed to persist lecture status recompute:', err));
    }

    // Also fetch faculty list for the dropdown
    const [facultyRows] = await pool.query(`
      SELECT Faculty_Id, Faculty_Name
      FROM faculty_master
      WHERE IsActive = 1 AND IsDelete = 0
      ORDER BY Faculty_Name ASC
    `);

    return NextResponse.json({ lectures, facultyList: facultyRows, hasStandardPlan, courseName, batchTimings });
  } catch (error) {
    console.error('Error fetching standard lectures:', error);
    return NextResponse.json({ error: 'Failed to fetch lectures' }, { status: 500 });
  }
}

// POST - add a new standard lecture plan
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const body = await request.json();
    const pool = getPool();
    await ensureFacultyIdColumn(pool);

    const facultyId = body.faculty_id ? Number(body.faculty_id) : null;
    let facultyName = body.faculty_name || null;
    if (facultyId && Number.isFinite(facultyId)) {
      const [fRows] = await pool.query<RowDataPacket[]>(
        `SELECT Faculty_Name FROM faculty_master WHERE Faculty_Id = ? LIMIT 1`,
        [facultyId]
      );
      if (fRows.length) facultyName = fRows[0].Faculty_Name;
    }

    const [result] = await pool.query(`
      INSERT INTO batch_slecture_master
      (batch_id, lecture_no, standard_seq, subject, subject_topic, department, date, lectureday, session, starttime, endtime,
       assignment, assignment_date, faculty_id, faculty_name, class_room, documents, unit_test, publish, lecturecontent,
       covered_subtopics, lecture_status, deleted, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '0', NOW())
    `, [
      batchId,
      body.lecture_no || null,
      body.standard_seq ? Number(body.standard_seq) : null,
      body.subject || null,
      body.subject_topic || null,
      body.department || null,
      truncate(body.date),
      truncate(body.lectureday),
      truncate(body.session, 20),
      truncate(body.starttime),
      truncate(body.endtime),
      truncate(body.assignment),
      truncate(body.assignment_date),
      facultyId,
      truncate(facultyName),
      truncate(body.class_room),
      truncate(body.documents),
      truncate(body.unit_test),
      body.publish || 'No',
      body.lecturecontent || null,
      body.covered_subtopics || null,
    ]);

    return NextResponse.json({ success: true, insertId: (result as { insertId: number }).insertId });
  } catch (error) {
    console.error('Error adding standard lecture:', error);
    return NextResponse.json({ error: 'Failed to add lecture' }, { status: 500 });
  }
}

// PUT - update a standard lecture plan
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Lecture ID required' }, { status: 400 });
    }

    const pool = getPool();
    await ensureFacultyIdColumn(pool);

    const facultyId = data.faculty_id ? Number(data.faculty_id) : null;
    let facultyName = data.faculty_name || null;
    if (facultyId && Number.isFinite(facultyId)) {
      const [fRows] = await pool.query<RowDataPacket[]>(
        `SELECT Faculty_Name FROM faculty_master WHERE Faculty_Id = ? LIMIT 1`,
        [facultyId]
      );
      if (fRows.length) facultyName = fRows[0].Faculty_Name;
    }

    await pool.query(`
      UPDATE batch_slecture_master SET
        lecture_no = ?,
        standard_seq = ?,
        subject = ?,
        subject_topic = ?,
        department = ?,
        date = ?,
        lectureday = ?,
        session = ?,
        starttime = ?,
        endtime = ?,
        assignment = ?,
        assignment_date = ?,
        faculty_id = ?,
        faculty_name = ?,
        class_room = ?,
        documents = ?,
        unit_test = ?,
        publish = ?,
        lecturecontent = ?,
        covered_subtopics = ?
      WHERE id = ?
    `, [
      data.lecture_no || null,
      data.standard_seq != null ? Number(data.standard_seq) : null,
      data.subject || null,
      data.subject_topic || null,
      data.department || null,
      truncate(data.date),
      truncate(data.lectureday),
      truncate(data.session, 20),
      truncate(data.starttime),
      truncate(data.endtime),
      truncate(data.assignment),
      truncate(data.assignment_date),
      facultyId,
      truncate(facultyName),
      truncate(data.class_room),
      truncate(data.documents),
      truncate(data.unit_test),
      data.publish || 'No',
      data.lecturecontent || null,
      data.covered_subtopics || null,
      id,
    ]);

    // Reverse sync: if this plan row is linked to a Lecture Taken record
    // (converted), push the same edit onto it too — otherwise editing a
    // converted row here would only update the plan, leaving Lecture Taken
    // stale again (mirrors the Lecture Taken → Plan sync in the lecture-taken
    // API, which pushes edits made there back onto this table).
    await pool.query(`
      UPDATE lecture_taken_master SET
        Topic = COALESCE(?, Topic),
        Lecture_Name = COALESCE(?, Lecture_Name),
        Sub_Topics = ?,
        Take_Dt = COALESCE(?, Take_Dt),
        Day = ?,
        Session = ?,
        Lecture_Start = ?,
        Lecture_End = ?,
        Faculty_Id = COALESCE(?, Faculty_Id),
        ClassRoom = ?,
        Assign_Given = ?,
        Documents = ?,
        Unit_Test = ?,
        Publish = ?,
        Covered_Subtopics = ?
      WHERE Lecture_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
    `, [
      data.subject || null,
      data.subject || null,
      data.subject_topic || null,
      truncate(data.date),
      truncate(data.lectureday),
      truncate(data.session, 20),
      truncate(data.starttime),
      truncate(data.endtime),
      facultyId,
      truncate(data.class_room),
      truncate(data.assignment),
      truncate(data.documents),
      truncate(data.unit_test),
      data.publish || 'No',
      data.covered_subtopics || null,
      id,
    ]).catch((e) => console.error('Failed to reverse-sync plan edit onto Lecture Taken:', e));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating standard lecture:', error);
    return NextResponse.json({ error: 'Failed to update lecture' }, { status: 500 });
  }
}

// DELETE - soft delete a single lecture, or (?all=1) hard-delete the entire plan for this batch
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const lectureId = searchParams.get('lectureId');
    const all = searchParams.get('all');

    const pool = getPool();
    await ensureFacultyIdColumn(pool);

    if (all === '1') {
      const { id: batchId } = await params;
      await pool.query(`DELETE FROM batch_slecture_master WHERE batch_id = ?`, [batchId]);
      return NextResponse.json({ success: true });
    }

    if (!lectureId) {
      return NextResponse.json({ error: 'Lecture ID required' }, { status: 400 });
    }

    await pool.query(`UPDATE batch_slecture_master SET deleted = '1' WHERE id = ?`, [lectureId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting standard lecture:', error);
    return NextResponse.json({ error: 'Failed to delete lecture' }, { status: 500 });
  }
}
