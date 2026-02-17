import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool = getPool();

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, subject, exam_date, max_marks, duration, created_date
       FROM batch_final_exam
       WHERE batch_id = ? AND deleted = 0
       ORDER BY id ASC`,
      [id]
    );

    return NextResponse.json({ finalexams: rows });
  } catch (error) {
    console.error('Error fetching final exams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch final exams' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { subject, exam_date, max_marks, duration } = body;

    const pool = getPool();

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO batch_final_exam (batch_id, subject, exam_date, max_marks, duration, created_date, deleted)
       VALUES (?, ?, ?, ?, ?, NOW(), 0)`,
      [id, subject, exam_date || null, max_marks || null, duration || null]
    );

    return NextResponse.json({ 
      success: true, 
      id: result.insertId 
    });
  } catch (error) {
    console.error('Error creating final exam:', error);
    return NextResponse.json(
      { error: 'Failed to create final exam' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, subject, exam_date, max_marks, duration } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Final Exam ID required' },
        { status: 400 }
      );
    }

    const pool = getPool();

    await pool.query(
      `UPDATE batch_final_exam SET subject = ?, exam_date = ?, max_marks = ?, duration = ? WHERE id = ?`,
      [subject, exam_date || null, max_marks || null, duration || null, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating final exam:', error);
    return NextResponse.json(
      { error: 'Failed to update final exam' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');

    if (!examId) {
      return NextResponse.json(
        { error: 'Final Exam ID required' },
        { status: 400 }
      );
    }

    const pool = getPool();

    await pool.query(
      `UPDATE batch_final_exam SET deleted = 1 WHERE id = ?`,
      [examId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting final exam:', error);
    return NextResponse.json(
      { error: 'Failed to delete final exam' },
      { status: 500 }
    );
  }
}
