#!/usr/bin/env node
/**
 * Project current online admission payload data into student_master/admission_master.
 *
 * Usage:
 *   node scripts/db/sync-online-admission-to-student-master.mjs --dry-run
 *   node scripts/db/sync-online-admission-to-student-master.mjs
 *   node scripts/db/sync-online-admission-to-student-master.mjs --inquiry 12345
 */

import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const inquiryIdx = args.indexOf('--inquiry');
const inquiryArg = inquiryIdx !== -1 ? Number(args[inquiryIdx + 1]) : null;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function normalizeText(value) {
  return value == null ? '' : String(value).trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return '';
}

function parseOptionalNumber(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildAddress(payload, prefix) {
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

function resolveAcademicProfile(payload) {
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
      return {
        qualification: normalizeText(qualification) || null,
        discipline: normalizeText(discipline) || null,
        percentage: parseOptionalNumber(percentage),
      };
    }
  }
  return { qualification: null, discipline: null, percentage: null };
}

function resolveWorkingSince(payload) {
  const explicit = normalizeText(payload.WorkingSince);
  if (explicit) return explicit;
  const year = normalizeText(payload.workingFromYears);
  if (!/^\d{4}$/.test(year)) return null;
  const month = normalizeText(payload.workingFromMonths);
  const parsed = parseOptionalNumber(month);
  const padded = parsed && parsed >= 1 && parsed <= 12 ? String(parsed).padStart(2, '0') : '01';
  return `${year}-${padded}-01`;
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

async function resolveBatchCategoryId(pool, batchCode, categoryValue) {
  const numericCategoryId = parseOptionalNumber(categoryValue);
  if (numericCategoryId !== null) return numericCategoryId;
  if (!batchCode && !categoryValue) return null;

  const conditions = ['(IsDelete = 0 OR IsDelete IS NULL)'];
  const params = [];
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
  );
  return rows[0]?.Batch_Category_id != null ? Number(rows[0].Batch_Category_id) : null;
}

async function main() {
  const pool = await mysql.createPool({
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
    const inquiryTable = await resolveTableName(pool, 'student_inquiry', 'Student_Inquiry');
    const studentTable = await resolveTableName(pool, 'student_master', 'student_master');

    const inquiryFilterSql = Number.isFinite(inquiryArg) ? 'AND si.Inquiry_Id = ?' : '';
    const [rows] = await pool.query(
      `SELECT
         oap.Inquiry_Id,
         oap.Payload,
         si.Student_Id,
         si.Student_Name,
         si.Email,
         si.Present_Mobile,
         si.Batch_Code,
         si.Course_Id,
         si.OnlineState,
         sm.Student_Id AS Existing_Student_Id
       FROM online_admission_payload oap
       JOIN \`${inquiryTable}\` si ON si.Inquiry_Id = oap.Inquiry_Id AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
       LEFT JOIN \`${studentTable}\` sm ON sm.Student_Id = si.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
       WHERE si.Student_Id IS NOT NULL ${inquiryFilterSql}
       ORDER BY oap.Inquiry_Id ASC`,
      Number.isFinite(inquiryArg) ? [inquiryArg] : []
    );

    let parsedPayloads = 0;
    let updatedStudents = 0;
    let acceptedAdmissions = 0;

    for (const row of rows) {
      const studentId = Number(row.Student_Id || 0);
      if (!studentId) continue;

      let payload = {};
      try {
        payload = row.Payload ? JSON.parse(String(row.Payload)) : {};
      } catch {
        continue;
      }
      parsedPayloads += 1;

      const academic = resolveAcademicProfile(payload);
      const batchCode = firstNonEmpty(payload.batchCode, row.Batch_Code) || null;
      const batchCategoryId = await resolveBatchCategoryId(pool, batchCode, normalizeText(payload.trainingCategory) || null);
      const courseId = parseOptionalNumber(payload.trainingProgrammeId) ?? parseOptionalNumber(row.Course_Id);
      const fullName = firstNonEmpty(
        [payload.firstName, payload.middleName, payload.lastName].map(normalizeText).filter(Boolean).join(' '),
        payload.fullName,
        row.Student_Name,
      ) || null;

      if (!DRY_RUN) {
        await pool.query(
          `UPDATE \`${studentTable}\` SET
             Student_Name = COALESCE(?, Student_Name),
             FName = COALESCE(?, FName),
             MName = COALESCE(?, MName),
             LName = COALESCE(?, LName),
             DOB = COALESCE(?, DOB),
             Sex = COALESCE(?, Sex),
             Nationality = COALESCE(?, Nationality),
             Email = COALESCE(?, Email),
             Present_Mobile = COALESCE(?, Present_Mobile),
             Present_Mobile2 = COALESCE(?, Present_Mobile2),
             Present_Address = COALESCE(?, Present_Address),
             Present_City = COALESCE(?, Present_City),
             Present_State = COALESCE(?, Present_State),
             Present_Pin = COALESCE(?, Present_Pin),
             Present_Country = COALESCE(?, Present_Country),
             Permanent_Address = COALESCE(?, Permanent_Address),
             Permanent_City = COALESCE(?, Permanent_City),
             Permanent_State = COALESCE(?, Permanent_State),
             Permanent_Pin = COALESCE(?, Permanent_Pin),
             Permanent_Country = COALESCE(?, Permanent_Country),
             Qualification = COALESCE(?, Qualification),
             Discipline = COALESCE(?, Discipline),
             Percentage = COALESCE(?, Percentage),
             Course_Id = COALESCE(?, Course_Id),
             Batch_Code = COALESCE(?, Batch_Code),
             Batch_Category_id = COALESCE(?, Batch_Category_id),
             Company = COALESCE(?, Company),
             Designation = COALESCE(?, Designation),
             Occupation = COALESCE(?, Occupation),
             Total_Exp = COALESCE(?, Total_Exp),
             Remark = COALESCE(?, Remark),
             Status_id = COALESCE(?, Status_id),
             Admission_Dt = COALESCE(?, Admission_Dt)
           WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
          [
            fullName,
            normalizeText(payload.firstName) || null,
            normalizeText(payload.middleName) || null,
            normalizeText(payload.lastName) || null,
            normalizeText(payload.dob) || null,
            normalizeText(payload.gender) || null,
            normalizeText(payload.nationality) || null,
            firstNonEmpty(payload.email, row.Email) || null,
            firstNonEmpty(payload.mobile, row.Present_Mobile) || null,
            normalizeText(payload.telephone) || null,
            buildAddress(payload, 'present') || null,
            normalizeText(payload.presentCity) || null,
            normalizeText(payload.presentState) || null,
            normalizeText(payload.presentPin) || null,
            normalizeText(payload.presentCountry) || null,
            buildAddress(payload, 'permanent') || null,
            normalizeText(payload.permanentCity) || null,
            normalizeText(payload.permanentState) || null,
            normalizeText(payload.permanentPin) || null,
            normalizeText(payload.permanentCountry) || null,
            academic.qualification,
            academic.discipline,
            academic.percentage,
            courseId,
            batchCode,
            batchCategoryId,
            normalizeText(payload.jobOrganisation) || null,
            normalizeText(payload.jobDesignation) || null,
            normalizeText(payload.occupationalStatus) || null,
            parseOptionalNumber(payload.totalOccupationYears),
            normalizeText(payload.jobDescription) || null,
            Number(row.OnlineState || 0) === 8 ? 8 : null,
            Number(row.OnlineState || 0) === 8 ? new Date().toISOString().slice(0, 10) : null,
            studentId,
          ]
        );
      }
      updatedStudents += 1;

      if (Number(row.OnlineState || 0) === 8) {
        acceptedAdmissions += 1;

        if (!DRY_RUN) {
          let batchId = null;
          if (batchCode) {
            const [batchRows] = await pool.query(
              `SELECT Batch_Id FROM batch_mst WHERE Batch_code = ? AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1`,
              [batchCode]
            );
            batchId = batchRows[0]?.Batch_Id ?? null;
          }

          const [existingAdmissions] = await pool.query(
            `SELECT Admission_Id FROM admission_master
             WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
             ORDER BY Admission_Date DESC, Admission_Id DESC LIMIT 1`,
            [studentId]
          );

          if (existingAdmissions.length) {
            await pool.query(
              `UPDATE admission_master SET
                 Batch_Id = COALESCE(?, Batch_Id),
                 Course_Id = COALESCE(?, Course_Id),
                 Admission_Date = COALESCE(?, Admission_Date),
                 IsActive = 1,
                 Cancel = 0
               WHERE Admission_Id = ?`,
              [batchId, courseId, normalizeText(payload.admissionDate) || new Date().toISOString().slice(0, 10), existingAdmissions[0].Admission_Id]
            );
          } else {
            await pool.query(
              `INSERT INTO admission_master (
                 Student_Id, Course_Id, Batch_Id, Admission_Date, IsActive, Cancel, IsDelete
               ) VALUES (?, ?, ?, ?, 1, 0, 0)`,
              [studentId, courseId, batchId, normalizeText(payload.admissionDate) || new Date().toISOString().slice(0, 10)]
            );
          }
        }
      }
    }

    console.log('=== Sync online admission to student master ===');
    console.log(`Dry run              : ${DRY_RUN}`);
    console.log(`Payload rows parsed   : ${parsedPayloads}`);
    console.log(`Student rows ${DRY_RUN ? 'to sync' : 'synced'} : ${updatedStudents}`);
    console.log(`Accepted admissions   : ${acceptedAdmissions}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('FATAL:', error?.message || error);
  process.exit(1);
});