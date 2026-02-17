import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { ResultSetHeader } from 'mysql2';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool = getPool();

    const [rows] = await pool.query(
      `SELECT id, subject, date, created_date
       FROM batch_feedback_master
       WHERE batch_id = ? AND deleted = 0
       ORDER BY id ASC`,
      [id]
    );

    return NextResponse.json({ feedbacks: rows });
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedbacks' },
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
    const { subject, date } = body;

    const pool = getPool();

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO batch_feedback_master (batch_id, subject, date, created_date, deleted)
       VALUES (?, ?, ?, NOW(), 0)`,
      [id, subject, date || null]
    );

    return NextResponse.json({ 
      success: true, 
      id: result.insertId 
    });
  } catch (error) {
    console.error('Error creating feedback:', error);
    return NextResponse.json(
      { error: 'Failed to create feedback' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
) {
  try {
    const { searchParams } = new URL(request.url);
    const feedbackId = searchParams.get('feedbackId');

    if (!feedbackId) {
      return NextResponse.json(
        { error: 'Feedback ID required' },
        { status: 400 }
      );
    }

    const pool = getPool();

    await pool.query(
      `UPDATE batch_feedback_master SET deleted = 1 WHERE id = ?`,
      [feedbackId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return NextResponse.json(
      { error: 'Failed to delete feedback' },
      { status: 500 }
    );
  }
}
