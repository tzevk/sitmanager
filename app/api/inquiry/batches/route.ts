import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

// GET batches filtered by course and/or category.
// ?upcoming=N     → all non-cancelled batches starting within the next N months (skips IsActive filter)
// ?from_plan=true → only batches for courses listed in annual_batch_plan for the current year,
//                   ordered by Training_Program_Name then start date
export async function GET(req: NextRequest) {
  try {
    const pool = getPool();
    const url  = req.nextUrl;

    const courseId       = url.searchParams.get('courseId')   || '';
    const category       = url.searchParams.get('category')   || '';
    const upcomingMonths = parseInt(url.searchParams.get('upcoming')  || '0', 10);
    const planYear       = parseInt(url.searchParams.get('plan_year') || '0', 10);
    const fromPlan       = url.searchParams.get('from_plan') === 'true' || url.searchParams.get('from_plan') === '1';

    // ── Plan-based mode ────────────────────────────────────────────────────────
    // Uses annual_batch_plan as the source of truth for which training programs
    // to track. Handles both direct Course_Id links and name-based fallback.
    if (fromPlan) {
      const months = upcomingMonths > 0 ? upcomingMonths : 6;
      const sql = `
        SELECT DISTINCT
          b.Batch_Id, b.Batch_code, b.Course_Id, b.Category,
          DATE_FORMAT(b.SDate, '%Y-%m-%d') AS SDate,
          COALESCE(abp.Training_Program_Name, c.Course_Name) AS Course_Name
        FROM annual_batch_plan abp
        /* Name-based fallback: when plan entry has no Course_Id, resolve via course name */
        LEFT JOIN course_mst c2
          ON abp.Course_Id IS NULL
         AND LOWER(TRIM(c2.Course_Name)) = LOWER(TRIM(abp.Training_Program_Name))
         AND (c2.IsDelete IS NULL OR c2.IsDelete = 0)
        /* Join actual batches for the resolved course */
        JOIN batch_mst b
          ON b.Course_Id = COALESCE(abp.Course_Id, c2.Course_Id)
        LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
        WHERE abp.Plan_Year = YEAR(CURDATE())
          AND (abp.IsDelete = 0 OR abp.IsDelete IS NULL)
          AND (b.IsDelete = 0 OR b.IsDelete IS NULL)
          AND (b.Cancel IS NULL OR b.Cancel = 0)
          AND b.SDate >= CURDATE()
          AND b.SDate <= DATE_ADD(CURDATE(), INTERVAL ? MONTH)
        ORDER BY abp.Training_Program_Name ASC, b.SDate ASC
        LIMIT 200
      `;
      const [rows] = await pool.query(sql, [months]);
      return NextResponse.json({ batches: rows });
    }

    // ── Standard mode ──────────────────────────────────────────────────────────
    const conditions: string[] = [
      '(b.IsDelete = 0 OR b.IsDelete IS NULL)',
      '(b.Cancel IS NULL OR b.Cancel = 0)',
    ];
    const params: (string | number)[] = [];

    if (upcomingMonths > 0) {
      conditions.push('b.SDate >= CURDATE()');
      conditions.push('b.SDate <= DATE_ADD(CURDATE(), INTERVAL ? MONTH)');
      params.push(upcomingMonths);
    } else {
      conditions.push('b.IsActive = 1');
    }

    if (courseId) {
      conditions.push('b.Course_Id = ?');
      params.push(parseInt(courseId));
    }
    if (category) {
      conditions.push('b.Category = ?');
      params.push(category);
    }

    const planJoin = planYear > 0
      ? `INNER JOIN annual_batch_plan abp
           ON abp.Course_Id = b.Course_Id
          AND abp.Plan_Year = ${planYear}
          AND (abp.IsDelete = 0 OR abp.IsDelete IS NULL)`
      : '';

    const orderDir = upcomingMonths > 0 ? 'ASC' : 'DESC';
    const sql = `
      SELECT DISTINCT b.Batch_Id, b.Batch_code, b.Course_Id, b.Category,
             DATE_FORMAT(b.SDate, '%Y-%m-%d') AS SDate,
             c.Course_Name
      FROM batch_mst b
      LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
      ${planJoin}
      WHERE ${conditions.join(' AND ')}
      ORDER BY b.SDate ${orderDir}
      LIMIT 200
    `;

    const [rows] = await pool.query(sql, params);
    return NextResponse.json({ batches: rows });
  } catch (error: any) {
    console.error('Batches API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batches', details: error.message },
      { status: 500 }
    );
  }
}
