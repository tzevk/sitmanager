/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { sendOnlineAdmissionSubmissionEmail } from '@/lib/mailer';

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

const ONLINE_ADMISSION_PAYLOAD_TABLE = 'online_admission_payload';

const toIntOrNull = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toStr = (value: unknown): string => (value == null ? '' : String(value));

async function ensureOnlineAdmissionPayloadTable(pool: any) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${ONLINE_ADMISSION_PAYLOAD_TABLE} (
      Student_Id INT NOT NULL PRIMARY KEY,
      Payload LONGTEXT NULL,
      Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

async function upsertOnlineAdmissionPayload(pool: any, studentId: number, body: any) {
  await ensureOnlineAdmissionPayloadTable(pool);
  await pool.query(
    `INSERT INTO ${ONLINE_ADMISSION_PAYLOAD_TABLE} (Student_Id, Payload)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE Payload = VALUES(Payload)`,
    [studentId, JSON.stringify(body)]
  );
}

function buildAcademicRows(body: any, studentId: number) {
  const rows = [
    {
      qualification: 'SSC',
      discipline: toStr(body.ssc_board),
      institute: toStr(body.ssc_schoolName),
      year: toStr(body.ssc_yearOfPassing),
      marks: toStr(body.ssc_percentage),
      totalKt: toIntOrNull(body.ssc_ktCount) ?? 0,
      statusRemark: JSON.stringify({
        level: 'ssc',
        board: toStr(body.ssc_board),
        ktDetails: Array.isArray(body.ssc_ktDetails) ? body.ssc_ktDetails : [],
      }),
    },
    {
      qualification: 'HSC',
      discipline: toStr(body.hsc_stream || body.hsc_board),
      institute: toStr(body.hsc_collegeName),
      year: toStr(body.hsc_yearOfPassing),
      marks: toStr(body.hsc_percentage),
      totalKt: toIntOrNull(body.hsc_ktCount) ?? 0,
      statusRemark: JSON.stringify({
        level: 'hsc',
        board: toStr(body.hsc_board),
        stream: toStr(body.hsc_stream),
        ktDetails: Array.isArray(body.hsc_ktDetails) ? body.hsc_ktDetails : [],
      }),
    },
    {
      qualification: 'Diploma',
      discipline: toStr(body.diploma_specialization || body.diploma_degree),
      institute: toStr(body.diploma_institute),
      year: toStr(body.diploma_yearOfPassing),
      marks: toStr(body.diploma_percentage),
      totalKt: toIntOrNull(body.diploma_ktCount) ?? 0,
      statusRemark: JSON.stringify({
        level: 'diploma',
        degree: toStr(body.diploma_degree),
        ktDetails: Array.isArray(body.diploma_ktDetails) ? body.diploma_ktDetails : [],
      }),
    },
    {
      qualification: 'Graduation',
      discipline: toStr(body.grad_specialization || body.grad_degree),
      institute: toStr(body.grad_university),
      year: toStr(body.grad_yearOfPassing),
      marks: toStr(body.grad_percentage),
      totalKt: toIntOrNull(body.grad_ktCount) ?? 0,
      statusRemark: JSON.stringify({
        level: 'graduation',
        degree: toStr(body.grad_degree),
        ktDetails: Array.isArray(body.grad_ktDetails) ? body.grad_ktDetails : [],
      }),
    },
    {
      qualification: 'Post Graduation',
      discipline: toStr(body.postgrad_specialization || body.postgrad_degree),
      institute: toStr(body.postgrad_university),
      year: toStr(body.postgrad_yearOfPassing),
      marks: toStr(body.postgrad_percentage),
      totalKt: toIntOrNull(body.postgrad_ktCount) ?? 0,
      statusRemark: JSON.stringify({
        level: 'postgrad',
        degree: toStr(body.postgrad_degree),
        ktDetails: Array.isArray(body.postgrad_ktDetails) ? body.postgrad_ktDetails : [],
      }),
    },
  ];

  return rows
    .filter((r) => r.institute || r.year || r.marks || r.discipline)
    .map((r) => ({ ...r, studentId }));
}

async function upsertAcademicRecords(pool: any, studentId: number, body: any) {
  const academicRows = buildAcademicRows(body, studentId);
  await pool.query('DELETE FROM student_master_aca_rec WHERE Student_Id = ?', [studentId]);

  for (const row of academicRows) {
    await pool.query(
      `INSERT INTO student_master_aca_rec (
        Student_Id,
        Aca_Qualification,
        Discipline,
        Institute,
        Year,
        Marks,
        IsActive,
        IsDelete,
        Status_Remark,
        Total_KT
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
      [
        row.studentId,
        row.qualification,
        row.discipline || null,
        row.institute || null,
        row.year || null,
        row.marks || null,
        row.statusRemark,
        row.totalKt,
      ]
    );
  }
}

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
      '(s.Admission = 1 OR s.Status_id = 8 OR s.Admission_Dt IS NOT NULL)',
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
         AND (s.Admission = 1 OR s.Status_id = 8 OR s.Admission_Dt IS NOT NULL)
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

    const fullName = [body.firstName, body.middleName, body.lastName].filter(Boolean).join(' ');

    // Look up Student_Inquiry by Inquiry_Id first (the URL param is Inquiry_Id, not student_master.Student_Id)
    const [siRows] = await pool.query<any[]>(
      `SELECT Inquiry_Id, Student_Id, Batch_Code, Course_Id
       FROM Student_Inquiry
       WHERE Inquiry_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [body.inquiryId]
    );

    if (!siRows || siRows.length === 0) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    const inquiry = siRows[0];
    const batchCode = body.batchCode || inquiry.Batch_Code || null;
    const courseId = inquiry.Course_Id || null;

    // Resolve or create student_master record
    let studentId: number;
    const linkedStudentId = inquiry.Student_Id ? Number(inquiry.Student_Id) : null;

    const studentExists = async (id: number): Promise<boolean> => {
      const [rows] = await pool.query<any[]>('SELECT Student_Id FROM student_master WHERE Student_Id = ?', [id]);
      return !!(rows as any[]).length;
    };

    const createStudentMaster = async (): Promise<number> => {
      const [result] = await pool.query<any>(
        `INSERT INTO student_master
           (Student_Name, Email, Present_Mobile, DOB, Sex, Nationality, Admission, Status_id, Date_Added, updated_date)
         VALUES (?, ?, ?, ?, ?, ?, 0, 1, NOW(), NOW())`,
        [fullName, body.email, body.mobile, body.dob || null, body.gender || null, body.nationality || 'Indian']
      );
      const newId = result.insertId as number;
      // Link back so future submissions resolve correctly
      await pool.query('UPDATE Student_Inquiry SET Student_Id = ? WHERE Inquiry_Id = ?', [newId, body.inquiryId]);
      return newId;
    };

    if (linkedStudentId && await studentExists(linkedStudentId)) {
      studentId = linkedStudentId;
    } else {
      // Check legacy case: student_master.Student_Id happens to equal the Inquiry_Id
      if (await studentExists(Number(body.inquiryId))) {
        studentId = Number(body.inquiryId);
      } else {
        studentId = await createStudentMaster();
      }
    }

    let batchId: number | null = null;

    if (batchCode) {
      const [batchRows] = await pool.query<any[]>(
        'SELECT Batch_Id FROM batch_mst WHERE Batch_code = ? LIMIT 1',
        [batchCode]
      );
      batchId = batchRows?.[0]?.Batch_Id ? Number(batchRows[0].Batch_Id) : null;
    }

    // Update student_master with form data
    await pool.query(
      `UPDATE student_master SET
        FName = ?,
        MName = ?,
        LName = ?,
        Nickname = ?,
        Student_Name = ?,
        Email = ?,
        Present_Mobile = ?,
        Present_Mobile2 = ?,
        Present_Address = ?,
        Present_City = ?,
        Present_Pin = ?,
        Permanent_Address = ?,
        Permanent_City = ?,
        Permanent_Pin = ?,
        Permanent_State = ?,
        Permanent_Country = ?,
        Nationality = ?,
        DOB = ?,
        Sex = ?,
        Father_Mobile = ?,
        Occupation = ?,
        Company = ?,
        Designation = ?,
        Total_Exp = ?,
        Remark = ?,
        Batch_Code = ?,
        Status_id = 8,
        Admission = 1,
        Admission_Dt = NOW(),
        updated_date = NOW()
      WHERE Student_Id = ?`,
      [
        body.firstName || null,
        body.middleName || null,
        body.lastName || null,
        body.shortName || null,
        fullName,
        body.email,
        body.mobile,
        body.telephone || null,
        body.presentAddress || null,
        body.presentCity || null,
        body.presentPin || null,
        body.permanentAddress || null,
        body.permanentCity || null,
        body.permanentPin || null,
        body.permanentState || null,
        body.permanentCountry || 'India',
        body.nationality || 'Indian',
        body.dob || null,
        body.gender || null,
        body.familyContact || null,
        body.occupationalStatus || null,
        body.jobOrganisation || null,
        body.jobDesignation || null,
        toIntOrNull(body.totalOccupationYears) || 0,
        body.educationRemark || null,
        body.batchCode || null,
        studentId,
      ]
    );

    const [existingAdmission] = await pool.query<any[]>(
      `SELECT Admission_Id FROM admission_master WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1`,
      [studentId]
    );

    let admissionId = existingAdmission?.[0]?.Admission_Id ?? null;
    if (admissionId) {
      await pool.query(
        `UPDATE admission_master
         SET Batch_Id = ?, Course_Id = ?, Admission_Date = NOW(), IsActive = 1, Cancel = 0, IsDelete = 0
         WHERE Admission_Id = ?`,
        [batchId || null, courseId || null, admissionId]
      );
    } else {
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
      admissionId = admissionResult.insertId;
    }

    await upsertAcademicRecords(pool, studentId, body);
    await upsertOnlineAdmissionPayload(pool, studentId, body);

    const recipientEmail = String(body?.email || '').trim();
    if (recipientEmail) {
      try {
        await sendOnlineAdmissionSubmissionEmail({
          toEmail: recipientEmail,
          studentName: fullName,
          applicationId: studentId,
        });
      } catch (mailErr) {
        console.error('Online Admission confirmation email error:', mailErr);
      }
    }

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
