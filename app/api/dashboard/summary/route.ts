import { NextRequest, NextResponse } from 'next/server';
import { getPool, cached } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function safeQuery<T>(pool: ReturnType<typeof getPool>, sql: string, fallback: T): Promise<T> {
  try {
    const [rows] = await pool.query(sql);
    return rows as T;
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await cached('dashboard:summary', CACHE_TTL, async () => {
      const pool = getPool();

      const [
        enquirySummaryRows,
        corporateTotalRows,
        recentCorporate,
        upcomingBatches,
        notices,
        activeReqRows,
        companyRequirementsList,
      ] = await Promise.all([
        // Enquiry summary
        safeQuery(pool, `
          SELECT COUNT(*) as total_enquiries,
            SUM(CASE WHEN inquiry_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as last_30_days,
            SUM(CASE WHEN inquiry_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as last_7_days
          FROM student_inquiry WHERE (IsDelete = 0 OR IsDelete IS NULL)
        `, [{ total_enquiries: 0, last_30_days: 0, last_7_days: 0 }]),

        // Corporate total
        safeQuery(pool, `
          SELECT COUNT(*) as total FROM corporate_inquiry WHERE (IsDelete = 0 OR IsDelete IS NULL)
        `, [{ total: 0 }]),

        // Recent corporate
        safeQuery(pool, `
          SELECT Id, FullName, CompanyName, Designation, Mobile, Email, Course_Id, Idate
          FROM corporate_inquiry WHERE (IsDelete = 0 OR IsDelete IS NULL)
          ORDER BY Id DESC LIMIT 10
        `, []),

        // Upcoming batches
        safeQuery(pool, `
          SELECT b.Batch_Id, b.Batch_code, b.SDate, b.EDate,
            b.Category, b.Duration, b.Timings,
            b.Training_Coordinator, b.INR_Basic,
            b.Admission_Date, b.Max_Students,
            c.Course_Name AS CourseName
          FROM batch_mst b
          LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
          WHERE b.SDate >= CURDATE()
            AND (b.IsDelete IS NULL OR b.IsDelete = 0)
            AND (b.Cancel IS NULL OR b.Cancel = 0)
          ORDER BY b.SDate ASC LIMIT 10
        `, []),

        // Notices
        safeQuery(pool, `
          SELECT id, startdate, enddate, specification, created_date
          FROM awt_noticeboard
          WHERE (deleted = 0 OR deleted IS NULL) AND specification IS NOT NULL AND specification != ''
          ORDER BY id DESC LIMIT 5
        `, []),

        // Active requirements count
        safeQuery(pool, `
          SELECT COUNT(*) as active_requirements
          FROM company_requirements_apk
          WHERE (IsDelete IS NULL OR IsDelete = 0) AND IsActive = 1
        `, [{ active_requirements: 0 }]),

        // Company requirements list
        safeQuery(pool, `
          SELECT CompReqId, Profile, Location, Eligibility, PostedDate, CompanyName
          FROM company_requirements_apk
          WHERE (IsDelete IS NULL OR IsDelete = 0) AND IsActive = 1
          ORDER BY CompReqId DESC LIMIT 5
        `, []),
      ]);

      const esRow = (enquirySummaryRows as Record<string, number>[])[0] ?? {};

      return {
        upcomingBatches,
        enquiryReport: {
          summary: {
            total_enquiries: esRow.total_enquiries || 0,
            last_30_days: esRow.last_30_days || 0,
            last_7_days: esRow.last_7_days || 0,
          },
          corporateTotal: (corporateTotalRows as Record<string, number>[])[0]?.total || 0,
          recentCorporate,
        },
        notices,
        companyRequirements: {
          activeRequirements: (activeReqRows as Record<string, number>[])[0]?.active_requirements || 0,
          list: companyRequirementsList,
        },
      };
    });

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (error: unknown) {
    console.error('Dashboard summary error:', error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
