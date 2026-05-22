/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

/**
 * Returns upcoming batches from batch_mst, accessible to any authenticated user.
 * This bypasses the `annual_batch.view` permission required by /api/masters/annual-batch,
 * so CBD users can load the Batch Marketing Tracker widget without that permission.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get('fromDate') || new Date().toISOString().slice(0, 10);
  const toDate   = searchParams.get('toDate')   || '';

  const pool = getPool();
  const params: string[] = [fromDate];

  let whereSDate = `AND b.SDate >= ?`;
  if (toDate) {
    whereSDate += ` AND b.SDate <= ?`;
    params.push(toDate);
  }

  try {
    const [rows] = await pool.query<any[]>(
      `SELECT
         b.Batch_Id,
         b.Batch_code,
         b.Course_Id,
         c.Course_Name,
         b.SDate,
         b.EDate
       FROM batch_mst b
       LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
       WHERE (b.IsDelete IS NULL OR b.IsDelete = 0)
         AND (b.Cancel IS NULL OR b.Cancel = 0)
         ${whereSDate}
       ORDER BY b.SDate ASC
       LIMIT 500`,
      params
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('upcoming-batches error:', err);
    return NextResponse.json({ error: 'Failed to fetch upcoming batches' }, { status: 500 });
  }
}
