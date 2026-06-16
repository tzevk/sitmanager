/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, ['report_fees.view', 'finance.view']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const mode = (searchParams.get('mode') ?? '').trim();
    const q = (searchParams.get('q') ?? '').trim();
    const courseId = searchParams.get('courseId') ?? '';
    const batchId = searchParams.get('batchId') ?? '';

    if (mode === 'recent') {
      const [recentRows] = await getPool().query<any[]>(
        `SELECT
           f.Fees_Id,
           f.Student_Id,
           sm.Student_Name,
           cm.Course_Name,
           bm.Batch_code,
           f.Fees_Code,
           COALESCE(f.RDate, f.Date_Added) AS Receipt_Date,
           f.Payment_Type,
           f.Amount
         FROM s_fees_mst f
         LEFT JOIN student_master sm ON sm.Student_Id = f.Student_Id
         LEFT JOIN course_mst cm ON cm.Course_Id = sm.Course_Id
         LEFT JOIN batch_mst bm  ON bm.Batch_code = sm.Batch_Code
         WHERE f.TypeR = 'C'
           AND COALESCE(NULLIF(TRIM(f.Fees_Code), ''), '') <> ''
           AND (f.IsDelete = 0 OR f.IsDelete IS NULL)
           AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
         ORDER BY COALESCE(f.RDate, f.Date_Added) DESC, f.Fees_Id DESC
         LIMIT 200`
      );

      return NextResponse.json({ rows: recentRows });
    }

    const conditions = ['(sm.IsDelete = 0 OR sm.IsDelete IS NULL)'];
    const params: any[] = [];

    if (q) {
      conditions.push('(sm.Student_Name LIKE ? OR sm.Student_Id = ? OR bm.Batch_code LIKE ?)');
      params.push(`%${q}%`, Number(q) || 0, `%${q}%`);
    }
    if (courseId) {
      conditions.push('sm.Course_Id = ?');
      params.push(Number(courseId));
    }
    if (batchId) {
      conditions.push('bm.Batch_Id = ?');
      params.push(Number(batchId));
    }
    if (!q && !batchId) {
      conditions.push('1 = 0');
    }

    const [rows] = await getPool().query<any[]>(
      `SELECT
         sm.Student_Id, sm.Student_Name, sm.Present_Mobile, sm.Email,
         cm.Course_Name, bm.Batch_code, bm.Batch_Id,
         COALESCE(am.Fees, bm.Fees_Full_Payment, 0)            AS Total_Fees,
         IFNULL((
           SELECT SUM(f.Total_Amt) FROM s_fees_mst f
           WHERE f.Student_Id = sm.Student_Id AND f.TypeR = 'C' AND (f.IsDelete = 0 OR f.IsDelete IS NULL)
         ), 0)                                                  AS Total_Paid
       FROM student_master sm
       LEFT JOIN course_mst cm ON cm.Course_Id = sm.Course_Id
       LEFT JOIN batch_mst bm  ON bm.Batch_code = sm.Batch_Code
       LEFT JOIN admission_master am ON am.Student_Id = sm.Student_Id AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
       WHERE ${conditions.join(' AND ')}
       ORDER BY sm.Student_Id DESC
       LIMIT 50`,
      params
    );

    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}
