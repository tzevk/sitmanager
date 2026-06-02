#!/usr/bin/env node
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const TARGET_INDEXES = [
  { table: 'student_inquiry', name: 'idx_si_list', cols: 'IsDelete, _inquiry_date, Inquiry_Id' },
  { table: 'student_inquiry', name: 'idx_si_status_list', cols: 'IsDelete, OnlineState, _inquiry_date, Inquiry_Id' },
  { table: 'student_inquiry', name: 'idx_si_type_list', cols: 'IsDelete, Inquiry_Type, _inquiry_date, Inquiry_Id' },
  { table: 'student_inquiry', name: 'idx_si_course_list', cols: 'IsDelete, Course_Id, _inquiry_date, Inquiry_Id' },
  { table: 'awt_inquirydiscussion', name: 'idx_disc_lookup', cols: 'Inquiry_id, deleted, id' },
  { table: 'awt_inquirydiscussion', name: 'idx_disc_due', cols: 'deleted, nextdate, Inquiry_id, id' },
  { table: 'awt_inquirydiscussion', name: 'idx_disc_student_lookup', cols: 'student_id, deleted, id' },
];

const LEGACY_STUDENT_INQUIRY_INDEXES = ['idx_si_status', 'idx_si_type', 'idx_si_course'];

const TEXT_CONVERSION_EXCLUDE = new Set([
  'Student_Id',
  'Student_Name',
  'Course_Id',
  'Present_Mobile',
  'Present_Mobile2',
  'Inquiry_From',
  'Inquiry_Type',
  'Inquiry_Dt',
  'OnlineState',
  'Batch_Category_id',
]);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function escapeIdentifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``;
}

async function resolveInquiryTableName(pool) {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND LOWER(TABLE_NAME) = 'student_inquiry'
     ORDER BY CASE WHEN TABLE_NAME = 'Student_Inquiry' THEN 0 ELSE 1 END
     LIMIT 1`
  );

  return String(rows[0]?.TABLE_NAME || '').trim() || 'student_inquiry';
}

async function getTableEngine(pool, tableName) {
  const [rows] = await pool.query(
    `SELECT ENGINE
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName]
  );

  return String(rows[0]?.ENGINE || '').trim() || null;
}

async function hasInquiryDateColumn(pool, inquiryTable) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = '_inquiry_date'
     LIMIT 1`,
    [inquiryTable]
  );

  return rows.length > 0;
}

async function ensureInquiryDateColumn(pool, inquiryTable, dryRun) {
  const exists = await hasInquiryDateColumn(pool, inquiryTable);
  if (exists) return false;
  if (!dryRun) {
    await pool.query(
      `ALTER TABLE \`${inquiryTable}\` ADD COLUMN _inquiry_date DATE GENERATED ALWAYS AS (` +
      `COALESCE(` +
      `STR_TO_DATE(LEFT(NULLIF(TRIM(Inquiry_Dt),''),19),'%Y-%m-%d %H:%i:%s'),` +
      `STR_TO_DATE(LEFT(NULLIF(TRIM(Inquiry_Dt),''),10),'%Y-%m-%d'),` +
      `STR_TO_DATE(LEFT(NULLIF(TRIM(Inquiry_Dt),''),10),'%d-%m-%Y'),` +
      `STR_TO_DATE(LEFT(NULLIF(TRIM(Inquiry_Dt),''),10),'%d/%m/%Y')` +
      `)) VIRTUAL`
    );
  }
  return true;
}

async function loadTextConversionCandidates(pool, inquiryTable) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH, ORDINAL_POSITION
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND DATA_TYPE = 'varchar'
     ORDER BY CHARACTER_MAXIMUM_LENGTH DESC, ORDINAL_POSITION ASC`,
    [inquiryTable]
  );

  return rows
    .map((row) => String(row.COLUMN_NAME || '').trim())
    .filter((columnName) => columnName && !TEXT_CONVERSION_EXCLUDE.has(columnName));
}

async function applyTextConversions(pool, tableName, columnNames) {
  if (columnNames.length === 0) return;

  const clauses = columnNames.map((columnName) => `MODIFY ${escapeIdentifier(columnName)} TEXT NULL`);
  await pool.query(`ALTER TABLE ${escapeIdentifier(tableName)} ${clauses.join(', ')}`);
}

async function probeInnoDBConversion(pool, inquiryTable, textColumns) {
  const probeTable = `${inquiryTable}__innodb_probe`;

  try {
    await pool.query(`DROP TABLE IF EXISTS ${escapeIdentifier(probeTable)}`);
    await pool.query(`CREATE TABLE ${escapeIdentifier(probeTable)} LIKE ${escapeIdentifier(inquiryTable)}`);

    if (textColumns.length > 0) {
      await applyTextConversions(pool, probeTable, textColumns);
    }

    await pool.query(`ALTER TABLE ${escapeIdentifier(probeTable)} ROW_FORMAT=DYNAMIC, ENGINE=InnoDB`);
    return true;
  } catch (error) {
    const message = String(error?.message || error || '');
    if (!message.toLowerCase().includes('row size too large')) {
      throw error;
    }
    return false;
  } finally {
    await pool.query(`DROP TABLE IF EXISTS ${escapeIdentifier(probeTable)}`);
  }
}

async function findRequiredTextConversions(pool, inquiryTable, currentEngine) {
  if ((currentEngine || '').toUpperCase() === 'INNODB') return [];

  if (await probeInnoDBConversion(pool, inquiryTable, [])) {
    return [];
  }

  const candidates = await loadTextConversionCandidates(pool, inquiryTable);
  for (let count = 1; count <= candidates.length; count += 1) {
    const selected = candidates.slice(0, count);
    if (await probeInnoDBConversion(pool, inquiryTable, selected)) {
      return selected;
    }
  }

  throw new Error('Unable to find a safe VARCHAR-to-TEXT conversion set for student_inquiry InnoDB migration');
}

async function convertInquiryTableToInnoDB(pool, inquiryTable, textColumns) {
  const clauses = [
    ...textColumns.map((columnName) => `MODIFY ${escapeIdentifier(columnName)} TEXT NULL`),
    'ROW_FORMAT=DYNAMIC',
    'ENGINE=InnoDB',
  ];

  await pool.query(`ALTER TABLE ${escapeIdentifier(inquiryTable)} ${clauses.join(', ')}`);
}

async function loadExistingIndexNames(pool, tables) {
  const uniqueTables = [...new Set(tables.filter(Boolean))];
  const placeholders = uniqueTables.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT INDEX_NAME, TABLE_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (${placeholders})
     GROUP BY TABLE_NAME, INDEX_NAME`,
    uniqueTables
  );

  return new Set(rows.map((row) => `${row.TABLE_NAME}.${row.INDEX_NAME}`));
}

async function addMissingIndexes(pool, inquiryTable, dryRun) {
  const planned = TARGET_INDEXES.map((index) => ({
    ...index,
    table: index.table === 'student_inquiry' ? inquiryTable : index.table,
  }));

  const existing = await loadExistingIndexNames(pool, planned.map((index) => index.table));
  const missing = planned.filter((index) => !existing.has(`${index.table}.${index.name}`));

  if (!dryRun) {
    for (const index of missing) {
      await pool.query(`ALTER TABLE \`${index.table}\` ADD INDEX \`${index.name}\` (${index.cols})`);
    }
  }

  return missing.map((index) => `${index.table}.${index.name}`);
}

async function dropLegacyIndexes(pool, inquiryTable, dryRun) {
  const existing = await loadExistingIndexNames(pool, [inquiryTable]);
  const dropList = LEGACY_STUDENT_INQUIRY_INDEXES.filter((name) => existing.has(`${inquiryTable}.${name}`));

  if (!dryRun) {
    for (const indexName of dropList) {
      await pool.query(`ALTER TABLE \`${inquiryTable}\` DROP INDEX \`${indexName}\``);
    }
  }

  return dropList;
}

async function main() {
  const pool = await mysql.createPool({
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 3306),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    waitForConnections: true,
    connectionLimit: 1,
    maxIdle: 0,
    dateStrings: true,
  });

  try {
    const inquiryTable = await resolveInquiryTableName(pool);
    const beforeEngine = await getTableEngine(pool, inquiryTable);
    const requiredTextColumns = await findRequiredTextConversions(pool, inquiryTable, beforeEngine);

    console.log('=== Convert student_inquiry to InnoDB ===');
    console.log(`Inquiry table : ${inquiryTable}`);
    console.log(`Dry run       : ${DRY_RUN}`);
    console.log(`Before engine : ${beforeEngine || 'unknown'}`);

    const addedDateColumn = await ensureInquiryDateColumn(pool, inquiryTable, DRY_RUN);

    let engineChanged = false;
    if ((beforeEngine || '').toUpperCase() !== 'INNODB') {
      engineChanged = true;
      if (!DRY_RUN) {
        await convertInquiryTableToInnoDB(pool, inquiryTable, requiredTextColumns);
      }
    }

    const addedIndexes = await addMissingIndexes(pool, inquiryTable, DRY_RUN);
    const droppedIndexes = await dropLegacyIndexes(pool, inquiryTable, DRY_RUN);
    const afterEngine = DRY_RUN ? (engineChanged ? 'InnoDB (planned)' : beforeEngine) : await getTableEngine(pool, inquiryTable);

    console.log(`Date column   : ${addedDateColumn ? (DRY_RUN ? 'would add' : 'added') : 'already present'}`);
    console.log(`Text columns  : ${requiredTextColumns.length ? requiredTextColumns.join(', ') : 'none'}`);
    console.log(`Engine        : ${engineChanged ? (DRY_RUN ? 'would convert to InnoDB' : 'converted to InnoDB') : `already ${beforeEngine}`}`);
    console.log(`Added indexes : ${addedIndexes.length ? addedIndexes.join(', ') : 'none'}`);
    console.log(`Dropped index : ${droppedIndexes.length ? droppedIndexes.join(', ') : 'none'}`);
    console.log(`After engine  : ${afterEngine || 'unknown'}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('FATAL:', error?.message || error);
  process.exit(1);
});