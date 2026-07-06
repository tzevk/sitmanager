#!/usr/bin/env node
/**
 * Insert missing legacy consultancy/company rows into the current consultant_mst.
 *
 * Usage:
 *   node scripts/db/import-missing-consultancies-from-legacy.mjs --dry-run
 *   node scripts/db/import-missing-consultancies-from-legacy.mjs
 *   node scripts/db/import-missing-consultancies-from-legacy.mjs --search "New Horizons"
 *
 * Existing current companies are detected by normalized Comp_Name and skipped.
 * No existing current rows are updated.
 */

import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const searchIdx = args.indexOf('--search');
const SEARCH = searchIdx >= 0 && args[searchIdx + 1] && !args[searchIdx + 1].startsWith('--')
  ? args[searchIdx + 1].trim()
  : '';

const COPY_COLUMNS = [
  'Comp_Name',
  'Contact_Person',
  'Designation',
  'Address',
  'City',
  'State',
  'Pin',
  'Country',
  'Tel',
  'Fax',
  'EMail',
  'Remark',
  'Date_Added',
  'Course_Id1',
  'CourseName1',
  'Course_Id2',
  'CourseName2',
  'Course_Id3',
  'CourseName3',
  'Course_Id4',
  'CourseName4',
  'Course_Id5',
  'CourseName5',
  'Course_Id6',
  'CourseName6',
  'Purpose',
  'IsActive',
  'IsDelete',
  'Company_Status',
  'Website',
  'Mobile',
  'Mention_Date',
  'Industry',
  'CreatedBy',
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function cleanValue(value, maxLength) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text.toUpperCase() === 'NULL') return null;
  return maxLength && text.length > maxLength ? text.slice(0, maxLength) : text;
}

async function getCurrentColumnLimits(pool) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'consultant_mst'`
  );
  return new Map(rows.map((row) => [String(row.COLUMN_NAME), row.CHARACTER_MAXIMUM_LENGTH == null ? null : Number(row.CHARACTER_MAXIMUM_LENGTH)]));
}

async function getCurrentNames(pool) {
  const [rows] = await pool.query(`SELECT Comp_Name FROM consultant_mst WHERE Comp_Name IS NOT NULL AND TRIM(Comp_Name) <> ''`);
  return new Set(rows.map((row) => normalizeName(row.Comp_Name)).filter(Boolean));
}

async function main() {
  const legacyPool = mysql.createPool({
    host: requireEnv('OLD_DB_HOST'),
    port: Number(process.env.OLD_DB_PORT || 3306),
    user: requireEnv('OLD_DB_USER'),
    password: requireEnv('OLD_DB_PASSWORD'),
    database: requireEnv('OLD_DB_NAME'),
    waitForConnections: true,
    connectionLimit: 4,
    dateStrings: true,
  });

  const currentPool = mysql.createPool({
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT || 3306),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    waitForConnections: true,
    connectionLimit: 4,
    dateStrings: true,
  });

  try {
    const limits = await getCurrentColumnLimits(currentPool);
    const currentNames = await getCurrentNames(currentPool);
    const selectColumns = COPY_COLUMNS.map((col) => `\`${col}\``).join(', ');
    const whereParts = ['(IsDelete = 0 OR IsDelete IS NULL)', "Comp_Name IS NOT NULL", "TRIM(Comp_Name) <> ''"];
    const params = [];

    if (SEARCH) {
      whereParts.push('Comp_Name LIKE ?');
      params.push(`%${SEARCH}%`);
    }

    const [legacyRows] = await legacyPool.query(
      `SELECT ${selectColumns}
       FROM Consultant_Mst
       WHERE ${whereParts.join(' AND ')}
       ORDER BY Const_Id ASC`,
      params
    );

    const seenLegacyNames = new Set();
    const rowsToInsert = [];
    let skippedExisting = 0;
    let skippedDuplicateLegacy = 0;

    for (const row of legacyRows) {
      const normalized = normalizeName(row.Comp_Name);
      if (!normalized) continue;
      if (currentNames.has(normalized)) {
        skippedExisting += 1;
        continue;
      }
      if (seenLegacyNames.has(normalized)) {
        skippedDuplicateLegacy += 1;
        continue;
      }
      seenLegacyNames.add(normalized);

      const next = {};
      for (const column of COPY_COLUMNS) {
        if (['Course_Id1', 'Course_Id2', 'Course_Id3', 'Course_Id4', 'Course_Id5', 'Course_Id6', 'IsActive', 'IsDelete'].includes(column)) {
          next[column] = row[column] == null || row[column] === '' ? null : Number(row[column]);
        } else {
          next[column] = cleanValue(row[column], limits.get(column));
        }
      }
      next.IsActive = next.IsActive ?? 1;
      next.IsDelete = 0;
      rowsToInsert.push(next);
    }

    console.log('Legacy rows scanned:', legacyRows.length);
    console.log('Skipped existing current companies:', skippedExisting);
    console.log('Skipped duplicate legacy company names:', skippedDuplicateLegacy);
    console.log(`${DRY_RUN ? 'Would insert' : 'Inserting'} missing companies:`, rowsToInsert.length);

    if (rowsToInsert.length) {
      console.log('Sample missing companies:');
      console.table(rowsToInsert.slice(0, 20).map((row) => ({ Comp_Name: row.Comp_Name, City: row.City, Country: row.Country, Purpose: row.Purpose })));
    }

    if (!DRY_RUN && rowsToInsert.length) {
      const placeholders = COPY_COLUMNS.map(() => '?').join(', ');
      const sql = `INSERT INTO consultant_mst (${COPY_COLUMNS.map((col) => `\`${col}\``).join(', ')}) VALUES (${placeholders})`;
      let inserted = 0;
      for (const row of rowsToInsert) {
        await currentPool.query(sql, COPY_COLUMNS.map((column) => row[column]));
        inserted += 1;
      }
      console.log('Inserted:', inserted);
    }
  } finally {
    await Promise.allSettled([legacyPool.end(), currentPool.end()]);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});