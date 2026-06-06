import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

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

// Helper to adjust dates from previous batch to current batch
function adjustDate(
  originalDate: string | null, 
  prevStartDate: Date, 
  currentStartDate: Date,
  prevEndDate: Date,
  currentEndDate: Date
): string | null {
  if (!originalDate) return null;
  
  const origDate = new Date(originalDate);
  const prevDuration = prevEndDate.getTime() - prevStartDate.getTime();
  const currentDuration = currentEndDate.getTime() - currentStartDate.getTime();
  
  // Calculate the relative position within the previous batch duration
  const relativePosition = (origDate.getTime() - prevStartDate.getTime()) / prevDuration;
  
  // Apply that relative position to the current batch duration
  const newDate = new Date(currentStartDate.getTime() + (relativePosition * currentDuration));
  
  return newDate.toISOString().split('T')[0];
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
    
    // First, get the current batch info (Course_Id, SDate, EDate)
    const [batchRows] = await pool.query<RowDataPacket[]>(`
      SELECT Course_Id, SDate, EDate FROM batch_mst WHERE Batch_Id = ?
    `, [batchId]);
    
    const currentBatch = batchRows[0];
    if (!currentBatch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }
    
    // Check if current batch already has lectures
    const [existingRows] = await pool.query<RowDataPacket[]>(`
      SELECT id FROM batch_slecture_master 
      WHERE batch_id = ? AND (deleted IS NULL OR deleted = '0')
      LIMIT 1
    `, [batchId]);
    
    let lectures: RowDataPacket[] = [];
    
    if (existingRows.length > 0) {
      // Current batch has lectures, fetch them
      const [rows] = await pool.query<RowDataPacket[]>(`
        SELECT 
          s.id,
          s.lecture_no,
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
        ORDER BY s.lecture_no ASC, s.date ASC
      `, [batchId]);
      lectures = rows;
    } else if (currentBatch.Course_Id && currentBatch.SDate && currentBatch.EDate) {
      // No lectures for current batch - find previous batch of same course with lectures
      const [prevBatchRows] = await pool.query<RowDataPacket[]>(`
        SELECT b.Batch_Id, b.SDate, b.EDate
        FROM batch_mst b
        WHERE b.Course_Id = ? 
          AND b.Batch_Id != ?
          AND b.SDate IS NOT NULL 
          AND b.EDate IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM batch_slecture_master s 
            WHERE s.batch_id = b.Batch_Id AND (s.deleted IS NULL OR s.deleted = '0')
          )
        ORDER BY b.SDate DESC
        LIMIT 1
      `, [currentBatch.Course_Id, batchId]);
      
      if (prevBatchRows.length > 0) {
        const prevBatch = prevBatchRows[0];
        
        // Fetch lectures from previous batch
        const [prevLectures] = await pool.query<RowDataPacket[]>(`
          SELECT 
            s.lecture_no,
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
          ORDER BY s.lecture_no ASC, s.date ASC
        `, [prevBatch.Batch_Id]);
        
        // Adjust dates for current batch
        const prevStartDate = new Date(prevBatch.SDate);
        const prevEndDate = new Date(prevBatch.EDate);
        const currentStartDate = new Date(currentBatch.SDate);
        const currentEndDate = new Date(currentBatch.EDate);
        
        // Insert adjusted lectures into current batch and return them
        for (const lec of prevLectures) {
          const adjustedDate = adjustDate(lec.date, prevStartDate, currentStartDate, prevEndDate, currentEndDate);
          const adjustedAssignmentDate = adjustDate(lec.assignment_date, prevStartDate, currentStartDate, prevEndDate, currentEndDate);
          
          const [insertResult] = await pool.query(`
            INSERT INTO batch_slecture_master 
            (batch_id, lecture_no, subject, subject_topic, date, lectureday, starttime, endtime, 
             assignment, assignment_date, faculty_id, faculty_name, class_room, documents, unit_test, publish,
             lecturecontent, deleted, created_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0', NOW())
          `, [
            batchId,
            lec.lecture_no,
            lec.subject,
            lec.subject_topic,
            adjustedDate,
            lec.lectureday,
            lec.starttime,
            lec.endtime,
            lec.assignment,
            adjustedAssignmentDate,
            lec.faculty_id || null,
            lec.faculty_name,
            lec.class_room,
            lec.documents,
            lec.unit_test,
            lec.publish || 'No',
            lec.lecturecontent,
          ]);
          
          lectures.push({
            id: (insertResult as { insertId: number }).insertId,
            lecture_no: lec.lecture_no,
            subject: lec.subject,
            subject_topic: lec.subject_topic,
            date: adjustedDate,
            lectureday: lec.lectureday,
            starttime: lec.starttime,
            endtime: lec.endtime,
            assignment: lec.assignment,
            assignment_date: adjustedAssignmentDate,
            faculty_id: lec.faculty_id,
            faculty_name: lec.faculty_name,
            class_room: lec.class_room,
            documents: lec.documents,
            unit_test: lec.unit_test,
            unit_test_date: lec.unit_test_date,
            publish: lec.publish,
            lecturecontent: lec.lecturecontent,
          } as RowDataPacket);
        }
      }
    }

    // Also fetch faculty list for the dropdown
    const [facultyRows] = await pool.query(`
      SELECT Faculty_Id, Faculty_Name 
      FROM faculty_master 
      WHERE IsActive = 1 AND IsDelete = 0 
      ORDER BY Faculty_Name ASC
    `);

    return NextResponse.json({ lectures, facultyList: facultyRows });
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
      (batch_id, lecture_no, subject, subject_topic, date, lectureday, starttime, endtime, 
       assignment, assignment_date, faculty_id, faculty_name, class_room, documents, unit_test, publish, lecturecontent,
       deleted, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0', NOW())
    `, [
      batchId,
      body.lecture_no || null,
      body.subject || null,
      body.subject_topic || null,
      body.date || null,
      body.lectureday || null,
      body.starttime || null,
      body.endtime || null,
      body.assignment || null,
      body.assignment_date || null,
      facultyId,
      facultyName,
      body.class_room || null,
      body.documents || null,
      body.unit_test || null,
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
      data.date || null,
      data.lectureday || null,
      data.starttime || null,
      data.endtime || null,
      data.assignment || null,
      data.assignment_date || null,
      facultyId,
      facultyName,
      data.class_room || null,
      data.documents || null,
      data.unit_test || null,
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
