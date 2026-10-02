import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { addBatchFinalExam } from '@/lib/final-exam-sitting';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool = getPool();

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT Exam_Id AS id, Subject AS subject, Exam_Date AS exam_date, Max_Marks AS max_marks, Duration AS duration
       FROM batch_final_exam
       WHERE Batch_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Exam_Id ASC`,
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

    // batch_final_exam has no AUTO_INCREMENT; the shared helper allocates Exam_Id
    // (inserting without one left it NULL, so the exam could never be selected).
    const examId = await addBatchFinalExam(pool, {
      batchId: Number(id), subject, examDate: exam_date, maxMarks: max_marks, duration,
    });

    return NextResponse.json({
      success: true,
      id: examId
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
      `UPDATE batch_final_exam SET Subject = ?, Exam_Date = ?, Max_Marks = ?, Duration = ? WHERE Exam_Id = ?`,
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
    const examId = request.nextUrl.searchParams.get('examId');

    if (!examId) {
      return NextResponse.json(
        { error: 'Final Exam ID required' },
        { status: 400 }
      );
    }

    const pool = getPool();

    await pool.query(
      `UPDATE batch_final_exam SET IsDelete = 1 WHERE Exam_Id = ?`,
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
