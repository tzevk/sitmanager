/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

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

async function getOnlineAdmissionPayload(pool: any, studentId: number) {
  try {
    await ensureOnlineAdmissionPayloadTable(pool);
    const [rows] = await pool.query<any[]>(
      `SELECT Payload FROM ${ONLINE_ADMISSION_PAYLOAD_TABLE} WHERE Student_Id = ? LIMIT 1`,
      [studentId]
    );
    const payloadText = rows?.[0]?.Payload;
    if (!payloadText) return {};
    return JSON.parse(String(payloadText));
  } catch {
    return {};
  }
}

function mapAcademicRowsToForm(rows: any[]) {
  const byQualification = new Map<string, any>();
  for (const row of rows) {
    const key = String(row.Aca_Qualification || '').toLowerCase();
    if (!key) continue;
    if (!byQualification.has(key)) {
      byQualification.set(key, row);
    }
  }

  const parseRemark = (value: any) => {
    if (!value) return {};
    try {
      return JSON.parse(String(value));
    } catch {
      return {};
    }
  };

  const ssc = byQualification.get('ssc') || {};
  const hsc = byQualification.get('hsc') || {};
  const diploma = byQualification.get('diploma') || {};
  const grad = byQualification.get('graduation') || {};
  const postgrad = byQualification.get('post graduation') || byQualification.get('postgraduation') || {};

  const sscRemark = parseRemark(ssc.Status_Remark);
  const hscRemark = parseRemark(hsc.Status_Remark);
  const diplomaRemark = parseRemark(diploma.Status_Remark);
  const gradRemark = parseRemark(grad.Status_Remark);
  const postgradRemark = parseRemark(postgrad.Status_Remark);

  return {
    ssc_board: toStr(sscRemark.board || ssc.Discipline),
    ssc_schoolName: toStr(ssc.Institute),
    ssc_yearOfPassing: toStr(ssc.Year),
    ssc_percentage: toStr(ssc.Marks),
    ssc_ktCount: toStr(ssc.Total_KT ?? '0'),
    ssc_ktDetails: Array.isArray(sscRemark.ktDetails) ? sscRemark.ktDetails : [],

    hsc_board: toStr(hscRemark.board),
    hsc_collegeName: toStr(hsc.Institute),
    hsc_stream: toStr(hscRemark.stream || hsc.Discipline),
    hsc_yearOfPassing: toStr(hsc.Year),
    hsc_percentage: toStr(hsc.Marks),
    hsc_ktCount: toStr(hsc.Total_KT ?? '0'),
    hsc_ktDetails: Array.isArray(hscRemark.ktDetails) ? hscRemark.ktDetails : [],

    diploma_degree: toStr(diplomaRemark.degree),
    diploma_specialization: toStr(diploma.Discipline),
    diploma_institute: toStr(diploma.Institute),
    diploma_yearOfPassing: toStr(diploma.Year),
    diploma_percentage: toStr(diploma.Marks),
    diploma_ktCount: toStr(diploma.Total_KT ?? '0'),
    diploma_ktDetails: Array.isArray(diplomaRemark.ktDetails) ? diplomaRemark.ktDetails : [],

    grad_degree: toStr(gradRemark.degree),
    grad_specialization: toStr(grad.Discipline),
    grad_university: toStr(grad.Institute),
    grad_yearOfPassing: toStr(grad.Year),
    grad_percentage: toStr(grad.Marks),
    grad_ktCount: toStr(grad.Total_KT ?? '0'),
    grad_ktDetails: Array.isArray(gradRemark.ktDetails) ? gradRemark.ktDetails : [],

    postgrad_degree: toStr(postgradRemark.degree),
    postgrad_specialization: toStr(postgrad.Discipline),
    postgrad_university: toStr(postgrad.Institute),
    postgrad_yearOfPassing: toStr(postgrad.Year),
    postgrad_percentage: toStr(postgrad.Marks),
    postgrad_ktCount: toStr(postgrad.Total_KT ?? '0'),
    postgrad_ktDetails: Array.isArray(postgradRemark.ktDetails) ? postgradRemark.ktDetails : [],
  };
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

async function upsertOnlineAdmissionPayload(pool: any, studentId: number, body: any) {
  await ensureOnlineAdmissionPayloadTable(pool);
  await pool.query(
    `INSERT INTO ${ONLINE_ADMISSION_PAYLOAD_TABLE} (Student_Id, Payload)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE Payload = VALUES(Payload)`,
    [studentId, JSON.stringify(body)]
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'online_admission.view');
    if (auth instanceof NextResponse) return auth;
    
    const pool = getPool();
    const { id: studentId } = await params;

    // Fetch admission and student details
    const [rows] = await pool.query<any[]>(
      `SELECT 
        a.Admission_Id,
        s.Student_Id,
        a.Batch_Id,
        a.Course_Id,
        a.Admission_Date,
        s.Student_Name,
        s.Email,
        s.Present_Mobile,
        s.Present_Mobile2,
        s.Present_Address,
        s.Present_City,
        s.Present_Pin,
        s.Present_State,
        s.Permanent_Address,
        s.Permanent_City,
        s.Permanent_Pin,
        s.Permanent_State,
        s.Permanent_Country,
        s.Nationality,
        s.DOB,
        s.Sex,
        s.Status_id,
        s.Occupation,
        s.Company,
        s.Designation,
        s.Total_Exp,
        s.Father_Mobile,
        s.Batch_Code as Student_Batch_Code,
        b.Batch_code as Admission_Batch_code
      FROM student_master s
      LEFT JOIN admission_master a ON s.Student_Id = a.Student_Id AND a.IsDelete = 0
      LEFT JOIN batch_mst b ON a.Batch_Id = b.Batch_Id
      WHERE s.Student_Id = ? AND (s.IsDelete = 0 OR s.IsDelete IS NULL)`,
      [studentId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const admission = rows[0];
    const payload = await getOnlineAdmissionPayload(pool, Number(studentId));

    const [academicRows] = await pool.query<any[]>(
      `SELECT Aca_Qualification, Discipline, Institute, Year, Marks, Status_Remark, Total_KT
       FROM student_master_aca_rec
       WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [studentId]
    );
    const academicData = mapAcademicRowsToForm(academicRows || []);
    
    // Parse name parts
    const nameParts = (admission.Student_Name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts[nameParts.length - 1] || '';
    const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

    // Format response
    const response = {
      admissionId: admission.Admission_Id,
      studentId: admission.Student_Id,
      firstName: payload.firstName || firstName,
      middleName: payload.middleName || middleName,
      lastName: payload.lastName || lastName,
      shortName: payload.shortName || admission.Nickname || '',
      dob: admission.DOB ? new Date(admission.DOB).toISOString().split('T')[0] : '',
      gender: admission.Sex || '',
      nationality: admission.Nationality || 'Indian',
      email: admission.Email || '',
      mobile: admission.Present_Mobile || '',
      telephone: admission.Present_Mobile2 || '',
      familyContact: payload.familyContact || admission.Father_Mobile || '',
      presentAddress: admission.Present_Address || '',
      presentCity: admission.Present_City || '',
      presentPin: admission.Present_Pin || '',
      permanentAddress: admission.Permanent_Address || '',
      permanentCity: admission.Permanent_City || '',
      permanentPin: admission.Permanent_Pin || '',
      permanentState: admission.Permanent_State || '',
      permanentCountry: admission.Permanent_Country || 'India',
      ...academicData,
      educationRemark: payload.educationRemark || admission.Remark || '',
      occupationalStatus: payload.occupationalStatus || admission.Occupation || '',
      jobOrganisation: payload.jobOrganisation || admission.Company || '',
      jobDescription: payload.jobDescription || '',
      jobDesignation: payload.jobDesignation || admission.Designation || '',
      workingFromYears: payload.workingFromYears || '',
      workingFromMonths: payload.workingFromMonths || '',
      totalOccupationYears: payload.totalOccupationYears || String(admission.Total_Exp || ''),
      selfEmploymentDetails: payload.selfEmploymentDetails || '',
      trainingProgrammeId: payload.trainingProgrammeId || '',
      trainingProgrammeName: payload.trainingProgrammeName || '',
      trainingCategory: payload.trainingCategory || '',
      batchCode: admission.Admission_Batch_code || admission.Student_Batch_Code || '',
      idProofType: payload.idProofType || '',
      consentAcknowledged: Boolean(payload.consentAcknowledged),
      experiencedConsentAcknowledged: Boolean(payload.experiencedConsentAcknowledged),
      termsAgreed: Boolean(payload.termsAgreed),
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error('Online Admission GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'online_admission.update');
    if (auth instanceof NextResponse) return auth;
    
    const pool = getPool();
    const { id: studentId } = await params;
    const body = await req.json();

    // Check if student exists
    const [studentRows] = await pool.query<any[]>(
      'SELECT Student_Id FROM student_master WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)',
      [studentId]
    );

    if (!studentRows || studentRows.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Construct full name
    const fullName = [body.firstName, body.middleName, body.lastName].filter(Boolean).join(' ');

    // Update student_master
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
        Present_State = ?,
        Permanent_Address = ?,
        Permanent_City = ?,
        Permanent_Pin = ?,
        Permanent_State = ?,
        Permanent_Country = ?,
        Nationality = ?,
        DOB = ?,
        Sex = ?,
        Occupation = ?,
        Company = ?,
        Designation = ?,
        Total_Exp = ?,
        Father_Mobile = ?,
        Remark = ?,
        Batch_Code = ?,
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
        body.presentState || null,
        body.permanentAddress || null,
        body.permanentCity || null,
        body.permanentPin || null,
        body.permanentState || null,
        body.permanentCountry || 'India',
        body.nationality || 'Indian',
        body.dob || null,
        body.gender || null,
        body.occupationalStatus || null,
        body.jobOrganisation || null,
        body.jobDesignation || null,
        body.totalOccupationYears ? Number(body.totalOccupationYears) : 0,
        body.familyContact || null,
        body.educationRemark || null,
        body.batchCode || null,
        studentId,
      ]
    );

    await upsertAcademicRecords(pool, Number(studentId), body);
    await upsertOnlineAdmissionPayload(pool, Number(studentId), body);

    // Update admission_master if it exists for this student
    await pool.query(
      `UPDATE admission_master SET
        Admission_Date = COALESCE(Admission_Date, NOW())
      WHERE Student_Id = ? AND IsDelete = 0`,
      [studentId]
    );

    return NextResponse.json({
      success: true,
      message: 'Admission updated successfully',
    });
  } catch (err: unknown) {
    console.error('Online Admission PUT error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'online_admission.delete');
    if (auth instanceof NextResponse) return auth;
    
    const pool = getPool();
    const { id: studentId } = await params;

    // Soft delete student_master
    await pool.query(
      'UPDATE student_master SET IsDelete = 1, updated_date = NOW() WHERE Student_Id = ?',
      [studentId]
    );

    // Soft delete associated admission if there is any
    await pool.query(
      'UPDATE admission_master SET IsDelete = 1 WHERE Student_Id = ?',
      [studentId]
    );

    return NextResponse.json({
      success: true,
      message: 'Admission deleted successfully',
    });
  } catch (err: unknown) {
    console.error('Online Admission DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
