import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

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
          id,
          lecture_no,
          subject,
          subject_topic,
          date,
          starttime,
          endtime,
          assignment,
          assignment_date,
          faculty_name,
          class_room,
          documents,
          unit_test,
          publish
        FROM batch_slecture_master
        WHERE batch_id = ? AND (deleted IS NULL OR deleted = '0')
        ORDER BY lecture_no ASC, date ASC
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
            lecture_no,
            subject,
            subject_topic,
            date,
            starttime,
            endtime,
            assignment,
            assignment_date,
            faculty_name,
            class_room,
            documents,
            unit_test,
            publish
          FROM batch_slecture_master
          WHERE batch_id = ? AND (deleted IS NULL OR deleted = '0')
          ORDER BY lecture_no ASC, date ASC
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
            (batch_id, lecture_no, subject, subject_topic, date, starttime, endtime, 
             assignment, assignment_date, faculty_name, class_room, documents, unit_test, publish, 
             deleted, created_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0', NOW())
          `, [
            batchId,
            lec.lecture_no,
            lec.subject,
            lec.subject_topic,
            adjustedDate,
            lec.starttime,
            lec.endtime,
            lec.assignment,
            adjustedAssignmentDate,
            lec.faculty_name,
            lec.class_room,
            lec.documents,
            lec.unit_test,
            lec.publish || 'No',
          ]);
          
          lectures.push({
            id: (insertResult as { insertId: number }).insertId,
            lecture_no: lec.lecture_no,
            subject: lec.subject,
            subject_topic: lec.subject_topic,
            date: adjustedDate,
            starttime: lec.starttime,
            endtime: lec.endtime,
            assignment: lec.assignment,
            assignment_date: adjustedAssignmentDate,
            faculty_name: lec.faculty_name,
            class_room: lec.class_room,
            documents: lec.documents,
            unit_test: lec.unit_test,
            publish: lec.publish,
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

    const [result] = await pool.query(`
      INSERT INTO batch_slecture_master 
      (batch_id, lecture_no, subject, subject_topic, date, starttime, endtime, 
       assignment, assignment_date, faculty_name, class_room, documents, unit_test, publish, 
       deleted, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0', NOW())
    `, [
      batchId,
      body.lecture_no || null,
      body.subject || null,
      body.subject_topic || null,
      body.date || null,
      body.starttime || null,
      body.endtime || null,
      body.assignment || null,
      body.assignment_date || null,
      body.faculty_name || null,
      body.class_room || null,
      body.documents || null,
      body.unit_test || null,
      body.publish || 'No',
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
    await pool.query(`
      UPDATE batch_slecture_master SET
        lecture_no = ?,
        subject = ?,
        subject_topic = ?,
        date = ?,
        starttime = ?,
        endtime = ?,
        assignment = ?,
        assignment_date = ?,
        faculty_name = ?,
        class_room = ?,
        documents = ?,
        unit_test = ?,
        publish = ?
      WHERE id = ?
    `, [
      data.lecture_no || null,
      data.subject || null,
      data.subject_topic || null,
      data.date || null,
      data.starttime || null,
      data.endtime || null,
      data.assignment || null,
      data.assignment_date || null,
      data.faculty_name || null,
      data.class_room || null,
      data.documents || null,
      data.unit_test || null,
      data.publish || 'No',
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
    await pool.query(`UPDATE batch_slecture_master SET deleted = '1' WHERE id = ?`, [lectureId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting standard lecture:', error);
    return NextResponse.json({ error: 'Failed to delete lecture' }, { status: 500 });
  }
}
