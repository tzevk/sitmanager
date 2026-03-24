/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

async function ensureCorporateInquiryColumns(pool: ReturnType<typeof getPool>) {
  const wanted = [
    'Consultancy_Id',
    'CompanyAuthority',
    'TrainingMode',
    'Participants_Fresher',
    'Participants_Experienced',
    'TrainingLocation',
    'Discussion',
    'FollowUp',
    'InitialFollowUpDate',
    'NextFollowUpDate',

    'InquiryStatus',
    'TrainingNumber',
    'TrainingDate',
    'TrainerName',
    'NumberOfDays',
    'TotalStudents',
    'TrainingCoordinator',

    'ConfirmDate',
    'PerformanceEvaluation',
    'TrainingFeedback',
    'SitCertification',
  ] as const;

  const [rows] = await pool.query<any[]>(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'corporate_inquiry'
       AND COLUMN_NAME IN (${wanted.map(() => '?').join(',')})`,
    [...wanted]
  );

  const existing = new Set((rows || []).map((r: any) => String(r?.COLUMN_NAME || '')));

  const alters: string[] = [];
  if (!existing.has('Consultancy_Id')) alters.push(`ADD COLUMN Consultancy_Id INT NULL`);
  if (!existing.has('CompanyAuthority')) alters.push(`ADD COLUMN CompanyAuthority VARCHAR(255) NULL`);
  if (!existing.has('TrainingMode')) alters.push(`ADD COLUMN TrainingMode VARCHAR(20) NULL`);
  if (!existing.has('Participants_Fresher')) alters.push(`ADD COLUMN Participants_Fresher INT NULL`);
  if (!existing.has('Participants_Experienced')) alters.push(`ADD COLUMN Participants_Experienced INT NULL`);
  if (!existing.has('TrainingLocation')) alters.push(`ADD COLUMN TrainingLocation VARCHAR(255) NULL`);
  if (!existing.has('Discussion')) alters.push(`ADD COLUMN Discussion TEXT NULL`);
  if (!existing.has('FollowUp')) alters.push(`ADD COLUMN FollowUp TEXT NULL`);
  if (!existing.has('InitialFollowUpDate')) alters.push(`ADD COLUMN InitialFollowUpDate DATE NULL`);
  if (!existing.has('NextFollowUpDate')) alters.push(`ADD COLUMN NextFollowUpDate DATE NULL`);

  if (!existing.has('InquiryStatus')) alters.push(`ADD COLUMN InquiryStatus VARCHAR(20) NULL`);
  if (!existing.has('TrainingNumber')) alters.push(`ADD COLUMN TrainingNumber VARCHAR(50) NULL`);
  if (!existing.has('TrainingDate')) alters.push(`ADD COLUMN TrainingDate DATE NULL`);
  if (!existing.has('TrainerName')) alters.push(`ADD COLUMN TrainerName VARCHAR(255) NULL`);
  if (!existing.has('NumberOfDays')) alters.push(`ADD COLUMN NumberOfDays INT NULL`);
  if (!existing.has('TotalStudents')) alters.push(`ADD COLUMN TotalStudents INT NULL`);
  if (!existing.has('TrainingCoordinator')) alters.push(`ADD COLUMN TrainingCoordinator VARCHAR(255) NULL`);

  if (!existing.has('ConfirmDate')) alters.push(`ADD COLUMN ConfirmDate DATE NULL`);
  if (!existing.has('PerformanceEvaluation')) alters.push(`ADD COLUMN PerformanceEvaluation TEXT NULL`);
  if (!existing.has('TrainingFeedback')) alters.push(`ADD COLUMN TrainingFeedback TEXT NULL`);
  if (!existing.has('SitCertification')) alters.push(`ADD COLUMN SitCertification VARCHAR(3) NULL`);

  for (const alter of alters) {
    await pool.query(`ALTER TABLE corporate_inquiry ${alter}`);
  }
}

// GET - fetch single corporate inquiry by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, [
      'corporate_inquiry.view',
      'corporate_inquiry.update',
      'corporate_inquiry.create',
    ]);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const pool = getPool();

    await ensureCorporateInquiryColumns(pool);

    const [rows] = await pool.query<any[]>(
      `SELECT Id, Fname, Lname, MName, FullName, CompanyName, Designation,
              Address, City, State, Country, Pin, Phone, Mobile, Email,
              Course_Id, Place, business, Remark, Idate, IsActive,
              Consultancy_Id, CompanyAuthority, TrainingMode, Participants_Fresher, Participants_Experienced,
              TrainingLocation, Discussion, FollowUp, InitialFollowUpDate, NextFollowUpDate,
              InquiryStatus, TrainingNumber, TrainingDate, TrainerName, NumberOfDays, TotalStudents, TrainingCoordinator,
              ConfirmDate, PerformanceEvaluation, TrainingFeedback, SitCertification
       FROM corporate_inquiry 
       WHERE Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    return NextResponse.json({ inquiry: rows[0] });
  } catch (err: unknown) {
    console.error('Corporate Inquiry GET by ID error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
