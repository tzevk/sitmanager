#!/usr/bin/env node
/**
 * Backfill online_admission_payload from legacy inquiry/student data.
 *
 * Usage:
 *   node scripts/db/backfill-online-admission-payload.mjs
 *   node scripts/db/backfill-online-admission-payload.mjs --since 2026-01-01
 *   node scripts/db/backfill-online-admission-payload.mjs --dry-run
 *   node scripts/db/backfill-online-admission-payload.mjs --force
 */

import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const args = process.argv.slice(2);
const sinceIdx = args.indexOf('--since');
const sinceArg = sinceIdx !== -1 ? args[sinceIdx + 1] : null;
const SINCE_DATE = (sinceArg && !sinceArg.startsWith('--')) ? sinceArg : '2000-01-01';
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const BATCH_SIZE = 250;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function normalizeDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  if (!text || text.startsWith('0000-')) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text.slice(0, 10);
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(text)) {
    const [day, month, year] = text.split(/[-/]/);
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function normalizeText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function buildFullName(firstName, middleName, lastName, fallbackName) {
  const derived = [firstName, middleName, lastName].map(normalizeText).filter(Boolean).join(' ');
  return derived || normalizeText(fallbackName);
}

async function resolveTableName(pool, target, preferredExact) {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = ?
     ORDER BY CASE WHEN TABLE_NAME = ? THEN 0 ELSE 1 END
     LIMIT 1`,
    [target.toLowerCase(), preferredExact],
  );
  const tableName = String(rows[0]?.TABLE_NAME || '').trim();
  if (!tableName) throw new Error(`Table not found: ${target}`);
  return tableName;
}

async function getColumnSet(pool, table) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  return new Set(rows.map((row) => String(row.COLUMN_NAME).toLowerCase()));
}

function columnExpr(columnSet, alias, columnName, fallbackSql = 'NULL') {
  return columnSet.has(columnName.toLowerCase()) ? `${alias}.\`${columnName}\`` : fallbackSql;
}

async function ensurePayloadTable(pool) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS online_admission_payload (
      Inquiry_Id INT NOT NULL PRIMARY KEY,
      Payload LONGTEXT NULL,
      Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

function buildPayload(row, existingPayload) {
  const merged = existingPayload && typeof existingPayload === 'object' ? { ...existingPayload } : {};
  const firstName = normalizeText(merged.firstName || row.FName);
  const middleName = normalizeText(merged.middleName || row.MName);
  const lastName = normalizeText(merged.lastName || row.LName);
  const fullName = buildFullName(firstName, middleName, lastName, row.Student_Name);

  return {
    ...merged,
    firstName,
    middleName,
    lastName,
    shortName: normalizeText(merged.shortName),
    fullName,
    dob: merged.dob || normalizeDate(row.DOB),
    gender: normalizeText(merged.gender || row.Sex),
    nationality: normalizeText(merged.nationality || row.Nationality || 'Indian'),
    email: normalizeText(merged.email || row.Email),
    mobile: normalizeText(merged.mobile || row.Present_Mobile),
    telephone: normalizeText(merged.telephone || row.Present_Mobile2),
    familyContact: normalizeText(merged.familyContact),
    presentAddress: normalizeText(merged.presentAddress || row.Present_Address),
    presentStreet: normalizeText(merged.presentStreet || row.Present_Address),
    presentCity: normalizeText(merged.presentCity || row.Present_City),
    presentState: normalizeText(merged.presentState || row.Present_State),
    presentPin: normalizeText(merged.presentPin || row.Present_Pin),
    presentCountry: normalizeText(merged.presentCountry || row.Present_Country || 'India'),
    permanentAddress: normalizeText(merged.permanentAddress || row.Permanent_Address),
    permanentStreet: normalizeText(merged.permanentStreet || row.Permanent_Address),
    permanentCity: normalizeText(merged.permanentCity || row.Permanent_City),
    permanentState: normalizeText(merged.permanentState || row.Permanent_State),
    permanentPin: normalizeText(merged.permanentPin || row.Permanent_Pin),
    permanentCountry: normalizeText(merged.permanentCountry || row.Permanent_Country || 'India'),
    sameAsPresent: Boolean(merged.sameAsPresent),
    qualification: normalizeText(merged.qualification || row.Qualification),
    discipline: normalizeText(merged.discipline || row.Discipline),
    percentage: normalizeText(merged.percentage || row.Percentage),
    educationRemark: normalizeText(merged.educationRemark),
    occupationalStatus: normalizeText(merged.occupationalStatus || row.OccupationalStatus),
    jobOrganisation: normalizeText(merged.jobOrganisation || row.Organisation),
    jobDesignation: normalizeText(merged.jobDesignation || row.Designation),
    jobDescription: normalizeText(merged.jobDescription || row.JobDescription),
    totalOccupationYears: normalizeText(merged.totalOccupationYears || row.TotalExperience),
    workingFromYears: normalizeText(merged.workingFromYears || normalizeDate(row.WorkingSince).slice(0, 4)),
    workingFromMonths: normalizeText(merged.workingFromMonths),
    selfEmploymentDetails: normalizeText(merged.selfEmploymentDetails),
    trainingProgrammeId: normalizeText(merged.trainingProgrammeId || row.Course_Id),
    trainingProgrammeName: normalizeText(merged.trainingProgrammeName || row.Course_Name),
    trainingCategory: normalizeText(merged.trainingCategory || row.Batch_Category),
    batchCode: normalizeText(merged.batchCode || row.Batch_Code),
    modeOfPayment: normalizeText(merged.modeOfPayment || row.Payment_Type),
    idProofType: normalizeText(merged.idProofType),
    termsAgreed: Boolean(merged.termsAgreed),
    consentAcknowledged: Boolean(merged.consentAcknowledged),
    experiencedConsentAcknowledged: Boolean(merged.experiencedConsentAcknowledged),
    consentChecks: Array.isArray(merged.consentChecks) ? merged.consentChecks : [],
    consentData: merged.consentData || { eligibility: '', qualification: '', candidateRemark: '' },
  };
}

async function main() {
  console.log('=== Backfill online_admission_payload from legacy DB ===');
  console.log(`  Since : ${SINCE_DATE}`);
  console.log(`  Dry   : ${DRY_RUN}`);
  console.log(`  Force : ${FORCE}`);

  const oldPool = await mysql.createPool({
    host: requireEnv('OLD_DB_HOST'),
    port: Number(process.env.OLD_DB_PORT ?? 3306),
    user: requireEnv('OLD_DB_USER'),
    password: requireEnv('OLD_DB_PASSWORD'),
    database: requireEnv('OLD_DB_NAME'),
    waitForConnections: true,
    connectionLimit: 4,
    dateStrings: true,
  });

  const newPool = await mysql.createPool({
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 3306),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    waitForConnections: true,
    connectionLimit: 4,
    dateStrings: true,
  });

  try {
    await ensurePayloadTable(newPool);

    const oldInquiryTable = await resolveTableName(oldPool, 'student_inquiry', 'Student_Inquiry');
    const oldStudentTable = await resolveTableName(oldPool, 'student_master', 'Student_Master');
    const oldAdmissionTable = await resolveTableName(oldPool, 'admission_master', 'Admission_master');
    const oldCourseTable = await resolveTableName(oldPool, 'course_mst', 'Course_Mst');
    const oldBatchTable = await resolveTableName(oldPool, 'batch_mst', 'Batch_Mst');
    const newInquiryTable = await resolveTableName(newPool, 'student_inquiry', 'Student_Inquiry');

    const [inquiryColumns, studentColumns, admissionColumns, batchColumns] = await Promise.all([
      getColumnSet(oldPool, oldInquiryTable),
      getColumnSet(oldPool, oldStudentTable),
      getColumnSet(oldPool, oldAdmissionTable),
      getColumnSet(oldPool, oldBatchTable),
    ]);

    const inquiryAdmissionDone = columnExpr(inquiryColumns, 'si', 'admission_done', '0');
    const inquiryAdmissionFlag = columnExpr(inquiryColumns, 'si', 'Admission', "''");
    const studentAdmissionFlag = columnExpr(studentColumns, 'sm', 'Admission', "''");
    const studentStatusId = columnExpr(studentColumns, 'sm', 'Status_id', '0');
    const studentPresentMobile2 = columnExpr(studentColumns, 'sm', 'Present_Mobile2', "''");
    const studentOccupationalStatus = columnExpr(studentColumns, 'sm', 'OccupationalStatus', "''");
    const studentOrganisation = columnExpr(studentColumns, 'sm', 'Organisation', "''");
    const studentDesignation = columnExpr(studentColumns, 'sm', 'Designation', "''");
    const studentJobDescription = columnExpr(studentColumns, 'sm', 'JobDescription', "''");
    const studentTotalExperience = columnExpr(studentColumns, 'sm', 'TotalExperience', "''");
    const studentWorkingSince = columnExpr(studentColumns, 'sm', 'WorkingSince');
    const studentDiscipline = columnExpr(studentColumns, 'sm', 'Discipline', columnExpr(inquiryColumns, 'si', 'Discipline', "''"));
    const studentPercentage = columnExpr(studentColumns, 'sm', 'Percentage', "''");
    const studentCourseId = columnExpr(studentColumns, 'sm', 'Course_Id', columnExpr(inquiryColumns, 'si', 'Course_Id', '0'));
    const studentBatchCode = columnExpr(studentColumns, 'sm', 'Batch_Code', columnExpr(inquiryColumns, 'si', 'Batch_Code', "''"));
    const admissionPaymentType = columnExpr(admissionColumns, 'am', 'Payment_Type', "''");
    const admissionDate = columnExpr(admissionColumns, 'am', 'Admission_Date');
    const batchCategory = columnExpr(batchColumns, 'bm', 'Category', "''");

    const [legacyRows] = await oldPool.query(
      `SELECT
         si.Inquiry_Id,
         si.Student_Id,
         COALESCE(sm.FName, '') AS FName,
         COALESCE(sm.MName, '') AS MName,
         COALESCE(sm.LName, '') AS LName,
         COALESCE(sm.Student_Name, si.Student_Name, '') AS Student_Name,
         COALESCE(sm.Email, si.Email, '') AS Email,
         COALESCE(sm.Present_Mobile, si.Present_Mobile, '') AS Present_Mobile,
         COALESCE(${studentPresentMobile2}, si.Present_Mobile2, '') AS Present_Mobile2,
         COALESCE(sm.Sex, si.Sex, '') AS Sex,
         COALESCE(sm.DOB, si.DOB) AS DOB,
         COALESCE(sm.Nationality, si.Nationality, 'Indian') AS Nationality,
         COALESCE(sm.Present_Address, '') AS Present_Address,
         COALESCE(sm.Present_City, '') AS Present_City,
         COALESCE(sm.Present_State, '') AS Present_State,
         COALESCE(sm.Present_Pin, '') AS Present_Pin,
         COALESCE(sm.Present_Country, 'India') AS Present_Country,
         COALESCE(sm.Permanent_Address, '') AS Permanent_Address,
         COALESCE(sm.Permanent_City, '') AS Permanent_City,
         COALESCE(sm.Permanent_State, '') AS Permanent_State,
         COALESCE(sm.Permanent_Pin, '') AS Permanent_Pin,
         COALESCE(sm.Permanent_Country, 'India') AS Permanent_Country,
         COALESCE(sm.Qualification, si.Qualification, '') AS Qualification,
         COALESCE(${studentDiscipline}, '') AS Discipline,
         COALESCE(${studentPercentage}, '') AS Percentage,
         COALESCE(${studentCourseId}, 0) AS Course_Id,
         COALESCE(${studentBatchCode}, '') AS Batch_Code,
         COALESCE(${studentOccupationalStatus}, '') AS OccupationalStatus,
         COALESCE(${studentOrganisation}, '') AS Organisation,
         COALESCE(${studentDesignation}, '') AS Designation,
         COALESCE(${studentJobDescription}, '') AS JobDescription,
         COALESCE(${studentTotalExperience}, '') AS TotalExperience,
         ${studentWorkingSince} AS WorkingSince,
         COALESCE(${admissionPaymentType}, '') AS Payment_Type,
         COALESCE(cm.Course_Name, '') AS Course_Name,
         COALESCE(${batchCategory}, '') AS Batch_Category,
         COALESCE(si.Inquiry_Dt, sm.Admission_Dt, ${admissionDate}) AS SortDate
       FROM \`${oldInquiryTable}\` si
       LEFT JOIN \`${oldStudentTable}\` sm
         ON sm.Student_Id = si.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
       LEFT JOIN \`${oldAdmissionTable}\` am
         ON am.Admission_Id = (
           SELECT am2.Admission_Id
           FROM \`${oldAdmissionTable}\` am2
           WHERE am2.Student_Id = si.Student_Id
             AND (am2.IsDelete = 0 OR am2.IsDelete IS NULL)
           ORDER BY am2.Admission_Date DESC, am2.Admission_Id DESC
           LIMIT 1
         )
       LEFT JOIN \`${oldCourseTable}\` cm ON cm.Course_Id = COALESCE(${studentCourseId}, 0)
       LEFT JOIN \`${oldBatchTable}\` bm ON bm.Batch_code = COALESCE(${studentBatchCode}, '')
       WHERE (si.IsDelete = 0 OR si.IsDelete IS NULL)
         AND COALESCE(
           STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 19), '%Y-%m-%d %H:%i:%s'),
           STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 10), '%Y-%m-%d'),
           STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 10), '%d-%m-%Y'),
           STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 10), '%d/%m/%Y'),
           sm.Admission_Dt,
           ${admissionDate},
           DATE('1970-01-01')
         ) >= ?
         AND (
           si.OnlineState IS NOT NULL
           OR IFNULL(${inquiryAdmissionDone}, 0) = 2
           OR LOWER(TRIM(CAST(COALESCE(${inquiryAdmissionFlag}, '') AS CHAR))) IN ('yes', 'y', '1', 'true')
           OR LOWER(TRIM(CAST(COALESCE(${studentAdmissionFlag}, '') AS CHAR))) IN ('yes', 'y', '1', 'true')
           OR ${studentStatusId} = 8
         )
       ORDER BY si.Inquiry_Id ASC`,
      [SINCE_DATE],
    );

    console.log(`  Legacy candidates: ${legacyRows.length}`);
    if (!legacyRows.length) {
      console.log('  Nothing to backfill.');
      return;
    }

    let matched = 0;
    let skippedMissingInquiry = 0;
    let skippedExistingPayload = 0;
    let written = 0;

    for (let i = 0; i < legacyRows.length; i += BATCH_SIZE) {
      const chunk = legacyRows.slice(i, i + BATCH_SIZE);
      const inquiryIds = chunk.map((row) => Number(row.Inquiry_Id)).filter(Number.isFinite);
      if (!inquiryIds.length) continue;

      const placeholders = inquiryIds.map(() => '?').join(',');
      const [newInquiryRows] = await newPool.query(
        `SELECT Inquiry_Id FROM \`${newInquiryTable}\` WHERE Inquiry_Id IN (${placeholders})`,
        inquiryIds,
      );
      const newInquirySet = new Set(newInquiryRows.map((row) => Number(row.Inquiry_Id)));

      const [existingPayloadRows] = await newPool.query(
        `SELECT Inquiry_Id, Payload FROM online_admission_payload WHERE Inquiry_Id IN (${placeholders})`,
        inquiryIds,
      );
      const existingPayloadByInquiryId = new Map(
        existingPayloadRows.map((row) => {
          let parsed = {};
          try {
            parsed = row.Payload ? JSON.parse(String(row.Payload)) : {};
          } catch {
            parsed = {};
          }
          return [Number(row.Inquiry_Id), parsed];
        }),
      );

      const upserts = [];
      for (const row of chunk) {
        const inquiryId = Number(row.Inquiry_Id);
        if (!newInquirySet.has(inquiryId)) {
          skippedMissingInquiry += 1;
          continue;
        }
        matched += 1;
        const existingPayload = existingPayloadByInquiryId.get(inquiryId) || {};
        if (!FORCE && Object.keys(existingPayload).length > 0) {
          skippedExistingPayload += 1;
          continue;
        }

        const payload = buildPayload(row, existingPayload);
        upserts.push([inquiryId, JSON.stringify(payload)]);
      }

      if (!upserts.length) continue;
      written += upserts.length;
      if (!DRY_RUN) {
        await newPool.query(
          `INSERT INTO online_admission_payload (Inquiry_Id, Payload)
           VALUES ?
           ON DUPLICATE KEY UPDATE Payload = VALUES(Payload), Updated_At = NOW()`,
          [upserts],
        );
      }
    }

    console.log(`  Matched in new inquiry table : ${matched}`);
    console.log(`  Skipped missing inquiry      : ${skippedMissingInquiry}`);
    console.log(`  Skipped existing payload     : ${skippedExistingPayload}`);
    console.log(`  ${DRY_RUN ? 'Would write' : 'Written'} payload rows    : ${written}`);
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

main().catch((error) => {
  console.error('FATAL:', error?.message || error);
  process.exit(1);
});