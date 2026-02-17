import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

/* GET: list active batch categories */
export async function GET() {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, BatchCategory, Batch_Type, Prefix, Description
       FROM mst_batchcategory
       WHERE IsActive = 1 AND (IsDelete IS NULL OR IsDelete = 0)
       ORDER BY BatchCategory`
    );
    return NextResponse.json(rows);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch categories';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
