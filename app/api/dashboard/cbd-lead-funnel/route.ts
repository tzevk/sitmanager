/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

const INQUIRY_DATE_EXPR =
  `COALESCE(` +
  `STR_TO_DATE(LEFT(NULLIF(TRIM(Inquiry_Dt),''),19),'%Y-%m-%d %H:%i:%s'),` +
  `STR_TO_DATE(LEFT(NULLIF(TRIM(Inquiry_Dt),''),10),'%Y-%m-%d'),` +
  `STR_TO_DATE(LEFT(NULLIF(TRIM(Inquiry_Dt),''),10),'%d-%m-%Y'),` +
  `STR_TO_DATE(LEFT(NULLIF(TRIM(Inquiry_Dt),''),10),'%d/%m/%Y'))`;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const year  = parseInt(searchParams.get('year') || '');
  const month = parseInt(searchParams.get('month') || ''); // 1-12, optional

  if (!year || !Number.isFinite(year)) {
    return NextResponse.json({ error: 'year is required' }, { status: 400 });
  }

  const pool = getPool();
  const params: (number | string)[] = [];
  let dateCondition = '';

  if (month && Number.isFinite(month) && month >= 1 && month <= 12) {
    dateCondition = `AND YEAR(${INQUIRY_DATE_EXPR}) = ? AND MONTH(${INQUIRY_DATE_EXPR}) = ?`;
    params.push(year, month);
  } else {
    dateCondition = `AND YEAR(${INQUIRY_DATE_EXPR}) = ?`;
    params.push(year);
  }

  try {
    const [rows] = await pool.query<any[]>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN TRIM(IFNULL(Discussion,'')) <> '' THEN 1 ELSE 0 END) AS contacted,
         SUM(CASE
           WHEN LOWER(IFNULL(Inquiry,'')) IN ('yes','y','interested')
             OR LOWER(IFNULL(JobRequired,'')) IN ('yes','y')
             OR LOWER(IFNULL(Discussion,'')) LIKE '%interested%'
           THEN 1 ELSE 0 END) AS interested,
         SUM(CASE
           WHEN LOWER(IFNULL(Admission,'')) IN ('yes','y','1','true')
             OR IFNULL(admission_done,0) = 1
           THEN 1 ELSE 0 END) AS converted
       FROM student_inquiry
       WHERE (IsDelete = 0 OR IsDelete IS NULL)
       ${dateCondition}`,
      params
    );

    const row = (rows as any[])[0] ?? {};
    return NextResponse.json({
      total:     Number(row.total     || 0),
      contacted: Number(row.contacted || 0),
      interested:Number(row.interested|| 0),
      converted: Number(row.converted || 0),
    });
  } catch (err: any) {
    console.error('cbd-lead-funnel error:', err);
    return NextResponse.json({ error: 'Failed to fetch lead funnel data' }, { status: 500 });
  }
}
