import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pool = getPool();
    const { id } = await params;
    
    // ID is the URL-encoded category name
    const categoryName = decodeURIComponent(id);

    const sql = `
      SELECT DISTINCT Category AS batch
      FROM batch_mst
      WHERE Category = ?
        AND IsActive = 1
        AND (IsDelete = 0 OR IsDelete IS NULL)
      LIMIT 1
    `;
    const [rows] = await pool.query<any[]>(sql, [categoryName]);

    if (!rows.length) {
      return NextResponse.json({ error: 'Batch Category not found' }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Batch Category [id] GET error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
