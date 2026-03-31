/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

/* fallback labels for older DBs */
const fallbackStatusMap: Record<number, string> = {
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
    const statusCategory = (searchParams.get('statusCategory') || '').trim().toLowerCase();
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    const statusIdExpr = `CAST(NULLIF(TRIM(CAST(s.Status_id AS CHAR)), '') AS UNSIGNED)`;
    const statusTextExpr = `LOWER(TRIM(COALESCE(stm.Status, '')))`;
    const closedExpr = `(${statusTextExpr} LIKE '%closed%' OR ${statusTextExpr} REGEXP 'declin|reject|cancel|not interested|drop|left')`;
    const acceptedExpr = `(${statusTextExpr} LIKE '%accepted%' OR ${statusTextExpr} LIKE '%admitted%' OR ${statusTextExpr} LIKE '%confirm%')`;
    const openExpr = `(${statusTextExpr} LIKE '%open%' OR ${statusTextExpr} LIKE '%pending%')`;
    /* ---- Build WHERE ---- */
    const conditions: string[] = [
      '(s.IsDelete = 0 OR s.IsDelete IS NULL)',
      "s.Admission != 1",
      "s.IsAdmOpen = 'open'",
      "s.Status_id != 8",
      "s.Admission_Dt IS NOT NULL"
    ];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(
        `(s.Student_Name LIKE ? OR s.Email LIKE ? OR s.Present_Mobile LIKE ? OR s.Batch_Code LIKE ?)`
      );
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    if (statusCategory) {
      if (statusCategory === 'closed') {
        conditions.push(closedExpr);
      } else if (statusCategory === 'open') {
        conditions.push(`(${openExpr} OR (NOT ${closedExpr} AND NOT ${acceptedExpr}))`);
      } else if (statusCategory === 'accepted') {
        conditions.push(acceptedExpr);
      }
    }

    if (dateFrom) {
      conditions.push('s.Admission_Dt >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('s.Admission_Dt <= ?');
      params.push(dateTo);
    }

    const where = conditions.join(' AND ');

    /* ---- Count ---- */
    const countSql = `
      SELECT COUNT(*) AS total
      FROM student_master s
      LEFT JOIN Status_Master stm ON stm.Id = ${statusIdExpr}
      WHERE ${where}
    `;
    const [countRows] = await pool.query<any[]>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    /* ---- Data ---- */
    const dataSql = `
      SELECT
        s.Student_Id as Admission_Id,
        s.Student_Id,
        s.Student_Name,
        s.Email,
        s.Present_Mobile,
        s.Batch_Code as Batch_code,
        s.Admission_Dt as Admission_Date,
        s.Status_id as OnlineStateRaw,
        ${statusIdExpr} as OnlineStateId,
        COALESCE(stm.Status, '') as StatusText
      FROM student_master s
      LEFT JOIN Status_Master stm ON stm.Id = ${statusIdExpr}
      WHERE ${where}
      ORDER BY s.Student_Id DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, limit, offset];
    const [rows] = await pool.query<any[]>(dataSql, dataParams);

    // Load all status labels from DB (support both new and legacy table names).
    let statusOptions: { id: number; label: string }[] = [];
    const pushStatuses = (rows: any[]) => {
      for (const r of rows) {
        const id = Number(r?.id);
        const label = String(r?.label ?? '').trim();
        if (!Number.isFinite(id) || !label) continue;
        if (!statusOptions.some((s) => s.id === id)) {
          statusOptions.push({ id, label });
        }
      }
    };

    try {
      const [statusRows] = await pool.query<any[]>(
        `SELECT Status_id as id, Status as label
         FROM awt_status
         WHERE Status_id IS NOT NULL
         ORDER BY Status_id`
      );
      pushStatuses(statusRows as any[]);
    } catch {
      // Ignore and continue with other sources.
    }

    try {
      const [legacyRows] = await pool.query<any[]>(
        `SELECT Id as id, Status as label
         FROM Status_Master
         WHERE Id IS NOT NULL
         ORDER BY Id`
      );
      pushStatuses(legacyRows as any[]);
    } catch {
      // Ignore and continue with fallback map.
    }

    if (statusOptions.length === 0) {
      statusOptions = Object.entries(fallbackStatusMap).map(([id, label]) => ({
        id: Number(id),
        label,
      }));
    }

    // Ensure every status present in admissions data is included in options.
    const [statusInAdmissions] = await pool.query<any[]>(
      `SELECT DISTINCT ${statusIdExpr} as id
       FROM student_master s
       WHERE (s.IsDelete = 0 OR s.IsDelete IS NULL)
         AND s.Admission != 1
         AND ${statusIdExpr} IS NOT NULL`
    );

    const seen = new Set(statusOptions.map((s) => s.id));
    for (const r of statusInAdmissions as any[]) {
      const id = Number(r?.id);
      if (!Number.isFinite(id) || seen.has(id)) continue;
      statusOptions.push({
        id,
        label: fallbackStatusMap[id] ?? `Status ${id}`,
      });
      seen.add(id);
    }

    // Also include statuses in the current paginated result set.
    for (const r of rows) {
      const id = Number(r?.OnlineStateId);
      if (!Number.isFinite(id) || seen.has(id)) continue;
      statusOptions.push({
        id,
        label: fallbackStatusMap[id] ?? `Status ${id}`,
      });
      seen.add(id);
    }

    statusOptions.sort((a, b) => a.id - b.id);

    const statusLabelMap: Record<number, string> = Object.fromEntries(
      statusOptions.map((s) => [s.id, s.label])
    );

    const categoryLabel = (r: any): 'Closed' | 'Open' | 'Accepted' => {
      const base = String(r?.StatusText || statusLabelMap[r?.OnlineStateId] || '').toLowerCase();
      const isClosed = /closed/.test(base) || /(declin|reject|cancel|not interested|drop|left)/.test(base);
      if (isClosed) return 'Closed';

      const isAccepted = /accepted|admitted|confirm/.test(base);
      if (isAccepted) return 'Accepted';

      const isOpen = /open|pending/.test(base) || base.length === 0;
      if (isOpen) return 'Open';

      return 'Open';
    };

    /* map status labels */
    const mapped = rows.map((r: any) => ({
      ...r,
      Status_id: r.OnlineStateId,
      StatusLabel: categoryLabel(r),
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
        Status_id = 8,
        Admission = 1
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
