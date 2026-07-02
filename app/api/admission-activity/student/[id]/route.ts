/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { ensureStudentTransferColumns } from '@/lib/student-transfer';
import { ensureAlumniColumn } from '@/lib/student-alumni';
import { saveStructuredAdmissionData } from '@/lib/services/online-admission.service';

const ONLINE_ADMISSION_PAYLOAD_TABLE = 'online_admission_payload';

// Scalar + array keys that make up the structured academic ("Education &
// Enrolment") section of the admission form. Source of truth is the admission
// JSON payload (online_admission_payload.Payload); the student-master edit page
// surfaces and edits the same fields.
const EDUCATION_SCALAR_KEYS = [
  'ssc_board', 'ssc_schoolName', 'ssc_yearOfPassing', 'ssc_percentage', 'ssc_ktCount',
  'hsc_board', 'hsc_collegeName', 'hsc_stream', 'hsc_yearOfPassing', 'hsc_percentage', 'hsc_ktCount',
  'diploma_degree', 'diploma_specialization', 'diploma_institute', 'diploma_yearOfPassing', 'diploma_percentage', 'diploma_ktCount',
  'grad_degree', 'grad_specialization', 'grad_university', 'grad_yearOfPassing', 'grad_percentage', 'grad_ktCount',
  'postgrad_degree', 'postgrad_specialization', 'postgrad_university', 'postgrad_yearOfPassing', 'postgrad_percentage', 'postgrad_ktCount',
  'educationRemark',
] as const;
const EDUCATION_KT_KEYS = ['ssc_ktDetails', 'hsc_ktDetails', 'diploma_ktDetails', 'grad_ktDetails', 'postgrad_ktDetails'] as const;
const KT_DETAIL_FIELDS = ['subjectName', 'year', 'semester', 'clearedYear', 'marks'] as const;

/** Pull only the academic keys out of a merged admission payload. */
function extractEducation(payload: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of EDUCATION_SCALAR_KEYS) {
    out[k] = payload[k] == null ? '' : String(payload[k]);
  }
  for (const k of EDUCATION_KT_KEYS) {
    const arr = Array.isArray(payload[k]) ? payload[k] : [];
    out[k] = arr.map((d: any) => {
      const row: Record<string, string> = {};
      for (const f of KT_DETAIL_FIELDS) row[f] = d?.[f] == null ? '' : String(d[f]);
      return row;
    });
  }
  return out;
}

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

function normalizeText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return '';
}

function parseOptionalNumber(value: unknown): number | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

async function resolveBatchCategoryId(pool: any, batchCode: string | null, categoryValue: string | null): Promise<number | null> {
  const numericCategoryId = parseOptionalNumber(categoryValue);
  if (numericCategoryId !== null) return numericCategoryId;
  if (!batchCode && !categoryValue) return null;

  const conditions: string[] = ['(IsDelete = 0 OR IsDelete IS NULL)'];
  const params: Array<string | number> = [];
  if (batchCode) {
    conditions.push('Batch_code = ?');
    params.push(batchCode);
  }
  if (categoryValue) {
    conditions.push('Category = ?');
    params.push(categoryValue);
  }

  const [rows] = await pool.query(
    `SELECT Batch_Category_id
     FROM batch_mst
     WHERE ${conditions.join(' AND ')}
       AND Batch_Category_id IS NOT NULL
     ORDER BY COALESCE(IsActive, 0) DESC, COALESCE(Admission_Date, SDate, Date_Added) DESC, Batch_Id DESC
     LIMIT 1`,
    params
  ) as [any[], any];
  return rows[0]?.Batch_Category_id != null ? Number(rows[0].Batch_Category_id) : null;
}

function buildAddress(payload: Record<string, any>, prefix: 'present' | 'permanent'): string {
  const combined = normalizeText(payload[`${prefix}Address`]);
  if (combined) return combined;
  const parts = [
    payload[`${prefix}Flat`],
    payload[`${prefix}Building`],
    payload[`${prefix}Street`],
    payload[`${prefix}Area`],
    payload[`${prefix}Landmark`],
  ].map(normalizeText).filter(Boolean);
  return parts.join(', ');
}

function resolveAcademicProfile(payload: Record<string, any>) {
  const candidates = [
    [payload.qualification, payload.discipline, payload.percentage],
    [payload.postgrad_degree, payload.postgrad_specialization, payload.postgrad_percentage],
    [payload.grad_degree, payload.grad_specialization, payload.grad_percentage],
    [payload.diploma_degree, payload.diploma_specialization, payload.diploma_percentage],
    [payload.hsc_stream ? 'HSC' : '', payload.hsc_stream, payload.hsc_percentage],
    [payload.ssc_board ? 'SSC' : '', '', payload.ssc_percentage],
  ];
  for (const [qualification, discipline, percentage] of candidates) {
    if (normalizeText(qualification) || normalizeText(discipline) || normalizeText(percentage)) {
      return { qualification, discipline, percentage };
    }
  }
  return { qualification: '', discipline: '', percentage: '' };
}

function overlayStudentFromPayload(student: Record<string, any>, payload: Record<string, any>, onlineAdmissionDate: string | null) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ...student, OnlineAdmission_Date: onlineAdmissionDate };
  }

  const academic = resolveAcademicProfile(payload);
  const resolvedName = firstNonEmpty(
    [payload.firstName, payload.middleName, payload.lastName].map(normalizeText).filter(Boolean).join(' '),
    payload.fullName,
    student.Student_Name,
  );

  return {
    ...student,
    Student_Name: resolvedName || student.Student_Name,
    FName: firstNonEmpty(student.FName, payload.firstName),
    MName: firstNonEmpty(student.MName, payload.middleName),
    LName: firstNonEmpty(student.LName, payload.lastName),
    DOB: firstNonEmpty(student.DOB, payload.dob),
    Sex: firstNonEmpty(student.Sex, payload.gender),
    Nationality: firstNonEmpty(student.Nationality, payload.nationality),
    Email: firstNonEmpty(student.Email, payload.email),
    Present_Mobile: firstNonEmpty(student.Present_Mobile, payload.mobile),
    Present_Mobile2: firstNonEmpty(student.Present_Mobile2, payload.telephone),
    Present_Address: firstNonEmpty(student.Present_Address, buildAddress(payload, 'present')),
    Present_City: firstNonEmpty(student.Present_City, payload.presentCity),
    Present_State: firstNonEmpty(student.Present_State, payload.presentState),
    Present_Pin: firstNonEmpty(student.Present_Pin, payload.presentPin),
    Present_Country: firstNonEmpty(student.Present_Country, payload.presentCountry),
    Permanent_Address: firstNonEmpty(student.Permanent_Address, buildAddress(payload, 'permanent')),
    Permanent_City: firstNonEmpty(student.Permanent_City, payload.permanentCity),
    Permanent_State: firstNonEmpty(student.Permanent_State, payload.permanentState),
    Permanent_Pin: firstNonEmpty(student.Permanent_Pin, payload.permanentPin),
    Permanent_Country: firstNonEmpty(student.Permanent_Country, payload.permanentCountry),
    Qualification: firstNonEmpty(student.Qualification, academic.qualification),
    Discipline: firstNonEmpty(student.Discipline, academic.discipline),
    Percentage: firstNonEmpty(student.Percentage, academic.percentage),
    Course_Id: student.Course_Id ?? parseOptionalNumber(payload.trainingProgrammeId),
    Batch_Code: firstNonEmpty(student.Batch_Code, payload.batchCode),
    Batch_code: firstNonEmpty(student.Batch_code, student.Batch_Code, payload.batchCode),
    Batch_Category_id: firstNonEmpty(student.Batch_Category_id, payload.trainingCategory),
    OccupationalStatus: firstNonEmpty(student.OccupationalStatus, payload.occupationalStatus),
    Organisation: firstNonEmpty(student.Organisation, payload.jobOrganisation),
    Designation: firstNonEmpty(student.Designation, payload.jobDesignation),
    JobDescription: firstNonEmpty(student.JobDescription, payload.jobDescription),
    TotalExperience: firstNonEmpty(student.TotalExperience, payload.totalOccupationYears),
    Refered_By: firstNonEmpty(student.Refered_By, payload.referredBy),
    OnlineAdmission_Date: onlineAdmissionDate,
  };
}

// GET - fetch single student with all related data
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'student.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureStudentTransferColumns(pool);
    await ensureAlumniColumn(pool);
  const inquiryTable = await resolveInquiryTableName(pool);
    const { id } = await params;

    // Student + latest admission + batch + course (explicit columns — no s.*)
    const [rows] = await pool.query(
      `SELECT
         s.Student_Id, s.Student_Name, s.FName, s.MName, s.LName, s.Photo,
         s.DOB, s.Sex, s.Nationality,
         s.Email, s.Present_Mobile, s.Present_Mobile2,
         s.Present_Address, s.Present_City, s.Present_State, s.Present_Pin, s.Present_Country,
         s.Permanent_Address, s.Permanent_City, s.Permanent_State, s.Permanent_Pin, s.Permanent_Country,
         s.Qualification, s.Discipline, s.Percentage,
         s.Course_Id, s.Batch_Code, s.Batch_Category_id,
         s.Transfered, s.Moved_To_Course_Id, s.Moved_To_Batch_Code,
         s.Company          AS Organisation,
         s.Designation,
         s.Occupation       AS OccupationalStatus,
         s.Total_Exp        AS TotalExperience,
         s.Remark           AS JobDescription,
         s.Inquiry_From, s.Inquiry_Type, s.Inquiry_Dt,
         s.Status_id, s.Status_date,
         s.Admission_Dt,
         s.Refered_By,
         s.Alumni_Registered,
         s.SitPerformance, s.PlacementRemark,
         a.Admission_Id, a.Batch_Id, a.Admission_Date,
         COALESCE(b.Batch_code, b2.Batch_code) AS Batch_code,
         COALESCE(mtc.Course_Name, '')        AS Moved_To_Course_Name,
         COALESCE(b.SDate, b2.SDate)           AS Batch_StartDate,
         COALESCE(b.EDate, b2.EDate)           AS Batch_EndDate,
         COALESCE(b.Fees_Full_Payment, b2.Fees_Full_Payment) AS Total_Fees,
         c.Course_Name,
         st.Status AS Status_name
       FROM student_master s
       LEFT JOIN admission_master a
         ON a.Student_Id = s.Student_Id
         AND (a.IsDelete = 0 OR a.IsDelete IS NULL)
         AND a.Admission_Id = (
           SELECT MAX(a2.Admission_Id)
           FROM admission_master a2
           WHERE a2.Student_Id = s.Student_Id
             AND (a2.IsDelete = 0 OR a2.IsDelete IS NULL)
         )
       LEFT JOIN batch_mst b  ON b.Batch_Id = a.Batch_Id
       LEFT JOIN batch_mst b2 ON b2.Batch_code = s.Batch_Code
                              AND (b2.IsDelete = 0 OR b2.IsDelete IS NULL)
      LEFT JOIN course_mst mtc ON mtc.Course_Id = s.Moved_To_Course_Id
       LEFT JOIN course_mst c ON c.Course_Id = s.Course_Id
       LEFT JOIN status_master st ON st.Id = s.Status_id
       WHERE s.Student_Id = ? AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
       LIMIT 1`,
      [id]
    ) as [any[], any];

    if (!rows.length) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Fetch optional columns that may not exist in all DB deployments
    const optionalExtras: Record<string, unknown> = {};
    for (const col of ['WorkingSince', 'Login_Password']) {
      try {
        const [extRows] = await pool.query(
          `SELECT \`${col}\` AS val FROM student_master WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1`,
          [id]
        ) as [any[], any];
        if (extRows.length) optionalExtras[col] = extRows[0].val ?? null;
      } catch { /* column doesn't exist in this deployment */ }
    }

    // Placement records — CV shortlist children for this student
    const [placement] = await pool.query(
      `SELECT cc.*, cv.CompanyName, cv.TDate AS ShortlistDate, b.Batch_Code, c.Course_Name
       FROM cvchild cc
       LEFT JOIN cv_shortlisted cv ON cc.CV_Id = cv.id
       LEFT JOIN batch_mst b ON cc.Batch_Id = b.Batch_Id
       LEFT JOIN course_mst c ON cv.Course_id = c.Course_Id
       WHERE cc.Student_Id = ? AND (cc.IsDelete = 0 OR cc.IsDelete IS NULL)
       ORDER BY cc.id DESC`,
      [id]
    ) as [any[], any];

    // Fees paid = sum of credit (TypeR='C') entries in the fees ledger
    const [feeRows] = await pool.query(
      `SELECT COALESCE(SUM(Amount), 0) AS Paid
       FROM s_fees_mst
       WHERE Student_Id = ? AND TypeR = 'C' AND IsDelete = 0`,
      [id]
    ) as [any[], any];
    const totalFees = Number(rows[0].Total_Fees) || 0;
    const paidFees  = Number(feeRows[0]?.Paid) || 0;
    const fees = {
      total: totalFees,
      paid: paidFees,
      balance: totalFees - paidFees,
    };

    // A student can have MULTIPLE online-admission inquiries/submissions, and the data they
    // filled may be spread across them. Fetch them all and merge so nothing is lost in the
    // edit view (newest non-empty value wins; older submissions backfill remaining gaps).
    const [inqRows] = await pool.query(
      `SELECT Inquiry_Id, Qualification, Discipline, Percentage, Institute, Year, Marks
       FROM ${inquiryTable}
       WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Inquiry_Id DESC`,
      [id]
    ) as [any[], any];
    const inquiryId = inqRows[0]?.Inquiry_Id ?? null;

    const isEmpty = (v: unknown) => v == null || v === '';

    // Merge education fallback fields across all inquiry rows.
    const inquiry: Record<string, any> = {};
    for (const r of inqRows as any[]) {
      for (const k of ['Qualification', 'Discipline', 'Percentage', 'Institute', 'Year', 'Marks']) {
        if (isEmpty(inquiry[k]) && !isEmpty(r[k])) inquiry[k] = r[k];
      }
    }

    // Merge ALL online-admission payloads for this student's inquiries.
    const payload: Record<string, any> = {};
    let onlineAdmissionDate: string | null = null;
    const inquiryIds = (inqRows as any[]).map((r) => r.Inquiry_Id).filter((x) => x != null);
    if (inquiryIds.length) {
      const [payloadRows] = await pool.query(
        `SELECT Inquiry_Id, Payload, Created_At FROM online_admission_payload
         WHERE Inquiry_Id IN (${inquiryIds.map(() => '?').join(',')})
         ORDER BY Created_At DESC`,
        inquiryIds
      ) as [any[], any];
      for (const pr of payloadRows as any[]) {
        let parsed: Record<string, any> = {};
        try { parsed = pr.Payload ? JSON.parse(String(pr.Payload)) : {}; } catch { parsed = {}; }
        for (const [k, v] of Object.entries(parsed)) {
          if (k === '__draftProgress') continue;
          if (isEmpty(payload[k]) && !isEmpty(v)) payload[k] = v;
        }
        if (!onlineAdmissionDate && pr.Created_At) onlineAdmissionDate = String(pr.Created_At).slice(0, 10);
      }
    }

    // Discussions (linked via Inquiry_Id for new records, student_id for older ones).
    // created_by → admin account name that logged the discussion.
    const [discussions] = await pool.query(
      `SELECT d.id, d.date, d.discussion, d.created_by, d.created_date, d.nextdate,
              COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, ''))), ''), u.username) AS created_by_name
       FROM awt_inquirydiscussion d
       LEFT JOIN awt_adminuser u ON u.id = d.created_by
       WHERE d.deleted = 0 AND (d.Inquiry_id = ? OR d.student_id = ?)
       ORDER BY d.id DESC`,
      [inquiryId ?? -1, id]
    ) as [any[], any];

    // Dropdown options
    const [courses] = await pool.query(
      `SELECT Course_Id, Course_Name FROM course_mst
       WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Course_Name`
    ) as [any[], any];
    const [batches] = await pool.query(
      `SELECT Batch_Id, Batch_code, Course_Id FROM batch_mst
       WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Batch_code DESC`
    ) as [any[], any];
    const [statuses] = await pool.query(
      `SELECT Id AS id, Status AS label FROM status_master WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Id`
    ) as [any[], any];
    // Batch categories come from the master (id + label) so the saved
    // Batch_Category_id maps to a selectable option. Fall back to distinct
    // batch_mst pairs if the master table is absent in this deployment.
    let batchCategories: any[] = [];
    try {
      const [rows] = await pool.query(
        `SELECT id, BatchCategory AS label FROM mst_batchcategory
         WHERE (IsDelete = 0 OR IsDelete IS NULL) AND (IsActive = 1 OR IsActive IS NULL)
            AND LOWER(TRIM(BatchCategory)) <> 'offline'
         ORDER BY id`
      ) as [any[], any];
      batchCategories = rows;
    } catch {
      const [rows] = await pool.query(
        `SELECT DISTINCT Batch_Category_id AS id, Category AS label FROM batch_mst
         WHERE Batch_Category_id IS NOT NULL AND Category IS NOT NULL AND Category != ''
           AND (IsDelete = 0 OR IsDelete IS NULL)
           AND LOWER(TRIM(Category)) <> 'offline'
         ORDER BY Batch_Category_id`
      ) as [any[], any];
      batchCategories = rows;
    }

    // Fall back to inquiry-row education fields when student_master is empty
    const studentBase = {
      ...rows[0],
      ...optionalExtras,
      Qualification: firstNonEmpty(rows[0].Qualification, inquiry.Qualification),
      Discipline:    firstNonEmpty(rows[0].Discipline, inquiry.Discipline),
      Percentage:    firstNonEmpty(rows[0].Percentage, inquiry.Percentage),
    };

    return NextResponse.json({
      student: overlayStudentFromPayload(studentBase, payload, onlineAdmissionDate),
      fees,
      placement,
      discussions,
      documents: [],
      inquiryId,
      education: extractEducation(payload),
      courses,
      batches,
      statuses,
      batchCategories,
    });
  } catch (err: unknown) {
    console.error('Student GET [id] error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - update student record
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'student.update');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureStudentTransferColumns(pool);
    await ensureAlumniColumn(pool);
    const { id } = await params;
    const body = await req.json();

    const {
      // Personal
      FName, MName, LName, Student_Name,
      DOB, Sex, Nationality,
      Email, Present_Mobile, Telephone,
      Present_Address, Present_City, Present_State, Present_Pin, Present_Country,
      Permanent_Address, Permanent_City, Permanent_Pin, Permanent_State, Permanent_Country,
      // Academic
      Qualification, Discipline, Percentage, Course_Id,
      Batch_Code, Batch_code, Batch_Category_id,
      Transfered, Moved_To_Course_Id, Moved_To_Batch_Code,
      // Company / Occupational
      Organisation, Designation, JobDescription, TotalExperience, OccupationalStatus, WorkingSince,
      // Inquiry meta
      Inquiry_From, Inquiry_Type, Inquiry_Dt,
      // Status
      Status_id, Status_date,
      // Student portal / referral
      Login_Password, Refered_By,
      // Admission date
      Admission_Dt,
      // Placement
      SitPerformance, PlacementRemark,
      // Alumni
      Alumni_Registered,
    } = body;

    const fullName = Student_Name ||
      [FName, MName, LName].filter(Boolean).join(' ') || null;
    const resolvedBatchCode = Batch_Code || Batch_code || null;
    const resolvedCourseId = Course_Id ? parseInt(Course_Id) : null;
    const resolvedBatchCategoryId = await resolveBatchCategoryId(pool, resolvedBatchCode, Batch_Category_id || null);
    const resolvedTransfered = String(Transfered ?? '').trim().toLowerCase() === 'yes' ? 'Yes' : null;
    const resolvedMovedToCourseId = Moved_To_Course_Id ? parseInt(Moved_To_Course_Id) : null;
    const resolvedMovedToBatchCode = String(Moved_To_Batch_Code ?? '').trim() || null;

    // ── 1. Core UPDATE — columns guaranteed to exist in all deployments ───
    await pool.query(
      `UPDATE student_master SET
         Student_Name = ?,
         DOB          = ?,
         Sex          = ?,
         Nationality  = ?,
         Email        = ?,
         Present_Mobile   = ?,
         Present_Address  = ?,
         Present_City     = ?,
         Present_State    = ?,
         Present_Pin      = ?,
         Present_Country  = ?,
         Permanent_Address = ?,
         Permanent_City   = ?,
         Permanent_Pin    = ?,
         Permanent_State  = ?,
         Permanent_Country = ?,
         Course_Id        = ?,
         Batch_Code       = ?,
         Batch_Category_id = ?,
         Transfered       = ?,
         Moved_To_Course_Id = ?,
         Moved_To_Batch_Code = ?,
         Qualification    = ?,
         Percentage       = ?,
         Company          = ?,
         Occupation       = ?,
         Total_Exp        = ?,
         Remark           = ?,
         Admission_Dt     = ?,
         Status_id        = ?,
         Status_date      = ?,
         Refered_By       = ?
       WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [
        fullName,
        DOB || null,
        Sex || null,
        Nationality || null,
        Email || null,
        Present_Mobile || null,
        Present_Address || null,
        Present_City || null,
        Present_State || null,
        Present_Pin || null,
        Present_Country || null,
        Permanent_Address || null,
        Permanent_City || null,
        Permanent_Pin || null,
        Permanent_State || null,
        Permanent_Country || null,
        resolvedCourseId,
        resolvedBatchCode,
        resolvedBatchCategoryId,
        resolvedTransfered,
        resolvedMovedToCourseId,
        resolvedTransfered ? resolvedMovedToBatchCode : null,
        Qualification || null,
        Percentage ? parseFloat(Percentage) : null,
        Organisation || null,
        OccupationalStatus || null,
        TotalExperience || null,
        JobDescription || null,
        Admission_Dt || null,
        Status_id ? parseInt(Status_id) : null,
        Status_date || null,
        Refered_By || null,
        id,
      ]
    );

    // ── 2. Optional columns — silently skipped if they don't exist ────────
    const extras: { col: string; val: unknown }[] = [
      { col: 'FName',          val: FName || null },
      { col: 'MName',          val: MName || null },
      { col: 'LName',          val: LName || null },
      { col: 'Present_Mobile2', val: Telephone || null },
      { col: 'Permanent_State', val: Permanent_State || null },
      { col: 'Discipline',     val: Discipline || null },
      { col: 'Designation',    val: Designation || null },
      { col: 'Inquiry_From',   val: Inquiry_From || null },
      { col: 'Inquiry_Type',   val: Inquiry_Type || null },
      { col: 'Inquiry_Dt',     val: Inquiry_Dt || null },
      { col: 'Login_Password', val: Login_Password || null },
      { col: 'WorkingSince',   val: WorkingSince || null },
      { col: 'SitPerformance', val: SitPerformance ? parseFloat(SitPerformance) : null },
      { col: 'PlacementRemark', val: PlacementRemark || null },
      { col: 'Alumni_Registered', val: Alumni_Registered || null },
    ].filter(({ val }) => val !== null && val !== undefined);

    for (const { col, val } of extras) {
      try {
        await pool.query(
          `UPDATE student_master SET \`${col}\` = ? WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
          [val, id]
        );
      } catch {
        // Column doesn't exist in this deployment — skip silently
      }
    }

    // ── 3. Sync admission_master — keeps the student list in sync ────────
    try {
      // Look up Batch_Id from batch code
      let batchId: number | null = null;
      if (resolvedBatchCode) {
        const [batchRows] = await pool.query(
          `SELECT Batch_Id FROM batch_mst
           WHERE Batch_code = ?
             AND (IsDelete = 0 OR IsDelete IS NULL)
           LIMIT 1`,
          [resolvedBatchCode]
        ) as [any[], any];
        batchId = batchRows[0]?.Batch_Id ? Number(batchRows[0].Batch_Id) : null;
      }

      // Find the latest active admission for this student
      const [admRows] = await pool.query(
        `SELECT Admission_Id FROM admission_master
         WHERE Student_Id = ?
           AND (IsDelete = 0 OR IsDelete IS NULL)
           AND (Cancel   = 0 OR Cancel   IS NULL)
         ORDER BY Admission_Id DESC
         LIMIT 1`,
        [id]
      ) as [any[], any];

      if (admRows.length) {
        const admissionId = admRows[0].Admission_Id;
        const setClauses: string[] = [];
        const setVals: (string | number | null)[] = [];

        if (batchId !== null)        { setClauses.push('Batch_Id = ?');       setVals.push(batchId); }
        if (resolvedCourseId !== null){ setClauses.push('Course_Id = ?');      setVals.push(resolvedCourseId); }
        if (Admission_Dt)            { setClauses.push('Admission_Date = ?');  setVals.push(Admission_Dt); }

        if (setClauses.length) {
          await pool.query(
            `UPDATE admission_master SET ${setClauses.join(', ')} WHERE Admission_Id = ?`,
            [...setVals, admissionId]
          );
        }
      }
    } catch (admErr) {
      console.warn('Student PUT: admission_master sync skipped:', (admErr as Error)?.message);
    }

    // ── 4. Persist structured academic data back to the admission payload ──
    // The detailed Education & Enrolment fields (SSC/HSC/Diploma/Grad/PG + KT)
    // live in online_admission_payload, keyed by the student's inquiry. Merge the
    // edited values into the latest payload (JSON blob + normalized columns/KT).
    const education = body.education;
    if (education && typeof education === 'object' && !Array.isArray(education)) {
      try {
        // Keep only the recognised academic keys from the client payload.
        const edits: Record<string, any> = {};
        for (const k of EDUCATION_SCALAR_KEYS) {
          if (education[k] !== undefined) edits[k] = education[k];
        }
        for (const k of EDUCATION_KT_KEYS) {
          if (Array.isArray(education[k])) {
            edits[k] = education[k].map((d: any) => {
              const row: Record<string, string> = {};
              for (const f of KT_DETAIL_FIELDS) row[f] = d?.[f] == null ? '' : String(d[f]);
              return row;
            });
          }
        }

        const inquiryTable = await resolveInquiryTableName(pool);
        const [inqRows] = await pool.query(
          `SELECT Inquiry_Id FROM \`${inquiryTable}\`
           WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
           ORDER BY Inquiry_Id DESC`,
          [id]
        ) as [any[], any];
        const inquiryIds = (inqRows as any[]).map((r) => r.Inquiry_Id).filter((x) => x != null);

        if (inquiryIds.length) {
          // Target the most recently updated existing payload row, else the latest inquiry.
          const [payloadRows] = await pool.query(
            `SELECT Inquiry_Id, Payload FROM ${ONLINE_ADMISSION_PAYLOAD_TABLE}
             WHERE Inquiry_Id IN (${inquiryIds.map(() => '?').join(',')})
             ORDER BY Updated_At DESC, Created_At DESC
             LIMIT 1`,
            inquiryIds
          ) as [any[], any];

          let targetInquiryId: number;
          let currentPayload: Record<string, any> = {};
          if ((payloadRows as any[]).length) {
            targetInquiryId = Number((payloadRows as any[])[0].Inquiry_Id);
            try { currentPayload = (payloadRows as any[])[0].Payload ? JSON.parse(String((payloadRows as any[])[0].Payload)) : {}; } catch { currentPayload = {}; }
          } else {
            targetInquiryId = Number(inquiryIds[0]);
          }

          const merged = { ...currentPayload, ...edits };
          await pool.query(
            `INSERT INTO ${ONLINE_ADMISSION_PAYLOAD_TABLE} (Inquiry_Id, Payload)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE Payload = VALUES(Payload), Updated_At = NOW()`,
            [targetInquiryId, JSON.stringify(merged)]
          );

          // Mirror into the normalized columns + KT table (and refresh the
          // flat Qualification/Discipline/Percentage summary on student_master).
          await saveStructuredAdmissionData(targetInquiryId, merged);
          const academic = resolveAcademicProfile(merged);
          if (academic.qualification || academic.discipline || academic.percentage) {
            await pool.query(
              `UPDATE student_master SET Qualification = ?, Percentage = ?
               WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
              [academic.qualification || null, academic.percentage ? parseFloat(academic.percentage) : null, id]
            );
            try {
              await pool.query(
                `UPDATE student_master SET Discipline = ? WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
                [academic.discipline || null, id]
              );
            } catch { /* Discipline column may not exist in this deployment */ }
          }
        }
      } catch (eduErr) {
        console.warn('Student PUT: education payload sync skipped:', (eduErr as Error)?.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Student PUT error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
