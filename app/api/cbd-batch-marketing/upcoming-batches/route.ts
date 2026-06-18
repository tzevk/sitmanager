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

  // batch_mst.SDate is stored in mixed formats (ISO, dd-mm-yyyy, dd/mm/yyyy, …),
  // so comparing the raw string against an ISO date drops non-ISO rows. Parse it
  // into a real DATE first and filter/sort on that.
  const SDATE_EXPR =
    `COALESCE(` +
    `STR_TO_DATE(CAST(b.SDate AS CHAR), '%Y-%m-%d'),` +
    `STR_TO_DATE(CAST(b.SDate AS CHAR), '%d-%m-%Y'),` +
    `STR_TO_DATE(CAST(b.SDate AS CHAR), '%d/%m/%Y'),` +
    `STR_TO_DATE(CAST(b.SDate AS CHAR), '%m/%d/%Y'))`;

  let whereSDate = `AND ${SDATE_EXPR} >= ?`;
  if (toDate) {
    whereSDate += ` AND ${SDATE_EXPR} <= ?`;
    params.push(toDate);
  }

  try {
    const [rows] = await pool.query<any[]>(
      `SELECT
         b.Batch_Id,
         b.Batch_code,
         b.Course_Id,
         c.Course_Name,
         DATE_FORMAT(${SDATE_EXPR}, '%Y-%m-%d') AS SDate,
         b.EDate
       FROM batch_mst b
       LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
       WHERE (b.IsDelete IS NULL OR b.IsDelete = 0)
         AND (b.Cancel IS NULL OR b.Cancel = 0)
         ${whereSDate}
       ORDER BY ${SDATE_EXPR} ASC
       LIMIT 500`,
      params
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('upcoming-batches error:', err);
    return NextResponse.json({ error: 'Failed to fetch upcoming batches' }, { status: 500 });
  }
}
