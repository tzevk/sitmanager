/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

/* hardcoded status map (same as inquiry) */
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

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'online_admission.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;

    const search = searchParams.get('search')?.trim() || '';
    const statusFilter = searchParams.get('status') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    /* ---- Build WHERE ---- */
    const conditions: string[] = ['a.IsDelete = 0'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(
        `(s.Student_Name LIKE ? OR s.Email LIKE ? OR s.Present_Mobile LIKE ? OR b.Batch_code LIKE ?)`
      );
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    if (statusFilter !== '') {
      conditions.push('s.Status_id = ?');
      params.push(Number(statusFilter));
    }

    if (dateFrom) {
      conditions.push('a.Admission_Date >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('a.Admission_Date <= ?');
      params.push(dateTo);
    }

    const where = conditions.join(' AND ');

    /* ---- Count ---- */
    const countSql = `
      SELECT COUNT(*) AS total
      FROM admission_master a
      LEFT JOIN student_master s ON a.Student_Id = s.Student_Id
      LEFT JOIN batch_mst b ON a.Batch_Id = b.Batch_Id
      WHERE ${where}
    `;
    const [countRows] = await pool.query<any[]>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    /* ---- Data ---- */
    const dataSql = `
      SELECT
        a.Admission_Id,
        a.Student_Id,
        s.Student_Name,
        s.Email,
        s.Present_Mobile,
        b.Batch_code,
        a.Admission_Date,
        s.Status_id,
        a.Cancel,
        a.IsActive
      FROM admission_master a
      LEFT JOIN student_master s ON a.Student_Id = s.Student_Id
      LEFT JOIN batch_mst b ON a.Batch_Id = b.Batch_Id
      WHERE ${where}
      ORDER BY a.Admission_Id DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, limit, offset];
    const [rows] = await pool.query<any[]>(dataSql, dataParams);

    /* map status labels */
    const mapped = rows.map((r: any) => ({
      ...r,
      StatusLabel: statusMap[r.Status_id] ?? `Unknown (${r.Status_id})`,
    }));

    /* status options for filter dropdown */
    const statusOptions = Object.entries(statusMap).map(([id, label]) => ({
      id: Number(id),
      label,
    }));

    return NextResponse.json({
      rows: mapped,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      statusOptions,
    });
  } catch (err: unknown) {
    console.error('Online Admission GET error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
