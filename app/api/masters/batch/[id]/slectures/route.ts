import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { computeLectureStatuses } from '@/lib/lecturePlanStatus';

/** documents/assignment/etc. are varchar(50) columns; truncate instead of erroring on longer input. */
const truncate = (value: unknown, maxLength = 50): string | null => {
  if (value === null || value === undefined || value === '') return null;
  return String(value).slice(0, maxLength);
};

async function ensureFacultyIdColumn(pool: ReturnType<typeof getPool>) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'batch_slecture_master'
       AND COLUMN_NAME = 'faculty_id'`
  );
  const cnt = Number(rows?.[0]?.cnt ?? 0);
  if (cnt > 0) return;

  await pool.query(
    `ALTER TABLE batch_slecture_master
     ADD COLUMN faculty_id INT NULL AFTER assignment_date`
  );
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

    // First, get the current batch info (Course_Id -> Course_Name)
    const [batchRows] = await pool.query<RowDataPacket[]>(`
      SELECT b.Course_Id, c.Course_Name
      FROM batch_mst b
      LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id
      WHERE b.Batch_Id = ?
    `, [batchId]);

    const currentBatch = batchRows[0];
    if (!currentBatch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const courseName: string | null = currentBatch.Course_Name || null;

    // Does the Training Programme have a Standard Lecture Plan at all?
    let hasStandardPlan = false;
    if (courseName) {
      const [templateCountRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM standard_lecture_plan_template WHERE course_name = ?`,
        [courseName]
      );
      hasStandardPlan = Number(templateCountRows[0]?.cnt ?? 0) > 0;
    }

    // Check if current batch already has lectures
    const [existingRows] = await pool.query<RowDataPacket[]>(`
      SELECT id FROM batch_slecture_master
      WHERE batch_id = ? AND (deleted IS NULL OR deleted = '0')
      LIMIT 1
    `, [batchId]);

    if (existingRows.length === 0 && hasStandardPlan && courseName) {
      // Seed this batch's plan from the Standard Lecture Plan template for its Training Programme.
      const [templateRows] = await pool.query<RowDataPacket[]>(`
        SELECT lecture_no, department, module, sub_topics, faculty, project_assignment
        FROM standard_lecture_plan_template
        WHERE course_name = ?
        ORDER BY lecture_no ASC
      `, [courseName]);

      for (const t of templateRows) {
        await pool.query(`
          INSERT INTO batch_slecture_master
          (batch_id, lecture_no, standard_seq, subject, subject_topic, department, faculty_name, publish,
           lecture_status, deleted, created_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'No', 'pending', '0', NOW())
        `, [
          batchId,
          t.lecture_no,
          t.lecture_no,
          t.module,
          t.sub_topics,
          t.department,
          t.faculty,
        ]);
      }
    }

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
        s.publish,
        s.lecturecontent
      FROM batch_slecture_master s
      LEFT JOIN faculty_master f ON f.Faculty_Id = s.faculty_id
      LEFT JOIN awt_unittesttaken u ON u.id = CAST(s.unit_test AS UNSIGNED)
      WHERE s.batch_id = ? AND (s.deleted IS NULL OR s.deleted = '0')
    `, [batchId]);

    // Recompute Actual Sequence + status on every read (idempotent, self-healing).
    const computed = computeLectureStatuses(
      rows.map((r) => ({ id: r.id, standard_seq: r.standard_seq, date: r.date, starttime: r.starttime }))
    );
    const computedById = new Map(computed.map((c) => [c.id, c]));
    const lectures: Array<RowDataPacket & { actual_seq: number | null; lecture_status: string }> = rows
      .map((r) => {
        const c = computedById.get(r.id);
        return { ...r, actual_seq: c?.actual_seq ?? null, lecture_status: c?.lecture_status ?? 'pending' };
      });
    lectures.sort((a, b) => {
        // Conducted rows first, ordered by date ascending; then not-yet-conducted by standard_seq ascending.
        const aConducted = Boolean(a.date);
        const bConducted = Boolean(b.date);
        if (aConducted !== bConducted) return aConducted ? -1 : 1;
        if (aConducted && bConducted) {
          if (a.date !== b.date) return String(a.date) < String(b.date) ? -1 : 1;
          return (a.actual_seq ?? 0) - (b.actual_seq ?? 0);
        }
        const aSeq = a.standard_seq ?? Number.MAX_SAFE_INTEGER;
        const bSeq = b.standard_seq ?? Number.MAX_SAFE_INTEGER;
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

    return NextResponse.json({ lectures, facultyList: facultyRows, hasStandardPlan, courseName });
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
      (batch_id, lecture_no, standard_seq, subject, subject_topic, date, lectureday, starttime, endtime,
       assignment, assignment_date, faculty_id, faculty_name, class_room, documents, unit_test, publish, lecturecontent,
       lecture_status, deleted, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '0', NOW())
    `, [
      batchId,
      body.lecture_no || null,
      body.standard_seq ? Number(body.standard_seq) : null,
      body.subject || null,
      body.subject_topic || null,
      truncate(body.date),
      truncate(body.lectureday),
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
        subject = ?,
        subject_topic = ?,
        date = ?,
        lectureday = ?,
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
        lecturecontent = ?
      WHERE id = ?
    `, [
      data.lecture_no || null,
      data.subject || null,
      data.subject_topic || null,
      truncate(data.date),
      truncate(data.lectureday),
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
      id,
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating standard lecture:', error);
    return NextResponse.json({ error: 'Failed to update lecture' }, { status: 500 });
  }
}

// DELETE - soft delete a standard lecture plan
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lectureId = searchParams.get('lectureId');
    
    if (!lectureId) {
      return NextResponse.json({ error: 'Lecture ID required' }, { status: 400 });
    }

    const pool = getPool();
    await ensureFacultyIdColumn(pool);
    await pool.query(`UPDATE batch_slecture_master SET deleted = '1' WHERE id = ?`, [lectureId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting standard lecture:', error);
    return NextResponse.json({ error: 'Failed to delete lecture' }, { status: 500 });
  }
}
