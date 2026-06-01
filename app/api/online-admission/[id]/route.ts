/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';
import { resolveInquiryTableName } from '@/lib/services/inquiry.service';
import { syncOnlineAdmissionIntoCurrentDb } from '@/lib/services/online-admission.service';

const ONLINE_ADMISSION_PAYLOAD_TABLE = 'online_admission_payload';

let payloadTableReady = false;

let statusTableCache: string | null | undefined;
let studentMasterTableCache: string | null | undefined;
async function resolveStatusTableName(pool: any): Promise<string | null> {
  if (statusTableCache !== undefined) return statusTableCache;
  try {
    const [rows] = await pool.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'status_master' LIMIT 1`
    ) as [any[], any];
    statusTableCache = (rows as any[])[0]?.TABLE_NAME ?? null;
  } catch {
    statusTableCache = null;
  }
  return statusTableCache ?? null;
}

async function resolveStudentMasterTableName(pool: any): Promise<string | null> {
  if (studentMasterTableCache !== undefined) return studentMasterTableCache;
  try {
    const [rows] = await pool.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'student_master'
       ORDER BY CASE WHEN TABLE_NAME = 'student_master' THEN 0 ELSE 1 END
       LIMIT 1`
    ) as [any[], any];
    studentMasterTableCache = String((rows as any[])[0]?.TABLE_NAME || '').trim() || null;
  } catch {
    studentMasterTableCache = null;
  }
  return studentMasterTableCache;
}

const toStr = (value: unknown): string => (value == null ? '' : String(value));

const fallbackStatusMap: Record<number, string> = {
  0: 'New Inquiry', 1: 'Follow Up', 2: 'Interested', 3: 'Confirmed',
  4: 'Not Interested', 5: 'Batch Started', 6: 'Batch Completed',
  7: 'Cancelled', 8: 'Admitted', 9: 'Left', 10: 'On Hold',
  19: 'Online Inquiry', 23: 'Document Pending', 24: 'Fees Pending',
};

async function ensurePayloadTable(pool: any) {
  if (payloadTableReady) return;
  try {
    const [pkRows] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
       LIMIT 1`,
      [ONLINE_ADMISSION_PAYLOAD_TABLE]
    ) as [any[], any];
    const pkCol: string = String((pkRows as any[])[0]?.COLUMN_NAME ?? '');
    if (pkCol && pkCol !== 'Inquiry_Id') {
      await pool.query(`DROP TABLE \`${ONLINE_ADMISSION_PAYLOAD_TABLE}\``);
    } else if (pkCol === 'Inquiry_Id') {
      // If a legacy Student_Id NOT NULL column exists, make it nullable so the
      // INSERT (which only specifies Inquiry_Id + Payload) doesn't fail.
      const [badCol] = await pool.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
           AND COLUMN_NAME = 'Student_Id' AND IS_NULLABLE = 'NO' LIMIT 1`,
        [ONLINE_ADMISSION_PAYLOAD_TABLE]
      ) as [any[], any];
      if ((badCol as any[]).length > 0) {
        await pool.query(`ALTER TABLE \`${ONLINE_ADMISSION_PAYLOAD_TABLE}\` MODIFY COLUMN Student_Id INT NULL`);
      }
    }
  } catch { /* table doesn't exist yet */ }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${ONLINE_ADMISSION_PAYLOAD_TABLE} (
      Inquiry_Id INT NOT NULL PRIMARY KEY,
      Payload    LONGTEXT NULL,
      Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  payloadTableReady = true;
}


async function savePayload(pool: any, inquiryId: number, body: any) {
  await ensurePayloadTable(pool);
  await pool.query(
    `INSERT INTO ${ONLINE_ADMISSION_PAYLOAD_TABLE} (Inquiry_Id, Payload)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE Payload = VALUES(Payload), Updated_At = NOW()`,
    [inquiryId, JSON.stringify(body)]
  );
}

async function getPayload(pool: any, inquiryId: number): Promise<Record<string, any>> {
  try {
    await ensurePayloadTable(pool);
    const [rows] = await pool.query(
      `SELECT Payload FROM ${ONLINE_ADMISSION_PAYLOAD_TABLE} WHERE Inquiry_Id = ? LIMIT 1`,
      [inquiryId]
    ) as [any[], any];
    const text = rows?.[0]?.Payload;
    if (!text) return {};
    return JSON.parse(String(text));
  } catch {
    return {};
  }
}

/* ─── GET — load edit form ──────────────────────────────────────────────── */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimited = await apiRateLimiter(req);
    if (rateLimited) return rateLimited;

    const auth = await requirePermission(req, 'online_admission.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { id } = await params;
    const inquiryId = Number(id);

    const [inquiryTable, statusTable, studentMasterTable] = await Promise.all([
      resolveInquiryTableName(pool),
      resolveStatusTableName(pool),
      resolveStudentMasterTableName(pool),
    ]);

    // Load inquiry record
    const statusJoin = statusTable
      ? `LEFT JOIN \`${statusTable}\` stm ON stm.Id = si.OnlineState`
      : '';
    const statusCol = statusTable ? `COALESCE(stm.Status, '')` : `''`;
    const studentJoin = studentMasterTable
      ? `LEFT JOIN \
\`${studentMasterTable}\` sm
           ON sm.Student_Id = si.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
         LEFT JOIN admission_master am
           ON am.Admission_Id = (
             SELECT am2.Admission_Id
             FROM admission_master am2
             WHERE am2.Student_Id = si.Student_Id
               AND (am2.IsDelete = 0 OR am2.IsDelete IS NULL)
             ORDER BY am2.Admission_Date DESC, am2.Admission_Id DESC
             LIMIT 1
           )
         LEFT JOIN batch_mst b ON b.Batch_Id = am.Batch_Id
         LEFT JOIN batch_mst b2 ON b2.Batch_code = sm.Batch_Code AND (b2.IsDelete = 0 OR b2.IsDelete IS NULL)`
      : '';
    const [siRows] = await pool.query(
      `SELECT
         si.Inquiry_Id,
         si.Student_Id,
         si.Student_Name,
         COALESCE(si.Email, '') as Email,
         COALESCE(si.Present_Mobile, '') as Present_Mobile,
         COALESCE(si.Present_Mobile2, '') as Present_Mobile2,
         si.Sex,
         si.DOB,
         COALESCE(si.Nationality, 'Indian') as Nationality,
         si.OnlineState as Status_id,
         ${statusCol} as StatusText,
         COALESCE(si.Batch_Code, '') as Batch_Code,
         COALESCE(si.Course_Id, 0) as Course_Id,
         COALESCE(si.Qualification, '') as Qualification,
         COALESCE(si.Discipline, '') as Discipline,
         COALESCE(sm.FName, '') as Student_FName,
         COALESCE(sm.MName, '') as Student_MName,
         COALESCE(sm.LName, '') as Student_LName,
         COALESCE(sm.Student_Name, '') as StudentMaster_Name,
         COALESCE(sm.Email, '') as Student_Email,
         COALESCE(sm.Present_Mobile, '') as Student_Present_Mobile,
         COALESCE(sm.Present_Mobile2, '') as Student_Telephone,
         COALESCE(sm.Sex, '') as Student_Sex,
         sm.DOB as Student_DOB,
         COALESCE(sm.Nationality, 'Indian') as Student_Nationality,
         COALESCE(sm.Present_Address, '') as Student_Present_Address,
         COALESCE(sm.Present_City, '') as Student_Present_City,
         COALESCE(sm.Present_State, '') as Student_Present_State,
         COALESCE(sm.Present_Pin, '') as Student_Present_Pin,
         COALESCE(sm.Present_Country, 'India') as Student_Present_Country,
         COALESCE(sm.Permanent_Address, '') as Student_Permanent_Address,
         COALESCE(sm.Permanent_City, '') as Student_Permanent_City,
         COALESCE(sm.Permanent_State, '') as Student_Permanent_State,
         COALESCE(sm.Permanent_Pin, '') as Student_Permanent_Pin,
         COALESCE(sm.Permanent_Country, 'India') as Student_Permanent_Country,
         COALESCE(sm.Qualification, '') as Student_Qualification,
         COALESCE(sm.Discipline, '') as Student_Discipline,
         sm.Percentage as Student_Percentage,
         COALESCE(sm.Course_Id, 0) as Student_Course_Id,
         COALESCE(sm.Batch_Code, '') as Student_Batch_Code,
         COALESCE(sm.Occupation, '') as Student_OccupationalStatus,
         COALESCE(sm.Company, '') as Student_Organisation,
         COALESCE(sm.Designation, '') as Student_Designation,
         COALESCE(sm.Remark, '') as Student_JobDescription,
         NULL as Student_WorkingSince,
         COALESCE(sm.Total_Exp, '') as Student_TotalExperience,
         COALESCE(sm.Refered_By, '') as Student_Refered_By,
         sm.Admission_Dt as Student_Admission_Dt,
         am.Admission_Date as Admission_Date,
         COALESCE(b.Batch_code, b2.Batch_code, sm.Batch_Code, si.Batch_Code, '') as Resolved_Batch_Code
       FROM \`${inquiryTable}\` si
       ${statusJoin}
       ${studentJoin}
       WHERE si.Inquiry_Id = ? AND (si.IsDelete = 0 OR si.IsDelete IS NULL)`,
      [inquiryId]
    ) as [any[], any];

    if (!(siRows as any[]).length) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    const si = (siRows as any[])[0];
    const payload = await getPayload(pool, inquiryId);
    const studentNameSource = String(si.StudentMaster_Name || si.Student_Name || '').trim();

    const rawStatusId = Number(si.Status_id);
    const rawStatusText = String(si.StatusText || '').trim();
    const statusLabel = rawStatusText || fallbackStatusMap[rawStatusId] || `Status ${rawStatusId}`;
    const statusCategory = (() => {
      const l = statusLabel.toLowerCase();
      if (/accepted|admitted|confirm/.test(l)) return 'accepted';
      if (/cancel|reject|closed|left|not interested|drop/.test(l)) return 'closed';
      return 'open';
    })();

    // Resolve training programme ID from payload, or look up by name
    let resolvedTrainingProgrammeId = payload.trainingProgrammeId ? String(payload.trainingProgrammeId) : '';
    if (!resolvedTrainingProgrammeId && payload.trainingProgrammeName) {
      try {
        const [courseRows] = await pool.query(
          'SELECT Course_Id FROM course_mst WHERE Course_Name = ? LIMIT 1',
          [payload.trainingProgrammeName]
        ) as [any[], any];
        if (courseRows?.[0]?.Course_Id) resolvedTrainingProgrammeId = String(courseRows[0].Course_Id);
      } catch { /* ignore */ }
    }
    if (!resolvedTrainingProgrammeId && si.Course_Id) {
      resolvedTrainingProgrammeId = String(si.Course_Id);
    }
    if (!resolvedTrainingProgrammeId && si.Student_Course_Id) {
      resolvedTrainingProgrammeId = String(si.Student_Course_Id);
    }

    // Parse name parts from payload first, then fall back to inquiry name
    const nameParts = studentNameSource.split(' ').filter(Boolean);
    const firstName  = si.Student_FName || payload.firstName || nameParts[0] || '';
    const lastName   = si.Student_LName || payload.lastName || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '') || '';
    const middleName = si.Student_MName || payload.middleName || (nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '') || '';

    return NextResponse.json({
      // metadata
      inquiryId:      si.Inquiry_Id,
      admissionId:    si.Inquiry_Id, // kept for edit page compat
      studentId:      si.Student_Id || null,
      statusId:       rawStatusId || null,
      statusLabel,
      statusCategory,

      // personal — payload wins, inquiry is fallback
      firstName,
      middleName,
      lastName,
      shortName:      payload.shortName  || '',
      dob:            (si.Student_DOB ? String(si.Student_DOB).slice(0, 10) : '') || payload.dob || (si.DOB ? String(si.DOB).slice(0, 10) : ''),
      gender:         si.Student_Sex || payload.gender || si.Sex || '',
      nationality:    si.Student_Nationality || payload.nationality || si.Nationality || 'Indian',

      // contact
      email:          si.Student_Email || payload.email || si.Email || '',
      mobile:         si.Student_Present_Mobile || payload.mobile || si.Present_Mobile || '',
      telephone:      si.Student_Telephone || payload.telephone || si.Present_Mobile2 || '',
      familyContact:  payload.familyContact || '',

      // address
      presentFlat:        payload.presentFlat        || '',
      presentBuilding:    payload.presentBuilding    || '',
      presentStreet:      payload.presentStreet      || '',
      presentArea:        payload.presentArea        || '',
      presentLandmark:    payload.presentLandmark    || '',
      presentAddress:     si.Student_Present_Address || payload.presentAddress || '',
      presentCity:        si.Student_Present_City || payload.presentCity || '',
      presentPin:         toStr(si.Student_Present_Pin) || payload.presentPin || '',
      presentState:       si.Student_Present_State || payload.presentState || '',
      presentDistrict:    payload.presentDistrict    || '',
      presentCountry:     si.Student_Present_Country || payload.presentCountry || 'India',
      permanentFlat:      payload.permanentFlat      || '',
      permanentBuilding:  payload.permanentBuilding  || '',
      permanentStreet:    payload.permanentStreet    || '',
      permanentArea:      payload.permanentArea      || '',
      permanentLandmark:  payload.permanentLandmark  || '',
      permanentAddress:   si.Student_Permanent_Address || payload.permanentAddress || '',
      permanentCity:      si.Student_Permanent_City || payload.permanentCity || '',
      permanentPin:       toStr(si.Student_Permanent_Pin) || payload.permanentPin || '',
      permanentState:     si.Student_Permanent_State || payload.permanentState || '',
      permanentDistrict:  payload.permanentDistrict  || '',
      permanentCountry:   si.Student_Permanent_Country || payload.permanentCountry || 'India',
      sameAsPresent:      Boolean(payload.sameAsPresent),

      // academic
      ssc_board:           payload.ssc_board            || '',
      ssc_schoolName:      payload.ssc_schoolName        || '',
      ssc_yearOfPassing:   payload.ssc_yearOfPassing    || '',
      ssc_percentage:      payload.ssc_percentage        || '',
      ssc_ktCount:         payload.ssc_ktCount           || '0',
      ssc_ktDetails:       payload.ssc_ktDetails         || [],
      hsc_board:           payload.hsc_board             || '',
      hsc_collegeName:     payload.hsc_collegeName       || '',
      hsc_stream:          payload.hsc_stream            || '',
      hsc_yearOfPassing:   payload.hsc_yearOfPassing     || '',
      hsc_percentage:      payload.hsc_percentage        || '',
      hsc_ktCount:         payload.hsc_ktCount           || '0',
      hsc_ktDetails:       payload.hsc_ktDetails         || [],
      diploma_degree:      payload.diploma_degree        || '',
      diploma_specialization: payload.diploma_specialization || '',
      diploma_institute:   payload.diploma_institute     || '',
      diploma_yearOfPassing: payload.diploma_yearOfPassing || '',
      diploma_percentage:  payload.diploma_percentage    || '',
      diploma_ktCount:     payload.diploma_ktCount       || '0',
      diploma_ktDetails:   payload.diploma_ktDetails     || [],
      grad_degree:         payload.grad_degree           || '',
      grad_specialization: payload.grad_specialization   || '',
      grad_university:     payload.grad_university       || '',
      grad_yearOfPassing:  payload.grad_yearOfPassing    || '',
      grad_percentage:     payload.grad_percentage       || '',
      grad_ktCount:        payload.grad_ktCount          || '0',
      grad_ktDetails:      payload.grad_ktDetails        || [],
      postgrad_degree:     payload.postgrad_degree       || '',
      postgrad_specialization: payload.postgrad_specialization || '',
      postgrad_university: payload.postgrad_university   || '',
      postgrad_yearOfPassing: payload.postgrad_yearOfPassing || '',
      postgrad_percentage: payload.postgrad_percentage   || '',
      postgrad_ktCount:    payload.postgrad_ktCount      || '0',
      postgrad_ktDetails:  payload.postgrad_ktDetails    || [],
      educationRemark:     payload.educationRemark       || '',
      qualification:       si.Student_Qualification || payload.qualification || si.Qualification || '',
      discipline:          si.Student_Discipline || payload.discipline || si.Discipline || '',
      percentage:          toStr(si.Student_Percentage) || payload.percentage || '',

      // occupational
      occupationalStatus:    si.Student_OccupationalStatus || payload.occupationalStatus || '',
      jobOrganisation:       si.Student_Organisation || payload.jobOrganisation || '',
      jobDesignation:        si.Student_Designation || payload.jobDesignation || '',
      totalOccupationYears:  toStr(si.Student_TotalExperience) || payload.totalOccupationYears || '',
      jobDescription:        si.Student_JobDescription || payload.jobDescription || '',
      workingFromYears:      (si.Student_WorkingSince ? String(si.Student_WorkingSince).slice(0, 4) : '') || payload.workingFromYears || '',
      workingFromMonths:     payload.workingFromMonths     || '',
      selfEmploymentDetails: payload.selfEmploymentDetails || '',

      // training
      trainingProgrammeId:   resolvedTrainingProgrammeId,
      trainingProgrammeName: payload.trainingProgrammeName || '',
      trainingCategory:      payload.trainingCategory      || '',
      batchCode:             si.Resolved_Batch_Code || si.Student_Batch_Code || payload.batchCode || si.Batch_Code || '',

      // payment & terms
      modeOfPayment:         payload.modeOfPayment || '',
      idProofType:           payload.idProofType   || '',
      photo:                 payload.photo         || '',
      termsAgreed:           Boolean(payload.termsAgreed),
      consentAcknowledged:   Boolean(payload.consentAcknowledged),
      experiencedConsentAcknowledged: Boolean(payload.experiencedConsentAcknowledged),
      consentChecks:         Array.isArray(payload.consentChecks) ? payload.consentChecks : [],
      consentData:           payload.consentData || { eligibility: '', qualification: '', candidateRemark: '' },
    });
  } catch (err: unknown) {
    console.error('Online Admission [id] GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ─── PUT — save edits / accept / reject ───────────────────────────────── */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'online_admission.update');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { id } = await params;
    const inquiryId = Number(id);
    const body = await req.json();

    const inquiryTable = await resolveInquiryTableName(pool);

    // Verify inquiry exists
    const [siRows] = await pool.query(
      `SELECT Inquiry_Id FROM \`${inquiryTable}\` WHERE Inquiry_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [inquiryId]
    ) as [any[], any];
    if (!(siRows as any[]).length) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    // Determine status change
    let newStatus: number | null = null;
    if (body.statusAction === 'accept') newStatus = 8;   // Admitted
    if (body.statusAction === 'reject') newStatus = 7;   // Cancelled

    const fullName = [body.firstName, body.middleName, body.lastName].filter(Boolean).join(' ');

    // Resolve batch code from form
    const batchCode = String(body.batchCode || '').trim() || null;

    // Update inquiry record
    const setClauses: string[] = [];
    const setVals: any[] = [];

    if (newStatus !== null) { setClauses.push('OnlineState = ?'); setVals.push(newStatus); }
    if (fullName)            { setClauses.push('Student_Name = ?'); setVals.push(fullName); }
    if (body.email)          { setClauses.push('Email = ?'); setVals.push(body.email); }
    if (body.mobile)         { setClauses.push('Present_Mobile = ?'); setVals.push(body.mobile); }
    if (body.dob)            { setClauses.push('DOB = ?'); setVals.push(body.dob); }
    if (body.gender)         { setClauses.push('Sex = ?'); setVals.push(body.gender); }
    if (batchCode)           { setClauses.push('Batch_Code = ?'); setVals.push(batchCode); }

    if (setClauses.length) {
      await pool.query(
        `UPDATE \`${inquiryTable}\` SET ${setClauses.join(', ')} WHERE Inquiry_Id = ?`,
        [...setVals, inquiryId]
      );
    }

    // Save updated payload
    const stripFiles = (arr: any[]) =>
      Array.isArray(arr) ? arr.map(({ marksheetFile: _f, ...rest }: any) => rest) : arr;
    const cleanBody = {
      ...body,
      ssc_ktDetails:      stripFiles(body.ssc_ktDetails),
      hsc_ktDetails:      stripFiles(body.hsc_ktDetails),
      diploma_ktDetails:  stripFiles(body.diploma_ktDetails),
      grad_ktDetails:     stripFiles(body.grad_ktDetails),
      postgrad_ktDetails: stripFiles(body.postgrad_ktDetails),
    };
    await savePayload(pool, inquiryId, cleanBody);
    await syncOnlineAdmissionIntoCurrentDb(inquiryId, cleanBody, { statusAction: body.statusAction || 'update' });

    return NextResponse.json({ success: true, message: 'Admission updated successfully' });
  } catch (err: unknown) {
    console.error('Online Admission PUT error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ─── DELETE — remove submission ────────────────────────────────────────── */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'online_admission.delete');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { id } = await params;
    const inquiryId = Number(id);

    const inquiryTable = await resolveInquiryTableName(pool);

    await ensurePayloadTable(pool);

    // Remove the payload record (the inquiry itself stays intact)
    await pool.query(
      `DELETE FROM ${ONLINE_ADMISSION_PAYLOAD_TABLE} WHERE Inquiry_Id = ?`,
      [inquiryId]
    );

    // Reset inquiry status back to its prior state (undo the "Document Pending" flag)
    await pool.query(
      `UPDATE \`${inquiryTable}\` SET OnlineState = 1 WHERE Inquiry_Id = ? AND OnlineState IN (23, 8, 7)`,
      [inquiryId]
    );

    return NextResponse.json({ success: true, message: 'Admission deleted successfully' });
  } catch (err: unknown) {
    console.error('Online Admission DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Keep toStr in scope (used above)
void toStr;
