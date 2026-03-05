/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

/* Status map (same as online-admission) */
const statusMap: Record<number, string> = {
  0: 'New Inquiry',
  1: 'Follow Up',
  2: 'Interested',
  3: 'Confirmed',
  4: 'Not Interested',
  5: 'Batch Started',
  6: 'Batch Completed',
  7: 'Cancelled',
  8: 'Admitted',
  9: 'Left',
  10: 'On Hold',
  12: 'Prospective',
  13: 'Walk In',
  15: 'Re-inquiry',
  16: 'Demo Attended',
  17: 'Demo Scheduled',
  19: 'Online Inquiry',
  23: 'Document Pending',
  24: 'Fees Pending',
  25: 'Transfer',
  26: 'Need Based Training',
  27: 'Duplicate',
  29: 'Corporate',
  34: 'Assessment Done',
  35: 'Refund',
  40: 'Counselling Done',
};

/**
 * GET /api/reports/online-student
 *
 * Filters:
 *   - courseId       (required)
 *   - statusId       (required) — admission status id
 *   - dateFrom       (required)
 *   - dateTo         (required)
 *
 * Returns all matching rows (no pagination — report export).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'online_admission.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const url = req.nextUrl;

    const courseId = url.searchParams.get('courseId') || '';
    const statusId = url.searchParams.get('statusId') || '';
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';

    if (!courseId || !statusId || !dateFrom || !dateTo) {
      return NextResponse.json(
        { error: 'Course, Admission Status, From Date and To Date are all required' },
        { status: 400 },
      );
    }

    /* ---- Build WHERE ---- */
    const conditions: string[] = [
      'a.IsDelete = 0',
      'a.Admission_Date >= ?',
      'a.Admission_Date <= ?',
      'c.Course_Id = ?',
      's.Status_id = ?',
    ];
    const params: (string | number)[] = [dateFrom, dateTo, parseInt(courseId), parseInt(statusId)];

    const where = conditions.join(' AND ');

    const sql = `
      SELECT
        a.Admission_Id,
        a.Student_Id,
        s.Student_Name,
        s.Sex,
        s.Email,
        s.Present_Mobile,
        s.Present_Mobile2,
        s.Qualification,
        s.Discipline,
        s.Percentage,
        s.Status_id,
        b.Batch_code,
        b.Category AS Batch_Category,
        c.Course_Name,
        a.Admission_Date,
        a.Cancel,
        a.IsActive
      FROM admission_master a
      LEFT JOIN student_master s ON a.Student_Id = s.Student_Id
      LEFT JOIN batch_mst b ON a.Batch_Id = b.Batch_Id
      LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
      WHERE ${where}
      ORDER BY a.Admission_Date DESC, a.Admission_Id DESC
      LIMIT 5000
    `;

    const [rows] = await pool.query<any[]>(sql, params);

    const enriched = rows.map((r: any, idx: number) => ({
      srNo: idx + 1,
      Admission_Id: r.Admission_Id,
      Student_Id: r.Student_Id,
      Student_Name: r.Student_Name || '',
      Sex: r.Sex || '',
      Email: r.Email || '',
      Present_Mobile: r.Present_Mobile || '',
      Present_Mobile2: r.Present_Mobile2 || '',
      Course_Name: r.Course_Name || '',
      Batch_code: r.Batch_code || '',
      Batch_Category: r.Batch_Category || '',
      Admission_Date: r.Admission_Date,
      Status: statusMap[r.Status_id] ?? `Unknown (${r.Status_id})`,
      Status_id: r.Status_id,
      Qualification: r.Qualification || '',
      Discipline: r.Discipline || '',
      Percentage: r.Percentage || '',
      Cancel: r.Cancel || '',
      IsActive: r.IsActive,
    }));

    /* Status summary */
    const statusSummary: Record<string, number> = {};
    for (const row of enriched) {
      statusSummary[row.Status] = (statusSummary[row.Status] || 0) + 1;
    }

    /* Courses list (for page dropdown) */
    const [courseRows] = await pool.query<any[]>(
      'SELECT Course_Id, Course_Name FROM course_mst WHERE IsActive = 1 AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Course_Name',
    );
    const courses = courseRows.map((c: any) => ({ id: c.Course_Id, name: c.Course_Name }));

    /* Status options */
    const statusOptions = Object.entries(statusMap).map(([id, label]) => ({
      id: Number(id),
      label,
    }));

    return NextResponse.json({
      rows: enriched,
      total: enriched.length,
      statusSummary,
      courses,
      statusOptions,
      filters: { courseId, statusId, dateFrom, dateTo },
    });
  } catch (error: any) {
    console.error('Online student report API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate online student report', details: error.message },
      { status: 500 },
    );
  }
}
