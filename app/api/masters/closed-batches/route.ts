/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'batch.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = String(searchParams.get('search') || '').trim();

    const whereParts = [
      'b.EDate IS NOT NULL',
      'DATE(b.EDate) < CURDATE()',
      '(b.Cancel = 0 OR b.Cancel IS NULL)',
    ];
    const params: Array<string | number> = [];

    if (search) {
      whereParts.push('(b.Batch_code LIKE ? OR c.Course_Name LIKE ? OR b.Category LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q);
    }

    const where = whereParts.join(' AND ');

    const [countRows] = await pool.query<any[]>(
      `SELECT COUNT(*) AS total
       FROM batch_mst b
       LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
       WHERE ${where}`,
      params
    );
    const total = Number(countRows?.[0]?.total ?? 0);

    const [rows] = await pool.query<any[]>(
      `SELECT b.Batch_Id, b.Batch_code, b.SDate, b.EDate, b.Timings, b.Category,
              c.Course_Name
       FROM batch_mst b
       LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
       WHERE ${where}
       ORDER BY b.EDate DESC, b.Batch_Id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: unknown) {
    console.error('Closed batches API error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
