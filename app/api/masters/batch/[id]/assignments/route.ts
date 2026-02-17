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
      `SELECT id, assignmentname, subjects, marks, assignmentdate, created_date
       FROM assignmentstaken
       WHERE batch_id = ? AND deleted = 0
       ORDER BY id ASC`,
      [id]
    );

    return NextResponse.json({ assignments: rows });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
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
    const { assignmentname, subjects, marks, assignmentdate } = body;

    const pool = getPool();

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO assignmentstaken (batch_id, assignmentname, subjects, marks, assignmentdate, created_date, deleted)
       VALUES (?, ?, ?, ?, ?, NOW(), 0)`,
      [id, assignmentname, subjects || null, marks, assignmentdate || null]
    );

    return NextResponse.json({ 
      success: true, 
      id: result.insertId 
    });
  } catch (error) {
    console.error('Error creating assignment:', error);
    return NextResponse.json(
      { error: 'Failed to create assignment' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
) {
  try {
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');

    if (!assignmentId) {
      return NextResponse.json(
        { error: 'Assignment ID required' },
        { status: 400 }
      );
    }

    const pool = getPool();

    await pool.query(
      `UPDATE assignmentstaken SET deleted = 1 WHERE id = ?`,
      [assignmentId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return NextResponse.json(
      { error: 'Failed to delete assignment' },
      { status: 500 }
    );
  }
}
