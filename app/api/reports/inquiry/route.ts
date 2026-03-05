/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

/**
 * GET /api/reports/inquiry
 *
 * Fetches inquiry report data based on filters:
 *   - dateFrom, dateTo  (required)
 *   - courseId, batchType, batchId, inquiryType, inquiryFrom
 *
 * Returns all matching rows (no pagination – report export).
 */
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
      return NextResponse.json(
        { error: 'From Date and To Date are required' },
        { status: 400 }
      );
    }

    // Build WHERE
    const conditions: string[] = [
      '(sm.IsDelete = 0 OR sm.IsDelete IS NULL)',
      "sm.Inquiry = 'Inquiry'",
      'sm.Inquiry_Dt >= ?',
      'sm.Inquiry_Dt <= ?',
    ];
    const params: any[] = [dateFrom, dateTo];

    if (courseId) {
      conditions.push('sm.Course_Id = ?');
      params.push(parseInt(courseId));
    }

    if (batchType) {
      conditions.push('sm.Batch_Category_id = ?');
      params.push(batchType);
    }

    if (batchId) {
      conditions.push('sm.Batch_Code = ?');
      params.push(parseInt(batchId));
    }

    if (inquiryType) {
      conditions.push('sm.Inquiry_Type = ?');
      params.push(inquiryType);
    }

    if (inquiryFrom) {
      conditions.push('sm.Inquiry_From = ?');
      params.push(inquiryFrom);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // ── Step 1: Get matching Student_Ids fast (no subqueries) ──
    const countSql = `
      SELECT COUNT(*) as total
      FROM student_master sm
      LEFT JOIN course_mst c ON sm.Course_Id = c.Course_Id
      ${whereClause}
    `;
    const [countResult] = await pool.query(countSql, params);
    const totalCount = (countResult as any[])[0]?.total || 0;

    if (totalCount === 0) {
      return NextResponse.json({
        rows: [],
        total: 0,
        statusSummary: {},
        filters: { dateFrom, dateTo, courseId, batchType, batchId, inquiryType, inquiryFrom },
      });
    }

    // ── Step 2: Fetch main data WITHOUT the slow correlated subquery ──
    const sql = `
      SELECT
        sm.Student_Id,
        sm.Student_Name,
        sm.Sex,
        sm.Present_Mobile,
        sm.Present_Mobile2,
        sm.Email,
        sm.Inquiry_Dt,
        sm.Inquiry_Type,
        sm.Inquiry_From,
        sm.Status_id,
        sm.Qualification,
        sm.Discipline,
        sm.Percentage,
        sm.Discussion,
        c.Course_Name,
        b.Batch_code,
        b.Category as Batch_Category
      FROM student_master sm
      LEFT JOIN course_mst c ON sm.Course_Id = c.Course_Id
      LEFT JOIN batch_mst b ON sm.Batch_Code = b.Batch_Id
      ${whereClause}
      ORDER BY sm.Inquiry_Dt DESC, sm.Student_Id DESC
      LIMIT 5000
    `;
    const [mainRows] = await pool.query(sql, params);
    const dataRows = mainRows as any[];

    // ── Step 3: Batch-fetch latest discussions for these IDs (single query) ──
    const studentIds = dataRows.map((r: any) => r.Student_Id);
    const discussionMap: Map<number, string> = new Map();

    if (studentIds.length > 0) {
      const placeholders = studentIds.map(() => '?').join(',');
      const [discRows] = await pool.query(
        `SELECT d1.Inquiry_id, d1.discussion
         FROM awt_inquirydiscussion d1
         INNER JOIN (
           SELECT Inquiry_id, MAX(id) as max_id
           FROM awt_inquirydiscussion
           WHERE deleted = 0 AND Inquiry_id IN (${placeholders})
           GROUP BY Inquiry_id
         ) d2 ON d1.id = d2.max_id`,
        studentIds
      );
      for (const d of discRows as any[]) {
        discussionMap.set(Number(d.Inquiry_id), d.discussion);
      }
    }

    const [rows] = [dataRows];

    // Status mapping
    const statusMap: Record<number, string> = {
      1: 'New', 2: 'Contacted', 3: 'Inquiry', 4: 'Follow Up',
      5: 'Interested', 6: 'Not Interested', 7: 'Admitted', 8: 'Closed',
      9: 'DNC', 10: 'Converted', 12: 'Pending', 15: 'Callback',
      16: 'Visited', 18: 'On Hold', 19: 'Lost', 24: 'Hot Lead',
      25: 'Warm Lead', 26: 'Cold Lead', 27: 'Enrolled', 29: 'Dropped',
      33: 'Archived',
    };

    const enriched = (rows as any[]).map((r: any, idx: number) => ({
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
      Status: statusMap[r.Status_id] || `Status ${r.Status_id}`,
      Status_id: r.Status_id,
      Qualification: r.Qualification || '',
      Discipline: r.Discipline || '',
      Percentage: r.Percentage || '',
      Course_Name: r.Course_Name || '',
      Batch_code: r.Batch_code || '',
      Batch_Category: r.Batch_Category || '',
      Discussion: discussionMap.get(r.Student_Id) || r.Discussion || '',
    }));

    // Summary counts by status
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
