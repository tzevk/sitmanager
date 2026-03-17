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

export async function POST(req: NextRequest) {
  try {
    const pool = getPool();
    const body = await req.json();

    // Basic validation
    if (!body.inquiryId) {
      return NextResponse.json({ error: 'Inquiry ID is required' }, { status: 400 });
    }
    if (!body.firstName || !body.lastName) {
      return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 });
    }
    if (!body.email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!body.mobile) {
      return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
    }
    if (!body.ssc_board || !body.ssc_schoolName || !body.ssc_yearOfPassing || !body.ssc_percentage) {
      return NextResponse.json({ error: 'SSC education details are required' }, { status: 400 });
    }

    // Construct full name
    const fullName = [body.firstName, body.middleName, body.lastName].filter(Boolean).join(' ');

    // Get the student_id from inquiry
    const [inquiryRows] = await pool.query<any[]>(
      'SELECT Student_Id, Batch_Id, Course_Id FROM student_master WHERE Student_Id = ?',
      [body.inquiryId]
    );

    if (!inquiryRows || inquiryRows.length === 0) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    const studentId = inquiryRows[0].Student_Id;
    const batchId = inquiryRows[0].Batch_Id;
    const courseId = inquiryRows[0].Course_Id;

    // Update student_master with form data
    await pool.query(
      `UPDATE student_master SET
        Student_Name = ?,
        Email = ?,
        Present_Mobile = ?,
        Present_Mobile2 = ?,
        Present_Address = ?,
        Present_City = ?,
        Present_PIN = ?,
        Nationality = ?,
        DOB = ?,
        Sex = ?,
        Status_id = 8
      WHERE Student_Id = ?`,
      [
        fullName,
        body.email,
        body.mobile,
        body.telephone || null,
        body.presentAddress || null,
        body.presentCity || null,
        body.presentPin || null,
        body.nationality || 'Indian',
        body.dob || null,
        body.gender || null,
        studentId,
      ]
    );

    // Insert into admission_master
    const [admissionResult] = await pool.query<any>(
      `INSERT INTO admission_master (
        Student_Id,
        Batch_Id,
        Course_Id,
        Admission_Date,
        IsActive,
        Cancel,
        IsDelete
      ) VALUES (?, ?, ?, NOW(), 1, 0, 0)`,
      [studentId, batchId || null, courseId || null]
    );

    const admissionId = admissionResult.insertId;

    // Store form submission timestamp
    await pool.query(
      `UPDATE student_master SET Modified_Date = NOW() WHERE Student_Id = ?`,
      [studentId]
    );

    return NextResponse.json({
      success: true,
      admissionId,
      message: 'Application submitted successfully',
    });
  } catch (err: unknown) {
    console.error('Online Admission POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
