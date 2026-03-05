/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// GET - single consultancy
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(req, 'consultancy.view');
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const pool = getPool();

    const [rows] = await pool.query<any[]>(
      `SELECT * FROM consultant_mst WHERE Const_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [id]
    );

    if (!rows.length) {
      return NextResponse.json({ error: 'Consultancy not found' }, { status: 404 });
    }

    return NextResponse.json({ row: rows[0] });
  } catch (err: unknown) {
    console.error('Consultancy [id] GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
