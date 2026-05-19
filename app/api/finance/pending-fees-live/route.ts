/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const limited = await apiRateLimiter(req);
  if (limited) return limited;
  const auth = await requirePermission(req, 'finance.view');
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const search = (url.searchParams.get('q') ?? '').trim();

    const [rows] = await getPool().query<any[]>(
      `SELECT
        am.Admission_Id                                                      AS id,
        IFNULL(sm.Student_Name, 'Unknown')                                  AS student_name,
        TRIM(CONCAT_WS(' — ',
          NULLIF(TRIM(IFNULL(sm.Batch_Code, '')), ''),
          NULLIF(TRIM(IFNULL(c.Course_Name,  '')), '')
        ))                                                                   AS batch,
        CAST(IFNULL(am.Fees, 0) AS DECIMAL(15,2))                           AS total_fees,
        IFNULL(paid.total_paid, 0)                                           AS paid,
        GREATEST(
          CAST(IFNULL(am.Fees, 0) AS DECIMAL(15,2)) - IFNULL(paid.total_paid, 0),
          0
        )                                                                    AS pending,
        NULL                                                                 AS due_date
      FROM admission_master am
      LEFT JOIN student_master sm ON sm.Student_Id = am.Student_Id
      LEFT JOIN course_mst      c  ON c.Course_Id  = sm.Course_Id
      LEFT JOIN (
        SELECT Admission_Id, SUM(IFNULL(Total_Amt, 0)) AS total_paid
        FROM s_fees_mst
        WHERE (IsDelete IS NULL OR IsDelete = 0)
        GROUP BY Admission_Id
      ) paid ON paid.Admission_Id = am.Admission_Id
      WHERE (am.IsDelete = 0 OR am.IsDelete IS NULL)
        AND (am.Cancel IS NULL OR LOWER(TRIM(CAST(am.Cancel AS CHAR))) IN ('no', '0', 'false', ''))
        AND CAST(IFNULL(am.Fees, 0) AS DECIMAL(15,2)) > IFNULL(paid.total_paid, 0)
        ${search ? `AND (sm.Student_Name LIKE ? OR sm.Batch_Code LIKE ? OR c.Course_Name LIKE ?)` : ''}
      ORDER BY pending DESC
      LIMIT 300`,
      search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []
    );

    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}
