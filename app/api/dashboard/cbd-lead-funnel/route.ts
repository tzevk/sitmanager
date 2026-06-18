/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

const INQUIRY_DATE_EXPR =
  `COALESCE(` +
  `STR_TO_DATE(LEFT(NULLIF(TRIM(si.Inquiry_Dt),''),19),'%Y-%m-%d %H:%i:%s'),` +
  `STR_TO_DATE(LEFT(NULLIF(TRIM(si.Inquiry_Dt),''),10),'%Y-%m-%d'),` +
  `STR_TO_DATE(LEFT(NULLIF(TRIM(si.Inquiry_Dt),''),10),'%d-%m-%Y'),` +
  `STR_TO_DATE(LEFT(NULLIF(TRIM(si.Inquiry_Dt),''),10),'%d/%m/%Y'))`;

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
  // Meta leads (meta_ads_lead_sync) keep their own date column, so apply the same
  // FY/month window with a parallel expression + param set.
  const META_DATE_EXPR =
    `COALESCE(` +
    `STR_TO_DATE(LEFT(NULLIF(TRIM(lead_created_time),''),19),'%Y-%m-%d %H:%i:%s'),` +
    `STR_TO_DATE(LEFT(NULLIF(TRIM(lead_created_time),''),10),'%Y-%m-%d'),` +
    `created_at)`;
  const metaParams: (number | string)[] = [];
  let metaDateCondition = '';

  if (month && Number.isFinite(month) && month >= 1 && month <= 12) {
    dateCondition = `AND YEAR(${INQUIRY_DATE_EXPR}) = ? AND MONTH(${INQUIRY_DATE_EXPR}) = ?`;
    params.push(year, month);
    metaDateCondition = `AND YEAR(${META_DATE_EXPR}) = ? AND MONTH(${META_DATE_EXPR}) = ?`;
    metaParams.push(year, month);
  } else {
    // "By Year" means the financial year: 1 Apr of `year` to 31 Mar of `year + 1`.
    // `year` is the financial-year start year (e.g. 2025 -> FY 2025-26).
    dateCondition = `AND ${INQUIRY_DATE_EXPR} >= ? AND ${INQUIRY_DATE_EXPR} < ?`;
    params.push(`${year}-04-01`, `${year + 1}-04-01`);
    metaDateCondition = `AND ${META_DATE_EXPR} >= ? AND ${META_DATE_EXPR} < ?`;
    metaParams.push(`${year}-04-01`, `${year + 1}-04-01`);
  }

  try {
    // The online admission form store may not exist until the first online
    // admission is started; keep the funnel query resilient on fresh databases.
    await pool.query(
      `CREATE TABLE IF NOT EXISTS online_admission_payload (
         Inquiry_Id INT NOT NULL PRIMARY KEY,
         Payload    LONGTEXT NULL,
         Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );

    // Stage signals are joined as pre-grouped derived sets (NOT per-row correlated
    // EXISTS) so this aggregate stays set-based and cheap — correlated subqueries
    // over student_inquiry exhaust the DB connection pool (see memory: student-list-perf).
    // Each join key is unique per inquiry, so COUNT(*) does not fan out.
    //   • contacted  → has a non-deleted discussion (awt_inquirydiscussion), linked by
    //                  the current Inquiry_Id or the legacy Student_Id mapping
    //   • interested → an online admission form exists (online_admission_payload)
    //   • converted  → that form was accepted into a student (Admitted / linked)
    const HAS_DISCUSSION = `(
      disc_inq.k IS NOT NULL
      OR (si.Student_Id IS NOT NULL AND (disc_leg.k IS NOT NULL OR disc_stu.k IS NOT NULL))
    )`;
    const HAS_ADMISSION_FORM = `oap.Inquiry_Id IS NOT NULL`;
    const CONVERTED_TO_STUDENT = `(
      oap.Inquiry_Id IS NOT NULL
      AND (si.OnlineState = 8 OR sm.Student_Id IS NOT NULL)
    )`;

    const [rows] = await pool.query<any[]>(
      // Server-side cap (MariaDB): this funnel aggregate joins three
      // awt_inquirydiscussion derived tables; bound it so it can never become a
      // runaway under repeated CBD dashboard loads and saturate the DB.
      `SET STATEMENT max_statement_time=8 FOR
       SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN ${HAS_DISCUSSION} THEN 1 ELSE 0 END) AS contacted,
         SUM(CASE WHEN ${HAS_ADMISSION_FORM} THEN 1 ELSE 0 END) AS interested,
         SUM(CASE WHEN ${CONVERTED_TO_STUDENT} THEN 1 ELSE 0 END) AS converted
       FROM student_inquiry si
       LEFT JOIN (
         SELECT Inquiry_id AS k FROM awt_inquirydiscussion
         WHERE deleted = 0 AND Inquiry_id IS NOT NULL GROUP BY Inquiry_id
       ) disc_inq ON disc_inq.k = si.Inquiry_Id
       LEFT JOIN (
         SELECT Inquiry_id AS k FROM awt_inquirydiscussion
         WHERE deleted = 0 AND Inquiry_id IS NOT NULL GROUP BY Inquiry_id
       ) disc_leg ON si.Student_Id IS NOT NULL AND disc_leg.k = si.Student_Id
       LEFT JOIN (
         SELECT student_id AS k FROM awt_inquirydiscussion
         WHERE deleted = 0 AND student_id IS NOT NULL GROUP BY student_id
       ) disc_stu ON si.Student_Id IS NOT NULL AND disc_stu.k = si.Student_Id
       LEFT JOIN online_admission_payload oap ON oap.Inquiry_Id = si.Inquiry_Id
       LEFT JOIN student_master sm
         ON sm.Student_Id = si.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
       WHERE (si.IsDelete = 0 OR si.IsDelete IS NULL)
       ${dateCondition}`,
      params
    );

    const row = (rows as any[])[0] ?? {};

    // Meta Ads instant-form leads also feed the top of the funnel. Count only the
    // ones not already represented by a live student_inquiry (same "not already
    // counted" rule as the dashboard route's seed) so converted leads — already in
    // the count above — aren't doubled.
    let metaLeads = 0;
    try {
      const [metaRows] = await pool.query<any[]>(
        `SET STATEMENT max_statement_time=8 FOR
         SELECT COUNT(DISTINCT m.meta_lead_id) AS meta_leads
         FROM meta_ads_lead_sync m
         WHERE NOT EXISTS (
           SELECT 1 FROM student_inquiry si
           WHERE si.Inquiry_Id = m.inquiry_id
             AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
         )
         ${metaDateCondition}`,
        metaParams
      );
      metaLeads = Number((metaRows as any[])[0]?.meta_leads || 0);
    } catch (metaErr: any) {
      // Table may not exist until the first Meta lead syncs; treat as zero.
      console.warn('cbd-lead-funnel meta count skipped:', metaErr?.message || metaErr);
    }

    return NextResponse.json({
      total:     Number(row.total     || 0) + metaLeads,
      contacted: Number(row.contacted || 0),
      interested:Number(row.interested|| 0),
      converted: Number(row.converted || 0),
      metaLeads,
    });
  } catch (err: any) {
    console.error('cbd-lead-funnel error:', err);
    return NextResponse.json({ error: 'Failed to fetch lead funnel data' }, { status: 500 });
  }
}
