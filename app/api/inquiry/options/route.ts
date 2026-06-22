/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getPool, cached } from '@/lib/db';
import { logEndpointTiming } from '@/lib/perf-log';
import { ALLOWED_INQUIRY_STATUSES, getStatusMasterOptions } from '@/lib/services/inquiry.service';

let supportsStatementTimeout: boolean | null = null;

function withStatementTimeout(sql: string, seconds: number): string {
  const safeSeconds = Math.max(1, Math.min(30, Math.trunc(seconds)));
  return `SET STATEMENT max_statement_time=${safeSeconds} FOR ${sql}`;
}

async function runGuardedQuery(
  pool: ReturnType<typeof getPool>,
  sql: string,
  statementTimeoutSeconds = 5,
): Promise<any[]> {
  const timeoutSql = supportsStatementTimeout !== false
    ? withStatementTimeout(sql, statementTimeoutSeconds)
    : sql;

  try {
    const [rows] = await pool.query(timeoutSql);
    if (timeoutSql !== sql) supportsStatementTimeout = true;
    return rows as any[];
  } catch (error: any) {
    if (timeoutSql !== sql && supportsStatementTimeout !== false) {
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('max_statement_time') || msg.includes('syntax')) {
        supportsStatementTimeout = false;
        const [rows] = await pool.query(sql);
        return rows as any[];
      }
    }
    throw error;
  }
}

export async function GET() {
  const startedAt = Date.now();
  let perfStatus: 'ok' | 'error' = 'ok';
  let perfCode = 200;
  try {
    const pool = getPool();

    const options = await cached('inquiry-form-options', 300, async () => {
      const [
        coursesRes,
        categoriesRes,
        qualificationsRes,
        disciplinesRes,
        nationalitiesRes,
        countriesRes,
      ] = await Promise.all([
        runGuardedQuery(pool,
          "SELECT Course_Id, Course_Name FROM course_mst WHERE IsActive = 1 AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Course_Name"
        ),
        runGuardedQuery(pool,
          "SELECT DISTINCT Category FROM batch_mst WHERE IsActive = 1 AND (IsDelete = 0 OR IsDelete IS NULL) AND Category IS NOT NULL AND Category != '' ORDER BY Category"
        ),
        runGuardedQuery(pool,
          "SELECT DISTINCT Qualification FROM student_master WHERE Qualification IS NOT NULL AND Qualification != '' AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Qualification"
        ),
        runGuardedQuery(pool,
          "SELECT DISTINCT Discipline FROM student_master WHERE Discipline IS NOT NULL AND Discipline != '' AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Discipline"
        ),
        runGuardedQuery(pool,
          "SELECT DISTINCT Nationality FROM student_master WHERE Nationality IS NOT NULL AND Nationality != '' AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Nationality"
        ),
        runGuardedQuery(pool,
          "SELECT DISTINCT Present_Country FROM student_master WHERE Present_Country IS NOT NULL AND Present_Country != '' AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Present_Country"
        ),
      ]);

      const courses = (coursesRes as any[]).map((r) => ({
        id: r.Course_Id,
        name: r.Course_Name,
      }));
      const categories = (categoriesRes as any[]).map((r) => r.Category);
      const qualifications = (qualificationsRes as any[]).map((r) => r.Qualification);
      const disciplines = (disciplinesRes as any[]).map((r) => r.Discipline);
      const nationalities = (nationalitiesRes as any[]).map((r) => r.Nationality);
      const countries = (countriesRes as any[]).map((r) => r.Present_Country);

      const statuses = ALLOWED_INQUIRY_STATUSES;
      // Full admin-managed status list for the discussion-area dropdown.
      const statusMaster = await getStatusMasterOptions();

      const genders = ['Male', 'Female'];

      const inquiryModes = [
        'Call',
        'WhatsApp',
        'Meta Instant Form',
        'Website Enquiry Form',
        'Walk-In',
        'Social Media DM',
        'Email',
        'Seminar / Event',
        'Portals e.g. IndiaMart',
      ];

      const inquiryTypes = [
        'Reference',
        'Meta Ads',
        'Google Ads',
        'College Seminar',
        'Exhibition',
        'Website / Google Search',
        'Social Media Posts (Not ads)',
        'Newspaper / Poster',
      ];

      return {
        courses,
        categories,
        qualifications,
        disciplines,
        nationalities,
        countries,
        statuses,
        statusMaster,
        genders,
        inquiryModes,
        inquiryTypes,
      };
    });

    return NextResponse.json(options, {
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error: any) {
    perfStatus = 'error';
    perfCode = 500;
    console.error('Inquiry options API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch options', details: error.message },
      { status: 500 }
    );
  } finally {
    logEndpointTiming({
      endpoint: '/api/inquiry/options',
      method: 'GET',
      durationMs: Date.now() - startedAt,
      status: perfStatus,
      code: perfCode,
    });
  }
}
