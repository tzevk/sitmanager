/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';

const ONLINE_ADMISSION_PAYLOAD_TABLE = 'online_admission_payload';

let payloadTableReady = false;

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
      await pool.query(`DROP TABLE ${ONLINE_ADMISSION_PAYLOAD_TABLE}`);
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
    const rateLimited = apiRateLimiter(req);
    if (rateLimited) return rateLimited;

    const auth = await requirePermission(req, 'online_admission.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { id } = await params;
    const inquiryId = Number(id);

    // Load inquiry record
    const [siRows] = await pool.query(
      `SELECT
         si.Inquiry_Id,
         si.Student_Name,
         COALESCE(si.Email, '') as Email,
         COALESCE(si.Present_Mobile, '') as Present_Mobile,
         COALESCE(si.Present_Mobile2, '') as Present_Mobile2,
         si.Sex,
         si.DOB,
         COALESCE(si.Nationality, 'Indian') as Nationality,
         si.OnlineState as Status_id,
         COALESCE(stm.Status, '') as StatusText,
         COALESCE(si.Batch_Code, '') as Batch_Code,
         COALESCE(si.Course_Id, 0) as Course_Id,
         COALESCE(si.Qualification, '') as Qualification,
         COALESCE(si.Discipline, '') as Discipline
       FROM Student_Inquiry si
       LEFT JOIN Status_Master stm ON stm.Id = si.OnlineState
       WHERE si.Inquiry_Id = ? AND (si.IsDelete = 0 OR si.IsDelete IS NULL)`,
      [inquiryId]
    ) as [any[], any];

    if (!(siRows as any[]).length) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    const si = (siRows as any[])[0];
    const payload = await getPayload(pool, inquiryId);

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

    // Parse name parts from payload first, then fall back to inquiry name
    const nameParts = String(si.Student_Name || '').split(' ');
    const firstName  = payload.firstName  || nameParts[0] || '';
    const lastName   = payload.lastName   || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '') || '';
    const middleName = payload.middleName || (nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '') || '';

    return NextResponse.json({
      // metadata
      inquiryId:      si.Inquiry_Id,
      admissionId:    si.Inquiry_Id, // kept for edit page compat
      studentId:      si.Inquiry_Id, // kept for edit page compat
      statusId:       rawStatusId || null,
      statusLabel,
      statusCategory,

      // personal — payload wins, inquiry is fallback
      firstName,
      middleName,
      lastName,
      shortName:      payload.shortName  || '',
      dob:            payload.dob        || (si.DOB ? String(si.DOB).slice(0, 10) : ''),
      gender:         payload.gender     || si.Sex || '',
      nationality:    payload.nationality || si.Nationality || 'Indian',

      // contact
      email:          payload.email     || si.Email || '',
      mobile:         payload.mobile    || si.Present_Mobile || '',
      telephone:      payload.telephone || si.Present_Mobile2 || '',
      familyContact:  payload.familyContact || '',

      // address
      presentFlat:        payload.presentFlat        || '',
      presentBuilding:    payload.presentBuilding    || '',
      presentStreet:      payload.presentStreet      || '',
      presentArea:        payload.presentArea        || '',
      presentLandmark:    payload.presentLandmark    || '',
      presentAddress:     payload.presentAddress     || '',
      presentCity:        payload.presentCity        || '',
      presentPin:         payload.presentPin         || '',
      presentState:       payload.presentState       || '',
      presentDistrict:    payload.presentDistrict    || '',
      presentCountry:     payload.presentCountry     || 'India',
      permanentFlat:      payload.permanentFlat      || '',
      permanentBuilding:  payload.permanentBuilding  || '',
      permanentStreet:    payload.permanentStreet    || '',
      permanentArea:      payload.permanentArea      || '',
      permanentLandmark:  payload.permanentLandmark  || '',
      permanentAddress:   payload.permanentAddress   || '',
      permanentCity:      payload.permanentCity      || '',
      permanentPin:       payload.permanentPin       || '',
      permanentState:     payload.permanentState     || '',
      permanentDistrict:  payload.permanentDistrict  || '',
      permanentCountry:   payload.permanentCountry   || 'India',
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

      // occupational
      occupationalStatus:    payload.occupationalStatus    || '',
      jobOrganisation:       payload.jobOrganisation       || '',
      jobDesignation:        payload.jobDesignation        || '',
      totalOccupationYears:  payload.totalOccupationYears  || '',
      jobDescription:        payload.jobDescription        || '',
      workingFromYears:      payload.workingFromYears      || '',
      workingFromMonths:     payload.workingFromMonths     || '',
      selfEmploymentDetails: payload.selfEmploymentDetails || '',

      // training
      trainingProgrammeId:   resolvedTrainingProgrammeId,
      trainingProgrammeName: payload.trainingProgrammeName || '',
      trainingCategory:      payload.trainingCategory      || '',
      batchCode:             payload.batchCode || si.Batch_Code || '',

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

    // Verify inquiry exists
    const [siRows] = await pool.query(
      `SELECT Inquiry_Id FROM Student_Inquiry WHERE Inquiry_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
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

    // Update Student_Inquiry
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
        `UPDATE Student_Inquiry SET ${setClauses.join(', ')} WHERE Inquiry_Id = ?`,
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

    await ensurePayloadTable(pool);

    // Remove the payload record (the inquiry itself stays intact)
    await pool.query(
      `DELETE FROM ${ONLINE_ADMISSION_PAYLOAD_TABLE} WHERE Inquiry_Id = ?`,
      [inquiryId]
    );

    // Reset inquiry status back to its prior state (undo the "Document Pending" flag)
    await pool.query(
      `UPDATE Student_Inquiry SET OnlineState = 1 WHERE Inquiry_Id = ? AND OnlineState IN (23, 8, 7)`,
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
