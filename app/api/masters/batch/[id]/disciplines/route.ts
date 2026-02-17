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
      `SELECT id, subject, date, marks, created_date
       FROM batch_moc_master
       WHERE batch_id = ? AND deleted = 0
       ORDER BY id ASC`,
      [id]
    );

    return NextResponse.json({ disciplines: rows });
  } catch (error) {
    console.error('Error fetching disciplines:', error);
    return NextResponse.json(
      { error: 'Failed to fetch disciplines' },
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
    const { subject, date, marks } = body;

    const pool = getPool();

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO batch_moc_master (batch_id, subject, date, marks, created_date, deleted)
       VALUES (?, ?, ?, ?, NOW(), 0)`,
      [id, subject, date || null, marks || null]
    );

    return NextResponse.json({ 
      success: true, 
      id: result.insertId 
    });
  } catch (error) {
    console.error('Error creating discipline:', error);
    return NextResponse.json(
      { error: 'Failed to create discipline' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
) {
  try {
    const { searchParams } = new URL(request.url);
    const disciplineId = searchParams.get('disciplineId');

    if (!disciplineId) {
      return NextResponse.json(
        { error: 'Discipline ID required' },
        { status: 400 }
      );
    }

    const pool = getPool();

    await pool.query(
      `UPDATE batch_moc_master SET deleted = 1 WHERE id = ?`,
      [disciplineId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting discipline:', error);
    return NextResponse.json(
      { error: 'Failed to delete discipline' },
      { status: 500 }
    );
  }
}
