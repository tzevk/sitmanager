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

    // Get all convocation records for this batch
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, faculty_name, guest_name, guest_mobile, email, guest_designation, created_date
       FROM batch_convocation
       WHERE batch_id = ? AND deleted = 0
       ORDER BY id DESC`,
      [id]
    );

    // Get convocation date/day from batch_mst
    const [batchRows] = await pool.query<RowDataPacket[]>(
      `SELECT ConvocationDate, Convocationday FROM batch_mst WHERE Batch_Id = ?`,
      [id]
    );

    // Get faculty list for dropdown
    const [faculty] = await pool.query<RowDataPacket[]>(
      `SELECT Faculty_Id, Faculty_Name 
       FROM faculty_master 
       WHERE IsActive = 1 AND IsDelete = 0
       ORDER BY Faculty_Name ASC`
    );

    return NextResponse.json({ 
      convocations: rows,
      convocationDate: batchRows[0]?.ConvocationDate || null,
      convocationDay: batchRows[0]?.Convocationday || null,
      facultyList: faculty 
    });
  } catch (error) {
    console.error('Error fetching convocations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch convocations' },
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
    const { faculty_name, guest_name, guest_mobile, email, guest_designation } = body;

    const pool = getPool();

    // Insert new convocation record
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO batch_convocation (batch_id, faculty_name, guest_name, guest_mobile, email, guest_designation, created_date, deleted)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), 0)`,
      [id, faculty_name, guest_name, guest_mobile, email, guest_designation]
    );

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Error saving convocation:', error);
    return NextResponse.json(
      { error: 'Failed to save convocation' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const convocationId = searchParams.get('convocationId');

    if (!convocationId) {
      return NextResponse.json({ error: 'Convocation ID required' }, { status: 400 });
    }

    const pool = getPool();
    await pool.query(
      `UPDATE batch_convocation SET deleted = 1 WHERE id = ?`,
      [convocationId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting convocation:', error);
    return NextResponse.json(
      { error: 'Failed to delete convocation' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { convocation_date, convocation_day } = body;

    const pool = getPool();

    // Update convocation date/day in batch_mst
    await pool.query(
      `UPDATE batch_mst SET ConvocationDate = ?, Convocationday = ? WHERE Batch_Id = ?`,
      [convocation_date || null, convocation_day || null, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating convocation date:', error);
    return NextResponse.json(
      { error: 'Failed to update convocation date' },
      { status: 500 }
    );
  }
}
