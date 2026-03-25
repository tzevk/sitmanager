import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) dotenv.config({ path: p });
  }
}

function getRequiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function parseArgs(argv) {
  const out = {
    dryRun: false,
    limit: 0,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--limit' && argv[i + 1]) out.limit = Math.max(0, Number(argv[++i]) || 0);
    else if (a === '--help' || a === '-h') {
      console.log(
        [
          'Usage:',
          '  node scripts/db/sync-ct-training-enquires-to-corporate-inquiry.mjs [--dry-run] [--limit N]',
          '',
          'Reads from: ct_training_enquires',
          'Writes into: corporate_inquiry',
          '',
          'Env vars (required): DB_HOST, DB_NAME, DB_USER, DB_PASSWORD',
          'Env vars (optional): DB_PORT (default 3306), DB_SSL (true/false)',
        ].join('\n')
      );
      process.exit(0);
    }
  }

  return out;
}

function normalizeStatus(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (s.includes('discussion')) return 'UnderDiscussion';
  if (s.includes('reject') || s.includes('regret') || s.includes('not interested')) return 'Rejected';
  if (s.includes('final') || s.includes('confirmed') || s.includes('confirm')) return 'Final';
  return null;
}

function toDateOnly(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // If mysql2 returns DATE as 'YYYY-MM-DD', keep it.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try ISO.
  const iso = s.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return null;
}

async function getTableColumns(pool, tableName) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return new Set((rows || []).map((r) => String(r?.COLUMN_NAME || '')));
}

function pickFirstExistingColumn(cols, candidates) {
  for (const c of candidates) {
    if (cols.has(c)) return c;
  }
  return null;
}

function pickFirstMatchingRegex(cols, regexes) {
  const arr = Array.from(cols);
  for (const rx of regexes) {
    const hit = arr.find((c) => rx.test(c));
    if (hit) return hit;
  }
  return null;
}

async function ensureCorporateInquiryColumns(pool) {
  const wanted = [
    'CtTrainingEnquiryId',
    'InquiryStatus',
    'TrainingNumber',
    'TrainingDate',
    'TrainerName',
    'NumberOfDays',
    'TotalStudents',
    'TrainingCoordinator',

    'CompanyAuthority',

    'TrainingMode',
    'TrainingLocation',
    'TrainingDates',
    'PerformanceEvaluation_PreTest',
    'PerformanceEvaluation_Assessment',
    'PerformanceEvaluation_Assignment',
    'PerformanceEvaluation_FinalExam',
    'PerformanceEvaluation_TrainingMaterial',
    'PerformanceEvaluation_Attendance',
    'TrainingFeedbackObtained',
    'SitCertIssuedOnPerformanceOnAttendance',
    'Discussion',
  ];

  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'corporate_inquiry'
       AND COLUMN_NAME IN (${wanted.map(() => '?').join(',')})`,
    wanted
  );

  const existing = new Set((rows || []).map((r) => String(r?.COLUMN_NAME || '')));
  const alters = [];

  if (!existing.has('CtTrainingEnquiryId')) alters.push('ADD COLUMN CtTrainingEnquiryId INT NULL');

  if (!existing.has('InquiryStatus')) alters.push('ADD COLUMN InquiryStatus VARCHAR(20) NULL');
  if (!existing.has('TrainingNumber')) alters.push('ADD COLUMN TrainingNumber VARCHAR(50) NULL');
  if (!existing.has('TrainingDate')) alters.push('ADD COLUMN TrainingDate DATE NULL');
  if (!existing.has('TrainerName')) alters.push('ADD COLUMN TrainerName VARCHAR(255) NULL');
  if (!existing.has('NumberOfDays')) alters.push('ADD COLUMN NumberOfDays INT NULL');
  if (!existing.has('TotalStudents')) alters.push('ADD COLUMN TotalStudents INT NULL');
  if (!existing.has('TrainingCoordinator')) alters.push('ADD COLUMN TrainingCoordinator VARCHAR(255) NULL');

  if (!existing.has('CompanyAuthority')) alters.push('ADD COLUMN CompanyAuthority VARCHAR(255) NULL');

  if (!existing.has('TrainingMode')) alters.push('ADD COLUMN TrainingMode VARCHAR(20) NULL');
  if (!existing.has('TrainingLocation')) alters.push('ADD COLUMN TrainingLocation VARCHAR(255) NULL');
  if (!existing.has('TrainingDates')) alters.push('ADD COLUMN TrainingDates TEXT NULL');
  if (!existing.has('PerformanceEvaluation_PreTest')) alters.push('ADD COLUMN PerformanceEvaluation_PreTest TEXT NULL');
  if (!existing.has('PerformanceEvaluation_Assessment')) alters.push('ADD COLUMN PerformanceEvaluation_Assessment TEXT NULL');
  if (!existing.has('PerformanceEvaluation_Assignment')) alters.push('ADD COLUMN PerformanceEvaluation_Assignment TEXT NULL');
  if (!existing.has('PerformanceEvaluation_FinalExam')) alters.push('ADD COLUMN PerformanceEvaluation_FinalExam TEXT NULL');
  if (!existing.has('PerformanceEvaluation_TrainingMaterial')) alters.push('ADD COLUMN PerformanceEvaluation_TrainingMaterial TEXT NULL');
  if (!existing.has('PerformanceEvaluation_Attendance')) alters.push('ADD COLUMN PerformanceEvaluation_Attendance TEXT NULL');
  if (!existing.has('TrainingFeedbackObtained')) alters.push('ADD COLUMN TrainingFeedbackObtained TEXT NULL');
  if (!existing.has('SitCertIssuedOnPerformanceOnAttendance')) alters.push('ADD COLUMN SitCertIssuedOnPerformanceOnAttendance TEXT NULL');
  if (!existing.has('Discussion')) alters.push('ADD COLUMN Discussion TEXT NULL');

  for (const alter of alters) {
    await pool.query(`ALTER TABLE corporate_inquiry ${alter}`);
  }
}

async function ensureCorporateInquiryTextCapacity(pool) {
  // Legacy schemas often have very small VARCHAR sizes. CT sync may exceed them.
  const specs = [
    // Long / multi-line values
    { name: 'Designation', kind: 'text' },
    { name: 'business', kind: 'text' },
    { name: 'Discussion', kind: 'text' },
    { name: 'Remark', kind: 'text' },

    // Contact/company fields
    { name: 'Email', kind: 'varchar', minLen: 255 },
    { name: 'Mobile', kind: 'varchar', minLen: 50 },
    { name: 'Phone', kind: 'varchar', minLen: 50 },
    { name: 'Fname', kind: 'varchar', minLen: 255 },
    { name: 'FullName', kind: 'varchar', minLen: 255 },
    { name: 'CompanyName', kind: 'varchar', minLen: 255 },
    { name: 'CompanyAuthority', kind: 'varchar', minLen: 255 },
    { name: 'TrainingLocation', kind: 'varchar', minLen: 255 },
    { name: 'TrainerName', kind: 'varchar', minLen: 255 },
    { name: 'TrainingCoordinator', kind: 'varchar', minLen: 255 },
    { name: 'TrainingMode', kind: 'varchar', minLen: 50 },
    { name: 'TrainingDates', kind: 'text' },
    { name: 'PerformanceEvaluation_PreTest', kind: 'text' },
    { name: 'PerformanceEvaluation_Assessment', kind: 'text' },
    { name: 'PerformanceEvaluation_Assignment', kind: 'text' },
    { name: 'PerformanceEvaluation_FinalExam', kind: 'text' },
    { name: 'PerformanceEvaluation_TrainingMaterial', kind: 'text' },
    { name: 'PerformanceEvaluation_Attendance', kind: 'text' },
    { name: 'TrainingFeedbackObtained', kind: 'text' },
    { name: 'SitCertIssuedOnPerformanceOnAttendance', kind: 'text' },
  ];

  const wanted = specs.map((s) => s.name);
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'corporate_inquiry'
       AND COLUMN_NAME IN (${wanted.map(() => '?').join(',')})`,
    wanted
  );

  const info = new Map((rows || []).map((r) => [String(r.COLUMN_NAME || ''), r]));

  for (const spec of specs) {
    const r = info.get(spec.name);
    if (!r) continue;

    const col = spec.name;
    const dataType = String(r.DATA_TYPE || '').toLowerCase();
    const maxLen = r.CHARACTER_MAXIMUM_LENGTH === null || r.CHARACTER_MAXIMUM_LENGTH === undefined
      ? null
      : Number(r.CHARACTER_MAXIMUM_LENGTH);

    if (spec.kind === 'text') {
      if (dataType === 'text' || dataType === 'mediumtext' || dataType === 'longtext') continue;
      if (dataType === 'varchar' || dataType === 'char' || dataType === 'tinytext') {
        await pool.query(`ALTER TABLE corporate_inquiry MODIFY COLUMN \`${col}\` TEXT NULL`);
      }
      continue;
    }

    // spec.kind === 'varchar'
    if (dataType === 'varchar' || dataType === 'char') {
      const minLen = Number(spec.minLen || 255);
      if (typeof maxLen === 'number' && maxLen >= minLen) continue;
      await pool.query(`ALTER TABLE corporate_inquiry MODIFY COLUMN \`${col}\` VARCHAR(${minLen}) NULL`);
    }
    // If it's already TEXT, that's fine (more capacity than VARCHAR).
  }
}

async function tableExists(pool, tableName) {
  const [rows] = await pool.query(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName]
  );
  return (rows || []).length > 0;
}

async function main() {
  const args = parseArgs(process.argv);
  loadEnv();

  const host = getRequiredEnv('DB_HOST');
  const database = getRequiredEnv('DB_NAME');
  const user = getRequiredEnv('DB_USER');
  const password = getRequiredEnv('DB_PASSWORD');
  const port = Number(process.env.DB_PORT || '3306');

  const pool = mysql.createPool({
    host,
    port,
    database,
    user,
    password,
    waitForConnections: true,
    connectionLimit: 5,
    namedPlaceholders: true,
    dateStrings: true,
    ...(process.env.DB_SSL === 'true' && {
      ssl: { rejectUnauthorized: true },
    }),
  });

  try {
    const srcTable = 'ct_training_enquires';
    const srcExists = await tableExists(pool, srcTable);
    if (!srcExists) {
      console.error(`Source table not found: ${srcTable}`);
      process.exitCode = 1;
      return;
    }

    await ensureCorporateInquiryColumns(pool);
    await ensureCorporateInquiryTextCapacity(pool);

    const srcCols = await getTableColumns(pool, srcTable);
    const authorityCol =
      pickFirstExistingColumn(srcCols, [
        'company_authority',
        'company_authority_name',
        'authority',
        'authority_name',
        'detail_of_company_authority_name',
        'detail_of_company_authority',
      ]) ||
      pickFirstMatchingRegex(srcCols, [
        /(^|_)company(_|$).*authority.*name/i,
        /authority.*name/i,
        /(^|_)authority(_|$)/i,
      ]);

    // Authority must be an explicit field (not the inquirer/contact name).
    const authoritySelect = authorityCol
      ? `\`${authorityCol}\` AS company_authority`
      : `NULL AS company_authority`;

    const limitSql = args.limit > 0 ? `LIMIT ${Number(args.limit)}` : '';
    const [srcRows] = await pool.query(
      `SELECT
         id,
         corporate_training_batch_no,
         enquiry_date,
         status,
         disciplines,
         company,
         location,
         training_mode,
         training_dates,
         total_days,
         faculty,
         sit_training_cordinator,
         detail_of_company_corinator_name,
         detail_of_company_corinator_designation,
         detail_of_company_corinator_mobile,
         detail_of_company_corinator_email_id,
         ${authoritySelect},
         performance_evaluation_pretest,
         performance_evaluation_assessment,
         performance_evaluation_assignment,
         performance_evaluation_final_exam,
         performance_evaluation_training_material,
         performance_evaluation_attendance,
         training_feedback_obtained,
         sit_cert_issued_on_performance_on_attendance,
         no_of_participants,
         remarks
       FROM \`${srcTable}\`
       ORDER BY id ASC
       ${limitSql}`
    );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const r of srcRows) {
      const CtTrainingEnquiryId = r.id === null || r.id === undefined || r.id === '' ? null : Number(r.id);
      const TrainingNumber = r.corporate_training_batch_no ? String(r.corporate_training_batch_no).trim() : null;
      const CompanyName = r.company ? String(r.company).trim() : null;
      const Idate = toDateOnly(r.enquiry_date);

      if (!TrainingNumber && !CompanyName && !Idate) {
        skipped++;
        continue;
      }

      // Skip if already imported (stable de-dupe)
      if (CtTrainingEnquiryId !== null && Number.isFinite(CtTrainingEnquiryId)) {
        const [existing] = await pool.query(
          `SELECT Id
           FROM corporate_inquiry
           WHERE CtTrainingEnquiryId = ?
           LIMIT 1`,
          [CtTrainingEnquiryId]
        );

        if ((existing || []).length > 0) {
          const existingId = existing[0]?.Id;
          const CompanyAuthority = r.company_authority ? String(r.company_authority).trim() : null;
          if (!args.dryRun && existingId && CompanyAuthority) {
            await pool.query(
              `UPDATE corporate_inquiry
               SET CompanyAuthority = CASE
                 WHEN CompanyAuthority IS NULL OR CompanyAuthority = '' THEN ?
                 ELSE CompanyAuthority
               END
               WHERE Id = ?`,
              [CompanyAuthority, existingId]
            );
          }
          updated++;
          continue;
        }
      }

      const payload = {
        CtTrainingEnquiryId,
        // minimal identification
        FullName: r.detail_of_company_corinator_name ? String(r.detail_of_company_corinator_name).trim() : null,
        Designation: r.detail_of_company_corinator_designation ? String(r.detail_of_company_corinator_designation).trim() : null,
        Mobile: r.detail_of_company_corinator_mobile ? String(r.detail_of_company_corinator_mobile).trim() : null,
        Email: r.detail_of_company_corinator_email_id ? String(r.detail_of_company_corinator_email_id).trim() : null,

        CompanyName,
        CompanyAuthority: r.company_authority ? String(r.company_authority).trim() : null,
        Idate,

        InquiryStatus: normalizeStatus(r.status),

        TrainingNumber,
        TrainingDate: null,
        TrainerName: r.faculty ? String(r.faculty).trim() : null,
        NumberOfDays: r.total_days === null || r.total_days === undefined || r.total_days === '' ? null : Number(r.total_days),
        TotalStudents: r.no_of_participants === null || r.no_of_participants === undefined || r.no_of_participants === '' ? null : Number(r.no_of_participants),
        TrainingCoordinator: r.sit_training_cordinator ? String(r.sit_training_cordinator).trim() : null,

        TrainingMode: r.training_mode ? String(r.training_mode).trim() : null,
        TrainingLocation: r.location ? String(r.location).trim() : null,
        business: r.disciplines ? String(r.disciplines).trim() : null,
        Discussion: r.remarks ? String(r.remarks).trim() : null,

        PerformanceEvaluation_PreTest: r.performance_evaluation_pretest ? String(r.performance_evaluation_pretest).trim() : null,
        PerformanceEvaluation_Assessment: r.performance_evaluation_assessment ? String(r.performance_evaluation_assessment).trim() : null,
        PerformanceEvaluation_Assignment: r.performance_evaluation_assignment ? String(r.performance_evaluation_assignment).trim() : null,
        PerformanceEvaluation_FinalExam: r.performance_evaluation_final_exam ? String(r.performance_evaluation_final_exam).trim() : null,
        PerformanceEvaluation_TrainingMaterial: r.performance_evaluation_training_material ? String(r.performance_evaluation_training_material).trim() : null,
        PerformanceEvaluation_Attendance: r.performance_evaluation_attendance ? String(r.performance_evaluation_attendance).trim() : null,
        TrainingFeedbackObtained: r.training_feedback_obtained ? String(r.training_feedback_obtained).trim() : null,
        SitCertIssuedOnPerformanceOnAttendance: r.sit_cert_issued_on_performance_on_attendance ? String(r.sit_cert_issued_on_performance_on_attendance).trim() : null,
      };

      if (args.dryRun) {
        inserted++;
        continue;
      }

      await pool.query(
        `INSERT INTO corporate_inquiry (
          CtTrainingEnquiryId,
          Fname, FullName, CompanyName, Designation, Mobile, Email,
          CompanyAuthority,
          business, Idate,
          InquiryStatus,
          TrainingNumber, TrainingDate, TrainerName, NumberOfDays, TotalStudents, TrainingCoordinator,
          TrainingMode, TrainingLocation,
          PerformanceEvaluation_PreTest, PerformanceEvaluation_Assessment, PerformanceEvaluation_Assignment,
          PerformanceEvaluation_FinalExam, PerformanceEvaluation_TrainingMaterial, PerformanceEvaluation_Attendance,
          TrainingFeedbackObtained, SitCertIssuedOnPerformanceOnAttendance,
          Discussion, Remark,
          IsActive, IsDelete
        ) VALUES (
          ?,
          ?, ?, ?, ?, ?, ?,
          ?,
          ?, ?,
          ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?,
          1, 0
        )`,
        [
          payload.CtTrainingEnquiryId,
          payload.FullName,
          payload.FullName,
          payload.CompanyName,
          payload.Designation,
          payload.Mobile,
          payload.Email,
          payload.CompanyAuthority,
          payload.business,
          payload.Idate,
          payload.InquiryStatus,
          payload.TrainingNumber,
          payload.TrainingDate,
          payload.TrainerName,
          Number.isFinite(payload.NumberOfDays) ? payload.NumberOfDays : null,
          Number.isFinite(payload.TotalStudents) ? payload.TotalStudents : null,
          payload.TrainingCoordinator,
          payload.TrainingMode,
          payload.TrainingLocation,
          payload.Discussion,
          payload.PerformanceEvaluation_PreTest,
          payload.PerformanceEvaluation_Assessment,
          payload.PerformanceEvaluation_Assignment,
          payload.PerformanceEvaluation_FinalExam,
          payload.PerformanceEvaluation_TrainingMaterial,
          payload.PerformanceEvaluation_Attendance,
          payload.TrainingFeedbackObtained,
          payload.SitCertIssuedOnPerformanceOnAttendance,
          payload.Discussion,
        ]
      );

      inserted++;
    }

    console.log(
      [
        args.dryRun ? 'DRY RUN (no DB writes).' : 'Done.',
        `Source rows: ${(srcRows || []).length}`,
        `Would insert/Inserted: ${inserted}`,
        `Would update/Updated: ${updated}`,
        `Skipped (empty): ${skipped}`,
      ].join('\n')
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
