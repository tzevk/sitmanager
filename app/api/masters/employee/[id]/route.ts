/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

// GET - fetch single employee by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pool = getPool();
    const { id } = await params;

    const [rows] = await pool.query<any[]>(
      `SELECT * FROM office_employee_mst WHERE Emp_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [id]
    );

    if (!rows.length) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err: unknown) {
    console.error('Employee GET by ID error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
