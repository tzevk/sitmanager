/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { cache, cacheTTL } from '@/lib/cache';
import { logReportCacheTiming } from '@/lib/report-timing';

async function resolveInquiryTableName(pool: any): Promise<string> {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND LOWER(TABLE_NAME) = 'student_inquiry'
     ORDER BY CASE WHEN TABLE_NAME = 'Student_Inquiry' THEN 0 ELSE 1 END
     LIMIT 1`
  );
  return String((rows as any[])[0]?.TABLE_NAME || '').trim() || 'Student_Inquiry';
}

export async function GET(req: NextRequest) {
  try {
    const startedAt = Date.now();
    const auth = await requirePermission(req, 'inquiry.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
    const url = req.nextUrl;

    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';
    // 'inquiry' (default) filters by Inquiry_Dt — when the inquiry/lead
    // actually came in. 'software' filters by Date_Added — when it was
    // entered into the system, which can lag behind (or predate re-entry of)
    // the real inquiry date.
    const dateFieldParam = url.searchParams.get('dateField') || 'inquiry';
    const dateField: 'inquiry' | 'software' = dateFieldParam === 'software' ? 'software' : 'inquiry';
    const courseId = url.searchParams.get('courseId') || '';
    const batchType = url.searchParams.get('batchType') || '';
    const batchId = url.searchParams.get('batchId') || '';
    const inquiryType = url.searchParams.get('inquiryType') || '';
    const inquiryFrom = url.searchParams.get('inquiryFrom') || '';

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'From Date and To Date are required' }, { status: 400 });
    }

    const cacheKey = `report:inquiry:data:${dateFrom}:${dateTo}:${dateField}:${courseId}:${batchType}:${batchId}:${inquiryType}:${inquiryFrom}`;
    const cachedData = await cache.get<any>(cacheKey);
    if (cachedData) {
      logReportCacheTiming('inquiry.report', startedAt, 'HIT', { dateFrom, dateTo, dateField, courseId, batchType, batchId, inquiryType, inquiryFrom });
      return NextResponse.json(cachedData, {
        headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60', 'X-Cache': 'HIT' },
      });
    }

    // Student_Inquiry.Inquiry_Dt is a VARCHAR stored in mixed formats — parse to DATE.
    const inquiryDtAsDate =
      `DATE(COALESCE(`
      + `STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 19), '%Y-%m-%d %H:%i:%s'),`
      + `STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 10), '%Y-%m-%d'),`
      + `STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 10), '%d-%m-%Y'),`
      + `STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 10), '%d/%m/%Y'),`
      + `STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 10), '%d.%m.%Y'),`
      + `STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 10), '%Y/%m/%d'),`
      + `DATE('1970-01-01')`
      + `))`;

    // Date_Added ("software date" — when the record was actually entered into
    // the system) is sparsely populated and has some corrupted/truncated
    // values (e.g. time-only fragments) — those simply fail every format
    // below and fall back to 1970-01-01, which naturally excludes them from
    // any real date-range filter rather than crashing the query.
    const dateAddedAsDate =
      `DATE(COALESCE(`
      + `STR_TO_DATE(SUBSTRING(si.Date_Added, 1, 19), '%Y-%m-%d %H:%i:%s'),`
      + `STR_TO_DATE(SUBSTRING(si.Date_Added, 1, 10), '%Y-%m-%d'),`
      + `STR_TO_DATE(SUBSTRING(si.Date_Added, 1, 10), '%d-%m-%Y'),`
      + `STR_TO_DATE(SUBSTRING(si.Date_Added, 1, 10), '%d/%m/%Y'),`
      + `STR_TO_DATE(SUBSTRING(si.Date_Added, 1, 10), '%d.%m.%Y'),`
      + `STR_TO_DATE(SUBSTRING(si.Date_Added, 1, 10), '%Y/%m/%d'),`
      + `DATE('1970-01-01')`
      + `))`;

    const filterDateAsDate = dateField === 'software' ? dateAddedAsDate : inquiryDtAsDate;

    const conditions: string[] = [
      '(si.IsDelete = 0 OR si.IsDelete IS NULL)',
      `${filterDateAsDate} >= ?`,
      `${filterDateAsDate} <= ?`,
    ];
    const params: any[] = [dateFrom, dateTo];

    if (courseId) {
      conditions.push('si.Course_Id = ?');
      params.push(parseInt(courseId));
    }

    if (batchType) {
      // batchType is a Category name string from batch_mst
      conditions.push('b.Category = ?');
      params.push(batchType);
    }

    if (batchId) {
      conditions.push('si.Batch_Code = ?');
      params.push(parseInt(batchId));
    }

    if (inquiryType) {
      conditions.push('si.Inquiry_Type = ?');
      params.push(inquiryType);
    }

    if (inquiryFrom) {
      conditions.push('si.Inquiry_From = ?');
      params.push(inquiryFrom);
    }

    const whereClause = `WHERE (${conditions.join(') AND (')})`;

    const baseSql = `
      FROM ${inquiryTable} si
      LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id
      LEFT JOIN batch_mst b ON si.Batch_Code = b.Batch_Id
      ${whereClause}
    `;

    // Step 1: Count
    const [[{ total: totalCount }]] = await pool.query(
      `SELECT COUNT(*) as total ${baseSql}`,
      params
    ) as any;

    if (totalCount === 0) {
      const responseData = {
        rows: [], total: 0, statusSummary: {},
        filters: { dateFrom, dateTo, dateField, courseId, batchType, batchId, inquiryType, inquiryFrom },
      };
      await cache.set(cacheKey, responseData, cacheTTL.short);
      logReportCacheTiming('inquiry.report', startedAt, 'MISS', { dateFrom, dateTo, courseId, batchType, batchId, inquiryType, inquiryFrom, total: 0 });
      return NextResponse.json(responseData, {
        headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60', 'X-Cache': 'MISS' },
      });
    }

    // Step 2: Main data
    const [mainRows] = await pool.query(
      `SELECT
         si.Inquiry_Id   AS Student_Id,
         si.Student_Name,
         si.Sex,
         si.Present_Mobile,
         si.Present_Mobile2,
         si.Email,
         si.Inquiry_Dt,
         si.Inquiry_Type,
         si.Inquiry_From,
         CAST(NULLIF(TRIM(si.OnlineState), '') AS UNSIGNED) AS Status_id,
         si.Qualification,
         si.Discipline,
         si.Percentage,
         si.Discussion,
         c.Course_Name,
         b.Batch_code,
         b.Category AS Batch_Category
       ${baseSql}
       ORDER BY ${filterDateAsDate} DESC, si.Inquiry_Id DESC
       LIMIT 5000`,
      params
    ) as any;

    const dataRows = mainRows as any[];

    // Step 3: All follow-ups per inquiry (chronological order)
    const inquiryIds = dataRows.map((r: any) => r.Student_Id);
    const followUpMap = new Map<number, { date: string; discussion: string }[]>();

    if (inquiryIds.length > 0) {
      const ph = inquiryIds.map(() => '?').join(',');
      const [discRows] = await pool.query(
        `SELECT Inquiry_id, date, discussion
         FROM awt_inquirydiscussion
         WHERE (deleted = 0 OR deleted IS NULL) AND Inquiry_id IN (${ph})
         ORDER BY id ASC`,
        inquiryIds
      ) as any;
      for (const d of discRows as any[]) {
        const id = Number(d.Inquiry_id);
        const entry = {
          date: d.date ? String(d.date).slice(0, 10) : '',
          discussion: String(d.discussion || '').trim(),
        };
        if (!followUpMap.has(id)) followUpMap.set(id, []);
        followUpMap.get(id)!.push(entry);
      }
    }

    // Step 4: Status labels from status_master, with inquiry-specific overrides.
    // status_master id=1 is 'Conducted' (student lifecycle) but for inquiries it means 'New'.
    const inquiryStatusOverrides: Record<number, string> = { 1: 'New' };
    const fallbackStatusMap: Record<number, string> = {
      1: 'New', 2: 'Contacted', 3: 'Inquiry', 4: 'Follow Up',
      5: 'Interested', 6: 'Not Interested', 7: 'Admitted', 8: 'Closed',
      9: 'DNC', 10: 'Converted', 12: 'Pending', 15: 'Callback',
      16: 'Visited', 18: 'On Hold', 19: 'Lost', 24: 'Hot Lead',
      25: 'Warm Lead', 26: 'Cold Lead', 27: 'Enrolled', 29: 'Dropped',
      33: 'Archived',
    };
    let statusMap: Record<number, string> = { ...fallbackStatusMap };
    try {
      const [statusRows] = await pool.query(
        `SELECT Id AS id, Status AS label FROM status_master WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Id`
      ) as any;
      const dbMap: Record<number, string> = {};
      for (const s of statusRows as any[]) {
        if (s.id != null && s.label) dbMap[Number(s.id)] = String(s.label).trim();
      }
      if (Object.keys(dbMap).length > 0) statusMap = { ...dbMap, ...inquiryStatusOverrides };
    } catch { /* use fallback */ }

    const enriched = dataRows.map((r: any, idx: number) => ({
      srNo: idx + 1,
      Student_Id: r.Student_Id,
      Student_Name: r.Student_Name || '',
      Sex: r.Sex || '',
      Present_Mobile: r.Present_Mobile || '',
      Present_Mobile2: r.Present_Mobile2 || '',
      Email: r.Email || '',
      Inquiry_Dt: r.Inquiry_Dt,
      Inquiry_Type: r.Inquiry_Type || '',
      Inquiry_From: r.Inquiry_From || '',
      Status: statusMap[r.Status_id] || (r.Status_id != null ? `Status ${r.Status_id}` : 'Open'),
      Status_id: r.Status_id,
      Qualification: r.Qualification || '',
      Discipline: r.Discipline || '',
      Percentage: r.Percentage || '',
      Course_Name: r.Course_Name || '',
      Batch_code: r.Batch_code || '',
      Batch_Category: r.Batch_Category || '',
      followUps: followUpMap.get(r.Student_Id) || [],
    }));

    const statusSummary: Record<string, number> = {};
    for (const row of enriched) {
      statusSummary[row.Status] = (statusSummary[row.Status] || 0) + 1;
    }

    const responseData = {
      rows: enriched,
      total: enriched.length,
      statusSummary,
      filters: { dateFrom, dateTo, dateField, courseId, batchType, batchId, inquiryType, inquiryFrom },
    };
    await cache.set(cacheKey, responseData, cacheTTL.short);
    logReportCacheTiming('inquiry.report', startedAt, 'MISS', { dateFrom, dateTo, courseId, batchType, batchId, inquiryType, inquiryFrom, total: enriched.length });
    return NextResponse.json(responseData, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60', 'X-Cache': 'MISS' },
    });
  } catch (error: any) {
    console.error('Inquiry report API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate inquiry report', details: error.message },
      { status: 500 }
    );
  }
}
