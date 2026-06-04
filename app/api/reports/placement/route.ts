/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth, requirePermission } from '@/lib/api-auth';
import { cache, cacheTTL } from '@/lib/cache';
import { logReportCacheTiming } from '@/lib/report-timing';

let educationTableNameCache: string | null | undefined;
let disciplineTableNameCache: string | null | undefined;
let companyInfoTableNameCache: string | null | undefined;

async function resolveOptionalTableName(
  pool: ReturnType<typeof getPool>,
  lowerTableName: string,
  preferredTableName: string
): Promise<string | null> {
  try {
    const [rows] = await pool.query(
      `SELECT TABLE_NAME
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND LOWER(TABLE_NAME) = ?
       ORDER BY CASE WHEN TABLE_NAME = ? THEN 0 ELSE 1 END
       LIMIT 1`,
      [lowerTableName, preferredTableName]
    );
    return String((rows as any[])[0]?.TABLE_NAME || '').trim() || null;
  } catch {
    return null;
  }
}

async function resolveEducationTableName(pool: ReturnType<typeof getPool>): Promise<string | null> {
  if (educationTableNameCache !== undefined) return educationTableNameCache;
  educationTableNameCache = await resolveOptionalTableName(pool, 'mst_education', 'MST_Education');
  return educationTableNameCache;
}

async function resolveDisciplineTableName(pool: ReturnType<typeof getPool>): Promise<string | null> {
  if (disciplineTableNameCache !== undefined) return disciplineTableNameCache;
  disciplineTableNameCache = await resolveOptionalTableName(pool, 'mst_deciplin', 'MST_Deciplin');
  return disciplineTableNameCache;
}

async function resolveCompanyInfoTableName(pool: ReturnType<typeof getPool>): Promise<string | null> {
  if (companyInfoTableNameCache !== undefined) return companyInfoTableNameCache;
  companyInfoTableNameCache = await resolveOptionalTableName(pool, 'company_info', 'Company_info');
  return companyInfoTableNameCache;
}

export async function GET(req: NextRequest) {
  try {
    const startedAt = Date.now();
    const pool = getPool();
    const url = req.nextUrl;
    const options = url.searchParams.get('options');

    /* ── Dropdown endpoints — require only a valid session ─────────── */
    if (options) {
      const auth = await requireAuth(req);
      if (auth instanceof NextResponse) return auth;

    /* ── Dropdown: courses ─────────────────────────────────────────── */
    if (options === 'courses') {
      const cacheKey = 'report:placement:options:courses';
      const cachedData = await cache.get<{ courses: unknown }>(cacheKey);
      if (cachedData) {
        logReportCacheTiming('placement.options.courses', startedAt, 'HIT');
        return NextResponse.json(cachedData, {
          headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300', 'X-Cache': 'HIT' },
        });
      }

      const [rows] = await pool.query(
        `SELECT DISTINCT c.Course_Id AS id, c.Course_Name AS name
         FROM admission_master am
         INNER JOIN student_master s
           ON s.Student_Id = am.Student_Id
          AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
         INNER JOIN course_mst c
           ON c.Course_Id = s.Course_Id
          AND (c.IsDelete = 0 OR c.IsDelete IS NULL)
         WHERE (am.IsDelete = 0 OR am.IsDelete IS NULL)
         ORDER BY c.Course_Name`
      );
      const responseData = { courses: rows };
      await cache.set(cacheKey, responseData, cacheTTL.medium);
      logReportCacheTiming('placement.options.courses', startedAt, 'MISS', { total: (rows as any[]).length });
      return NextResponse.json(responseData, {
        headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300', 'X-Cache': 'MISS' },
      });
    }

    /* ── Dropdown: batches (filtered by course) ────────────────────── */
    if (options === 'batches') {
      const courseId = url.searchParams.get('courseId');
      const normalizedCourseId = (courseId || '').trim().toLowerCase();
      const cacheKey = `report:placement:options:batches:${normalizedCourseId || 'all'}`;
      const cachedData = await cache.get<{ batches: unknown }>(cacheKey);
      if (cachedData) {
        logReportCacheTiming('placement.options.batches', startedAt, 'HIT', { courseId: normalizedCourseId || 'all' });
        return NextResponse.json(cachedData, {
          headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300', 'X-Cache': 'HIT' },
        });
      }

      const [rows] = normalizedCourseId && normalizedCourseId !== 'all'
        ? await pool.query(
            `SELECT DISTINCT b.Batch_Id AS id, b.Batch_code AS name
             FROM admission_master am
             INNER JOIN student_master s
               ON s.Student_Id = am.Student_Id
              AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
             INNER JOIN batch_mst b
               ON b.Batch_Id = am.Batch_Id
              AND (b.IsDelete = 0 OR b.IsDelete IS NULL)
             WHERE (am.IsDelete = 0 OR am.IsDelete IS NULL)
               AND s.Course_Id = ?
             ORDER BY b.Batch_Id DESC`,
            [parseInt(normalizedCourseId, 10)]
          )
        : await pool.query(
            `SELECT DISTINCT b.Batch_Id AS id, b.Batch_code AS name
             FROM admission_master am
             INNER JOIN batch_mst b
               ON b.Batch_Id = am.Batch_Id
              AND (b.IsDelete = 0 OR b.IsDelete IS NULL)
             WHERE (am.IsDelete = 0 OR am.IsDelete IS NULL)
             ORDER BY b.Batch_Id DESC`
          );
      const responseData = { batches: rows };
      await cache.set(cacheKey, responseData, cacheTTL.medium);
      logReportCacheTiming('placement.options.batches', startedAt, 'MISS', { courseId: normalizedCourseId || 'all', total: (rows as any[]).length });
      return NextResponse.json(responseData, {
        headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300', 'X-Cache': 'MISS' },
      });
    }

    /* ── Dropdown: years (distinct start-year from batch_mst) ──────── */
    if (options === 'years') {
      const cacheKey = 'report:placement:options:years';
      const cachedData = await cache.get<{ years: unknown }>(cacheKey);
      if (cachedData) {
        logReportCacheTiming('placement.options.years', startedAt, 'HIT');
        return NextResponse.json(cachedData, {
          headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300', 'X-Cache': 'HIT' },
        });
      }

      const [rows] = await pool.query(
        `SELECT DISTINCT YEAR(SDate) AS yr
         FROM admission_master am
         INNER JOIN batch_mst b
           ON b.Batch_Id = am.Batch_Id
          AND (b.IsDelete = 0 OR b.IsDelete IS NULL)
         WHERE (am.IsDelete = 0 OR am.IsDelete IS NULL)
           AND b.SDate IS NOT NULL
         ORDER BY yr DESC`
      );
      const responseData = { years: (rows as any[]).map((r) => r.yr).filter(Boolean) };
      await cache.set(cacheKey, responseData, cacheTTL.medium);
      logReportCacheTiming('placement.options.years', startedAt, 'MISS', { total: responseData.years.length });
      return NextResponse.json(responseData, {
        headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300', 'X-Cache': 'MISS' },
      });
    }

    /* ── Dropdown: disciplines ─────────────────────────────────────── */
    if (options === 'disciplines') {
      const cacheKey = 'report:placement:options:disciplines';
      const cachedData = await cache.get<{ disciplines: unknown }>(cacheKey);
      if (cachedData) {
        logReportCacheTiming('placement.options.disciplines', startedAt, 'HIT');
        return NextResponse.json(cachedData, {
          headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300', 'X-Cache': 'HIT' },
        });
      }

      const disciplineTableName = await resolveDisciplineTableName(pool);
      if (!disciplineTableName) {
        const responseData = { disciplines: [] };
        await cache.set(cacheKey, responseData, cacheTTL.medium);
        logReportCacheTiming('placement.options.disciplines', startedAt, 'MISS', { total: 0, missingTable: true });
        return NextResponse.json(responseData, {
          headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300', 'X-Cache': 'MISS' },
        });
      }

      const [rows] = await pool.query(
        `SELECT Id AS id, Deciplin AS name
         FROM \`${disciplineTableName}\`
         WHERE IsDelete = 0 OR IsDelete IS NULL
         ORDER BY Deciplin`
      );
      const responseData = { disciplines: rows };
      await cache.set(cacheKey, responseData, cacheTTL.medium);
      logReportCacheTiming('placement.options.disciplines', startedAt, 'MISS', { total: (rows as any[]).length });
      return NextResponse.json(responseData, {
        headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300', 'X-Cache': 'MISS' },
      });
    }

    /* ── Dropdown: qualifications (distinct from student_master) ───── */
    if (options === 'qualifications') {
      const cacheKey = 'report:placement:options:qualifications';
      const cachedData = await cache.get<{ qualifications: unknown }>(cacheKey);
      if (cachedData) {
        logReportCacheTiming('placement.options.qualifications', startedAt, 'HIT');
        return NextResponse.json(cachedData, {
          headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300', 'X-Cache': 'HIT' },
        });
      }

      const [rows] = await pool.query(
        `SELECT DISTINCT TRIM(Qualification) AS q
         FROM student_master
         WHERE Qualification IS NOT NULL AND TRIM(Qualification) != '' AND TRIM(Qualification) != 'NULL'
         ORDER BY q`
      );
      const responseData = { qualifications: (rows as any[]).map((r) => r.q) };
      await cache.set(cacheKey, responseData, cacheTTL.medium);
      logReportCacheTiming('placement.options.qualifications', startedAt, 'MISS', { total: responseData.qualifications.length });
      return NextResponse.json(responseData, {
        headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300', 'X-Cache': 'MISS' },
      });
    }

    // Unknown options value
    return NextResponse.json({ error: 'Unknown options parameter' }, { status: 400 });
    } // end if (options)

    /* ── Report data — require report_placement.view ───────────────── */
    const reportAuth = await requirePermission(req, 'report_placement.view');
    if (reportAuth instanceof NextResponse) return reportAuth;

    const courseId    = url.searchParams.get('courseId');
    const batchId     = url.searchParams.get('batchId');
    const periodMode  = (url.searchParams.get('periodMode') || '').trim();
    const fromDate    = (url.searchParams.get('fromDate') || '').trim();
    const toDate      = (url.searchParams.get('toDate') || '').trim();
    const month       = url.searchParams.get('month');
    const year        = url.searchParams.get('year');
    const qualification = url.searchParams.get('qualification');
    const discipline  = url.searchParams.get('discipline');

    if (periodMode && !['range', 'month', 'year'].includes(periodMode)) {
      return NextResponse.json({ error: 'Invalid period mode.' }, { status: 400 });
    }
    if (periodMode === 'range') {
      if (!fromDate || !toDate) {
        return NextResponse.json({ error: 'From Date and To Date are required for date range filter.' }, { status: 400 });
      }
      if (fromDate > toDate) {
        return NextResponse.json({ error: 'From Date cannot be after To Date.' }, { status: 400 });
      }
    }
    if (periodMode === 'month') {
      const monthNum = Number(month || '0');
      const yearNum = Number(year || '0');
      if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12 || !Number.isInteger(yearNum) || yearNum < 1900) {
        return NextResponse.json({ error: 'Valid month and year are required for monthly filter.' }, { status: 400 });
      }
    }
    if (periodMode === 'year') {
      const yearNum = Number(year || '0');
      if (!Number.isInteger(yearNum) || yearNum < 1900) {
        return NextResponse.json({ error: 'Valid year is required for annual filter.' }, { status: 400 });
      }
    }

    const hasAnyFilter = Boolean(
      (courseId && courseId.trim()) ||
      (batchId && batchId.trim()) ||
      (year && year.trim()) ||
      (qualification && qualification.trim()) ||
      (discipline && discipline.trim()) ||
      (periodMode && periodMode.trim())
    );
    const rowLimit = hasAnyFilter ? 10000 : 2000;

    const conditions: string[] = ['(s.IsDelete = 0 OR s.IsDelete IS NULL)', '(am.IsDelete = 0 OR am.IsDelete IS NULL)'];
    const params: any[] = [];

    if (courseId) {
      conditions.push('s.Course_Id = ?');
      params.push(parseInt(courseId));
    }
    if (batchId) {
      conditions.push('am.Batch_Id = ?');
      params.push(parseInt(batchId));
    }
    if (year) {
      conditions.push('YEAR(b.SDate) = ?');
      params.push(parseInt(year));
    }
    if (qualification) {
      conditions.push('TRIM(s.Qualification) = ?');
      params.push(qualification);
    }
    if (discipline) {
      conditions.push('s.Discipline = ?');
      params.push(parseInt(discipline));
    }

    if (periodMode === 'range') {
      conditions.push('DATE(b.SDate) >= ?');
      conditions.push('DATE(b.SDate) <= ?');
      params.push(fromDate, toDate);
    }
    if (periodMode === 'month') {
      conditions.push('MONTH(b.SDate) = ?');
      conditions.push('YEAR(b.SDate) = ?');
      params.push(parseInt(String(month), 10), parseInt(String(year), 10));
    }
    if (periodMode === 'year') {
      conditions.push('YEAR(b.SDate) = ?');
      params.push(parseInt(String(year), 10));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const cacheKey = `report:placement:data:${courseId || ''}:${batchId || ''}:${year || ''}:${qualification || ''}:${discipline || ''}:${periodMode || ''}:${fromDate || ''}:${toDate || ''}:${month || ''}:limit:${rowLimit}`;
    const cachedData = await cache.get<{ rows: unknown; truncated?: boolean; limit?: number; message?: string }>(cacheKey);
    if (cachedData) {
      logReportCacheTiming('placement.report', startedAt, 'HIT', { courseId, batchId, year, qualification, discipline, periodMode, fromDate, toDate, month });
      return NextResponse.json(cachedData, {
        headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300', 'X-Cache': 'HIT' },
      });
    }

    const [educationTableName, disciplineTableName, companyInfoTableName] = await Promise.all([
      resolveEducationTableName(pool),
      resolveDisciplineTableName(pool),
      resolveCompanyInfoTableName(pool),
    ]);
    const qualificationExpr = educationTableName
      ? 'COALESCE(me.Education, fs.Qualification)'
      : 'fs.Qualification';
    const disciplineExpr = disciplineTableName
      ? 'COALESCE(md.Deciplin, fs.Discipline)'
      : 'fs.Discipline';
    const educationJoin = educationTableName
      ? `LEFT JOIN \`${educationTableName}\` me ON me.Id = aq.Qualification`
      : '';
    const disciplineJoin = disciplineTableName
      ? `LEFT JOIN \`${disciplineTableName}\` md ON md.Id = COALESCE(
                                            aq.Discipline,
                                            CAST(NULLIF(TRIM(fs.Discipline), '') AS UNSIGNED)
                                          )`
      : '';
    const companyInfoJoin = companyInfoTableName
      ? `LEFT JOIN  (
         SELECT ci2.student_id, ci2.Company, ci2.Designation, ci2.BussinessNature, ci2.Duration
         FROM \`${companyInfoTableName}\` ci2
         INNER JOIN (
           SELECT ci3.student_id, MAX(ci3.id) AS id
           FROM \`${companyInfoTableName}\` ci3
           INNER JOIN filtered_students fs2 ON fs2.Student_Id = ci3.student_id
           GROUP BY ci3.student_id
         ) latest ON latest.id = ci2.id
       ) ci ON ci.student_id = fs.Student_Id`
      : `LEFT JOIN (
         SELECT NULL AS student_id, NULL AS Company, NULL AS Designation, NULL AS BussinessNature, NULL AS Duration
       ) ci ON 1 = 0`;

    const [rows] = await pool.query(
      `WITH filtered_students AS (
         SELECT
           s.Student_Id,
           am.Student_Code,
           s.Student_Name,
           s.Present_Mobile,
           s.Email,
           s.Course_Id,
           am.Batch_Id,
           s.Qualification,
           s.Discipline,
           s.SitPerformance,
           s.PlacementRemark
         FROM student_master s
         INNER JOIN admission_master am ON am.Student_Id = s.Student_Id
         LEFT JOIN batch_mst b ON b.Batch_Id = am.Batch_Id
         ${where}
         ORDER BY am.Batch_Id DESC, s.Student_Id DESC
         LIMIT ?
       )
       SELECT
         fs.Student_Id,
         fs.Student_Code,
         fs.Student_Name,
         fs.Present_Mobile,
         fs.Email,
         ${qualificationExpr}                      AS Qualification,
         ${disciplineExpr}                         AS Discipline_Name,
         c.Course_Name,
         b.Batch_code,
         b.SDate                                   AS Batch_Start,
         b.EDate                                   AS Batch_End,
         NULLIF(NULLIF(TRIM(CAST(fs.SitPerformance AS CHAR)), ''), 'NULL') AS SIT_Performance,
         fs.PlacementRemark                        AS Placement_Remark,
         ci.Company,
         ci.Designation,
         ci.BussinessNature,
         ci.Duration
       FROM filtered_students fs
       LEFT JOIN  batch_mst b           ON b.Batch_Id = fs.Batch_Id
       LEFT JOIN  course_mst c          ON c.Course_Id = fs.Course_Id
       LEFT JOIN  (
         SELECT aq2.Student_id, aq2.Qualification, aq2.Discipline
         FROM awt_academicqualification aq2
         INNER JOIN (
           SELECT aq3.Student_id, MAX(aq3.id) AS id
           FROM awt_academicqualification aq3
           INNER JOIN filtered_students fs3 ON fs3.Student_Id = aq3.Student_id
           GROUP BY aq3.Student_id
         ) aqlatest ON aqlatest.id = aq2.id
       ) aq ON aq.Student_id = fs.Student_Id
       ${educationJoin}
       ${disciplineJoin}
       ${companyInfoJoin}
       WHERE TRIM(COALESCE(ci.Company, '')) != ''
       ORDER BY b.Batch_code, fs.Student_Name`,
      [...params, rowLimit]
    );

    const normalizedRows = rows as any[];
    const isTruncated = normalizedRows.length >= rowLimit;
    const responseData = {
      rows: normalizedRows,
      truncated: isTruncated,
      limit: rowLimit,
      message: isTruncated
        ? `Showing first ${rowLimit} rows for faster loading. Apply filters to narrow results.`
        : '',
    };
    await cache.set(cacheKey, responseData, cacheTTL.medium);
    logReportCacheTiming('placement.report', startedAt, 'MISS', { courseId, batchId, year, qualification, discipline, periodMode, fromDate, toDate, month, total: normalizedRows.length, rowLimit, truncated: isTruncated });
    return NextResponse.json(responseData, {
      headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300', 'X-Cache': 'MISS' },
    });
  } catch (err: unknown) {
    console.error('[Placement Report] GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
