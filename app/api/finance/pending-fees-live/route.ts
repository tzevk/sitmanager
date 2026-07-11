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

    // Same exact Total Fees / Total Paid formula as lib/fee-balance.ts (Fee
    // Details / the Fee Report / the CBD dashboard's pending-fees card). The
    // previous version here summed s_fees_mst joined only by Admission_Id
    // (1800+ fee rows have a null Admission_Id and were silently excluded,
    // wildly overstating "pending"), didn't filter by TypeR (so Debit charges
    // were counted as if paid), never fell back to the batch fee when
    // am.Fees was empty, and ignored the one-time membership fee entirely.
    const [rows] = await getPool().query<any[]>(
      `WITH latest_admission AS (
        SELECT Student_Id, MAX(Admission_Id) AS Admission_Id
        FROM admission_master
        WHERE (IsDelete = 0 OR IsDelete IS NULL)
        GROUP BY Student_Id
      ),
      ledger AS (
        SELECT Student_Id,
          SUM(CASE WHEN TypeR = 'C' THEN COALESCE(Total_Amt, Amount, 0) ELSE 0 END) AS paid,
          SUM(CASE WHEN TypeR = 'D' THEN COALESCE(Total_Amt, Amount, 0) ELSE 0 END) AS posted_debit,
          MAX(CASE WHEN TypeR = 'D' AND LOWER(IFNULL(Notes, '')) LIKE '%one time membership fees%' THEN 1 ELSE 0 END) AS has_membership_debit
        FROM s_fees_mst
        WHERE (IsDelete = 0 OR IsDelete IS NULL)
        GROUP BY Student_Id
      ),
      resolved AS (
        SELECT
          am.Admission_Id AS id,
          sm.Student_Name,
          sm.Batch_Code,
          c.Course_Name,
          COALESCE(
            NULLIF(CAST(REPLACE(IFNULL(am.Fees, ''), ',', '') AS DECIMAL(15,2)), 0),
            NULLIF(CAST(REPLACE(IFNULL(fs.actualfees, ''), ',', '') AS DECIMAL(15,2)), 0),
            NULLIF(CAST(REPLACE(IFNULL(fs.fullfees, ''), ',', '') AS DECIMAL(15,2)), 0),
            NULLIF(CAST(REPLACE(IFNULL(fs.total_inr, ''), ',', '') AS DECIMAL(15,2)), 0),
            NULLIF(CAST(REPLACE(IFNULL(bm.Actual_Fees_Payment, ''), ',', '') AS DECIMAL(15,2)), 0),
            NULLIF(CAST(REPLACE(IFNULL(bm.Fees_Full_Payment, ''), ',', '') AS DECIMAL(15,2)), 0),
            0
          ) AS tuition,
          IFNULL(l.paid, 0) AS paid,
          IFNULL(l.posted_debit, 0) AS posted_debit,
          IFNULL(l.has_membership_debit, 0) AS has_membership_debit
        FROM latest_admission la
        JOIN admission_master am ON am.Admission_Id = la.Admission_Id
        JOIN student_master sm ON sm.Student_Id = la.Student_Id
        LEFT JOIN course_mst c ON c.Course_Id = sm.Course_Id
        LEFT JOIN batch_mst bm ON bm.Batch_code = sm.Batch_Code AND (bm.IsDelete = 0 OR bm.IsDelete IS NULL)
        LEFT JOIN (
          SELECT batch_id, MAX(id) AS id FROM fees_structure
          WHERE deleted = 0 OR deleted IS NULL GROUP BY batch_id
        ) latest_fs ON latest_fs.batch_id = bm.Batch_Id
        LEFT JOIN fees_structure fs ON fs.id = latest_fs.id
        LEFT JOIN ledger l ON l.Student_Id = sm.Student_Id
        WHERE (am.Cancel IS NULL OR LOWER(TRIM(CAST(am.Cancel AS CHAR))) NOT IN ('yes', '1', 'true'))
          ${search ? `AND (sm.Student_Name LIKE ? OR sm.Batch_Code LIKE ? OR c.Course_Name LIKE ?)` : ''}
      )
      SELECT
        id,
        IFNULL(Student_Name, 'Unknown') AS student_name,
        TRIM(CONCAT_WS(' — ',
          NULLIF(TRIM(IFNULL(Batch_Code, '')), ''),
          NULLIF(TRIM(IFNULL(Course_Name,  '')), '')
        )) AS batch,
        (tuition + posted_debit + CASE WHEN tuition > 0 AND NOT has_membership_debit THEN 899 ELSE 0 END) AS total_fees,
        paid,
        GREATEST(tuition + posted_debit + CASE WHEN tuition > 0 AND NOT has_membership_debit THEN 899 ELSE 0 END - paid, 0) AS pending,
        NULL AS due_date
      FROM resolved
      HAVING pending > 0
      ORDER BY pending DESC
      LIMIT 300`,
      search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []
    );

    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}
