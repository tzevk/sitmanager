import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// GET - fetch all lecture plans for a batch
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const pool = getPool();
    
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT 
        l.id,
        l.lecture_no,
        l.subject,
        l.subject_topic,
        l.date,
        l.starttime,
        l.endtime,
        l.assignment,
        l.assignment_date,
        COALESCE(fId.Faculty_Id, fName.Faculty_Id, l.faculty_name) AS faculty_id,
        COALESCE(fId.Faculty_Name, fName.Faculty_Name) AS faculty_name_display,
        l.class_room,
        l.documents,
        l.unit_test,
        l.publish,
        l.duration,
        l.marks,
        l.lectureday,
        l.module,
        l.planned,
        l.department,
        l.practicetest,
        l.lecturecontent,
        l.status
      FROM batch_lecture_master l
      LEFT JOIN faculty_master fId ON l.faculty_name = fId.Faculty_Id
      LEFT JOIN faculty_master fName ON l.faculty_name = fName.Faculty_Name
      WHERE l.batch_id = ? AND (l.deleted IS NULL OR l.deleted = '0')
      ORDER BY l.lecture_no ASC, l.date ASC
    `, [batchId]);

    // Also fetch faculty list for the dropdown
    const [facultyRows] = await pool.query(`
      SELECT Faculty_Id, Faculty_Name 
      FROM faculty_master 
      WHERE IsActive = 1 AND IsDelete = 0 
      ORDER BY Faculty_Name ASC
    `);

    return NextResponse.json({ lectures: rows, facultyList: facultyRows });
  } catch (error) {
    console.error('Error fetching lectures:', error);
    return NextResponse.json({ error: 'Failed to fetch lectures' }, { status: 500 });
  }
}

// POST - add a new lecture plan
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const body = await request.json();
    const pool = getPool();

    const [result] = await pool.query(`
      INSERT INTO batch_lecture_master 
      (batch_id, lecture_no, subject, subject_topic, date, starttime, endtime, 
       assignment, assignment_date, faculty_name, class_room, documents, unit_test, publish,
       lecturecontent, deleted, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0', NOW())
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
      body.faculty_id || null,  // stored in faculty_name column (which holds faculty ID)
      body.class_room || null,
      body.documents || null,
      body.unit_test || null,
      body.publish || 'No',
      body.lecturecontent || body.subject || null,
    ]);

    return NextResponse.json({ success: true, insertId: (result as { insertId: number }).insertId });
  } catch (error) {
    console.error('Error adding lecture:', error);
    return NextResponse.json({ error: 'Failed to add lecture' }, { status: 500 });
  }
}

// PUT - update a lecture plan
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Lecture ID required' }, { status: 400 });
    }

    const pool = getPool();
    await pool.query(`
      UPDATE batch_lecture_master SET
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
        publish = ?,
        lecturecontent = ?
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
      data.faculty_id || null,  // stored in faculty_name column (which holds faculty ID)
      data.class_room || null,
      data.documents || null,
      data.unit_test || null,
      data.publish || 'No',
      data.lecturecontent || data.subject || null,
      id,
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating lecture:', error);
    return NextResponse.json({ error: 'Failed to update lecture' }, { status: 500 });
  }
}

// DELETE - soft delete a lecture plan
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lectureId = searchParams.get('lectureId');
    
    if (!lectureId) {
      return NextResponse.json({ error: 'Lecture ID required' }, { status: 400 });
    }

    const pool = getPool();
    await pool.query(`UPDATE batch_lecture_master SET deleted = '1' WHERE id = ?`, [lectureId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lecture:', error);
    return NextResponse.json({ error: 'Failed to delete lecture' }, { status: 500 });
  }
}
