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
      `SELECT id, subject, utdate, duration, marks, created_date
       FROM awt_unittesttaken
       WHERE batch_id = ? AND deleted = 0
       ORDER BY id ASC`,
      [id]
    );

    return NextResponse.json({ unittests: rows });
  } catch (error) {
    console.error('Error fetching unit tests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unit tests' },
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
    const { subject, utdate, duration, marks } = body;

    const pool = getPool();

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO awt_unittesttaken (batch_id, subject, utdate, duration, marks, created_date, deleted)
       VALUES (?, ?, ?, ?, ?, NOW(), 0)`,
      [id, subject, utdate || null, duration || null, marks || null]
    );

    return NextResponse.json({ 
      success: true, 
      id: result.insertId 
    });
  } catch (error) {
    console.error('Error creating unit test:', error);
    return NextResponse.json(
      { error: 'Failed to create unit test' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
) {
  try {
    const { searchParams } = new URL(request.url);
    const unittestId = searchParams.get('unittestId');

    if (!unittestId) {
      return NextResponse.json(
        { error: 'Unit Test ID required' },
        { status: 400 }
      );
    }

    const pool = getPool();

    await pool.query(
      `UPDATE awt_unittesttaken SET deleted = 1 WHERE id = ?`,
      [unittestId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting unit test:', error);
    return NextResponse.json(
      { error: 'Failed to delete unit test' },
      { status: 500 }
    );
  }
}
