/**
 * One-off test: create a fake "pending" online admission with a fully filled
 * form, then run the exact grant ("accept") logic from
 * app/api/online-admission/[id]/route.ts PUT handler + the real
 * syncOnlineAdmissionIntoCurrentDb(), and verify nothing gets wiped.
 *
 * Cleans up all test rows at the end (even on failure).
 */
import { getPool } from '@/lib/db';
import { syncOnlineAdmissionIntoCurrentDb } from '@/lib/services/online-admission.service';

const PAYLOAD_TABLE = 'online_admission_payload';
const MARKER = 'TEST_GRANT_WIPE_CHECK';

async function getPayload(pool: any, inquiryId: number): Promise<Record<string, any>> {
  const [rows] = await pool.query(
    `SELECT Payload FROM ${PAYLOAD_TABLE} WHERE Inquiry_Id = ? LIMIT 1`,
    [inquiryId]
  ) as [any[], any];
  const text = rows?.[0]?.Payload;
  if (!text) return {};
  return JSON.parse(String(text));
}

async function savePayload(pool: any, inquiryId: number, body: any) {
  await pool.query(
    `INSERT INTO ${PAYLOAD_TABLE} (Inquiry_Id, Payload)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE Payload = VALUES(Payload), Updated_At = NOW()`,
    [inquiryId, JSON.stringify(body)]
  );
}

const richPayload = {
  firstName: 'Test',
  middleName: 'Q',
  lastName: 'Wipecheck',
  email: 'test.wipecheck@example.com',
  mobile: '9999999999',
  dob: '2000-01-01',
  gender: 'Male',
  nationality: 'Indian',
  presentAddress1: '123 Test Street',
  presentCity: 'Pune',
  presentState: 'Maharashtra',
  presentPin: '411001',
  presentCountry: 'India',
  qualification: 'BE',
  discipline: 'Mechanical',
  percentage: '75',
  trainingProgrammeId: '1',
  trainingProgrammeName: 'AutoCAD',
  trainingCategory: 'Regular',
  modeOfPayment: 'Online',
  ssc_ktDetails: [{ subject: 'Maths', attempts: 2 }],
};

async function main() {
  const pool = getPool();

  // 1. Insert a fake pending inquiry
  const [insRes] = await pool.query(
    `INSERT INTO student_inquiry (Student_Name, Email, Present_Mobile, OnlineState, IsDelete, IsActive)
     VALUES (?, ?, ?, '23', 0, 1)`,
    [MARKER, richPayload.email, richPayload.mobile]
  ) as [any, any];
  const inquiryId = insRes.insertId as number;
  console.log('Created test inquiry Id =', inquiryId);

  try {
    // 2. Insert the rich payload (simulating a fully-filled-out online form)
    await savePayload(pool, inquiryId, richPayload);
    console.log('Saved rich payload with', Object.keys(richPayload).length, 'fields');

    // 3. Simulate the PUT handler for a grant action: body = { statusAction: 'accept' }
    const body: Record<string, any> = { statusAction: 'accept' };
    const existingPayload = await getPayload(pool, inquiryId);
    const isStatusOnlyAction = body.statusAction === 'accept' || body.statusAction === 'reject';

    let cleanBody: Record<string, any>;
    if (isStatusOnlyAction) {
      cleanBody = { ...existingPayload };
      cleanBody.statusAction = body.statusAction;
      const safeMergeFields = ['firstName', 'middleName', 'lastName', 'email', 'mobile',
        'dob', 'gender', 'batchCode', 'trainingProgrammeId', 'trainingProgrammeName',
        'trainingCategory', 'modeOfPayment'] as const;
      for (const field of safeMergeFields) {
        const incoming = body[field];
        if (incoming != null && String(incoming).trim() !== '') {
          cleanBody[field] = incoming;
        }
      }
    } else {
      cleanBody = { ...existingPayload, ...body };
    }

    const metaKeys = new Set(['statusAction', 'payAtOfficeAudit', '__draftProgress']);
    const countFields = (obj: Record<string, any>) =>
      Object.entries(obj).filter(([k, v]) =>
        !metaKeys.has(k) && v != null && String(v).trim() !== '' && !Array.isArray(v)
      ).length;
    const existingCount = countFields(existingPayload);
    const newCount = countFields(cleanBody);
    console.log('existingCount =', existingCount, 'newCount =', newCount);

    if (newCount >= existingCount || !isStatusOnlyAction) {
      await savePayload(pool, inquiryId, cleanBody);
    } else {
      const safePayload = { ...existingPayload, statusAction: cleanBody.statusAction };
      await savePayload(pool, inquiryId, safePayload);
    }

    // 4. Run the real sync function (writes to student_inquiry + student_master)
    await syncOnlineAdmissionIntoCurrentDb(inquiryId, cleanBody, { statusAction: 'accept' });

    // 5. Verify
    const finalPayload = await getPayload(pool, inquiryId);
    console.log('\nFinal payload after grant:');
    console.log(JSON.stringify(finalPayload, null, 2));

    const [inqRows] = await pool.query(
      `SELECT Inquiry_Id, Student_Id, OnlineState, Student_Name, Email, Present_Mobile FROM student_inquiry WHERE Inquiry_Id = ?`,
      [inquiryId]
    ) as [any[], any];
    console.log('\nstudent_inquiry row:', inqRows[0]);

    let studentMasterRow: any = null;
    const studentIdRaw = inqRows[0]?.Student_Id;
    if (studentIdRaw) {
      const [smRows] = await pool.query(
        `SELECT Student_Id, Student_Name, FName, LName, Email, Present_Mobile, DOB, Sex, Qualification, Discipline, Percentage, Status_id, Status_date FROM student_master WHERE Student_Id = ?`,
        [studentIdRaw]
      ) as [any[], any];
      studentMasterRow = smRows[0];
    }
    console.log('\nstudent_master row:', studentMasterRow);

    // 6. Assertions
    const errors: string[] = [];
    for (const key of Object.keys(richPayload)) {
      if (finalPayload[key] === undefined) errors.push(`payload lost field "${key}"`);
    }
    if (inqRows[0]?.OnlineState !== '8') errors.push(`OnlineState expected '8' (Admitted), got ${inqRows[0]?.OnlineState}`);
    if (!studentMasterRow) errors.push('student_master row was not created');

    console.log('\n=== RESULT ===');
    if (errors.length) {
      console.log('FAIL:');
      for (const e of errors) console.log(' -', e);
    } else {
      console.log('PASS: payload preserved, status updated to Admitted, student_master created.');
    }

    // Clean up student_master row too
    if (studentMasterRow) {
      await pool.query(`DELETE FROM student_master WHERE Student_Id = ?`, [studentMasterRow.Student_Id]);
      console.log('Cleaned up student_master row', studentMasterRow.Student_Id);
    }
  } finally {
    await pool.query(`DELETE FROM ${PAYLOAD_TABLE} WHERE Inquiry_Id = ?`, [inquiryId]);
    await pool.query(`DELETE FROM student_inquiry WHERE Inquiry_Id = ?`, [inquiryId]);
    console.log('Cleaned up test inquiry', inquiryId);
    await pool.end();
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
