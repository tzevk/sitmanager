/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getPool, cached } from '@/lib/db';
import { logEndpointTiming } from '@/lib/perf-log';
import { getStatusMasterOptions } from '@/lib/services/inquiry.service';

const MAIN_INQUIRY_STATUS_LABELS = [
  'New',
  'Contacted (interested)',
  'Contacted (not recieved call)',
  'Contacted (next batch)',
  'Follow up pending',
  'Admission confirmed',
  'Corporate Reference',
  'Alumni Reference',
  'Lost lead',
  'Irrelevant',
];

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

    const options = await cached('inquiry-form-options-v3', 300, async () => {
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
          "SELECT BatchCategory AS Category FROM mst_batchcategory WHERE IsActive = 1 AND (IsDelete = 0 OR IsDelete IS NULL) AND BatchCategory IS NOT NULL AND BatchCategory != '' ORDER BY BatchCategory"
        ),
        runGuardedQuery(pool,
          "SELECT Education AS Qualification FROM mst_education WHERE Education IS NOT NULL AND Education != '' AND (IsActive = 1 OR IsActive IS NULL) AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Id, Education"
        ),
        runGuardedQuery(pool,
          "SELECT Deciplin AS Discipline FROM mst_deciplin WHERE Deciplin IS NOT NULL AND Deciplin != '' AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Id, Deciplin"
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

      const statusMaster = await getStatusMasterOptions();
      const statuses = MAIN_INQUIRY_STATUS_LABELS
        .map((label) => statusMaster.find((status) => status.label === label))
        .filter((status): status is NonNullable<typeof status> => Boolean(status));

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
