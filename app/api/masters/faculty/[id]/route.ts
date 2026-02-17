/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool = getPool();

    const [rows] = await pool.query<any[]>(
      `SELECT * FROM faculty_master WHERE Faculty_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Faculty not found' }, { status: 404 });
    }

    return NextResponse.json({ faculty: rows[0] });
  } catch (err: unknown) {
    console.error('Faculty [id] GET error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
