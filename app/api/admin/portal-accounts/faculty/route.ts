/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'user.create');
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getPool();

    const [rows] = await pool.query<any[]>(
      `SELECT Faculty_Id, Faculty_Name, IsActive
       FROM faculty_master
       WHERE (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Faculty_Id DESC`
    );

    return NextResponse.json({ rows });
  } catch (err: unknown) {
    console.error('Admin portal-accounts faculty list error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
