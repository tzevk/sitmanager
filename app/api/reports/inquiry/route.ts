/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'inquiry.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const url = req.nextUrl;

    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';
    const courseId = url.searchParams.get('courseId') || '';
    const batchType = url.searchParams.get('batchType') || '';
    const batchId = url.searchParams.get('batchId') || '';
    const inquiryType = url.searchParams.get('inquiryType') || '';
    const inquiryFrom = url.searchParams.get('inquiryFrom') || '';

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'From Date and To Date are required' }, { status: 400 });
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

    const conditions: string[] = [
      '(si.IsDelete = 0 OR si.IsDelete IS NULL)',
      `${inquiryDtAsDate} >= ?`,
      `${inquiryDtAsDate} <= ?`,
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
      FROM Student_Inquiry si
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
      return NextResponse.json({
        rows: [], total: 0, statusSummary: {},
        filters: { dateFrom, dateTo, courseId, batchType, batchId, inquiryType, inquiryFrom },
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
       ORDER BY ${inquiryDtAsDate} DESC, si.Inquiry_Id DESC
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

    // Step 4: Status labels — prefer DB table, fall back to hardcoded map
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
        `SELECT Status_id AS id, Status AS label FROM awt_status WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Status_id`
      ) as any;
      const dbMap: Record<number, string> = {};
      for (const s of statusRows as any[]) {
        if (s.id && s.label) dbMap[Number(s.id)] = String(s.label).trim();
      }
      if (Object.keys(dbMap).length > 0) statusMap = dbMap;
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

    return NextResponse.json({
      rows: enriched,
      total: enriched.length,
      statusSummary,
      filters: { dateFrom, dateTo, courseId, batchType, batchId, inquiryType, inquiryFrom },
    });
  } catch (error: any) {
    console.error('Inquiry report API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate inquiry report', details: error.message },
      { status: 500 }
    );
  }
}
