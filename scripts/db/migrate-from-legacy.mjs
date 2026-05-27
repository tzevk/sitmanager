#!/usr/bin/env node
/**
 * One-time backfill: transfer records from the legacy DB to the new DB.
 *
 * Usage:
 *   node scripts/db/migrate-from-legacy.mjs
 *   node scripts/db/migrate-from-legacy.mjs --since 2026-05-20   # default
 *   node scripts/db/migrate-from-legacy.mjs --since 2026-01-01   # broader window
 *   node scripts/db/migrate-from-legacy.mjs --dry-run            # preview counts only
 *
 * What it migrates (in order):
 *   1. Student_Inquiry       — rows where Inquiry_Dt >= --since date
 *   2. awt_inquirydiscussion — rows tied to those inquiry IDs
 *   3. course_mst            — all rows (small master table, safe to upsert in full)
 *   4. batch_mst             — all rows
 *   5. mst_batchcategory     — all rows (if table exists in legacy DB)
 *   6. Consultant_Mst        — all rows
 *   7. consultant_branch     — all rows
 *   8. consultant_follows    — all rows
 *   9. CV_Shortlisted        — all rows
 *  10. CVChild               — all rows
 *
 * All writes use INSERT … ON DUPLICATE KEY UPDATE, so re-running is safe.
 *
 * NOTE: The legacy DB uses PascalCase table names (e.g. Student_Inquiry) while
 * the new DB uses lowercase (e.g. student_inquiry). The TABLE_MAP below handles
 * this mapping. Column names are identical so no column remapping is needed.
 */

import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') }); // overrides .env if present

// ── CLI args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const sinceIdx = args.indexOf('--since');
const sinceArg = sinceIdx !== -1 ? args[sinceIdx + 1] : null;
const SINCE_DATE = (sinceArg && !sinceArg.startsWith('--')) ? sinceArg : '2026-05-20';
const DRY_RUN = args.includes('--dry-run');
const BATCH_SIZE = 500;

// Legacy DB table name → New DB table name
// (only needed where they differ; same-name tables don't need an entry)
const TABLE_MAP = {
  'Student_Inquiry':   'student_inquiry',
  'Course_Mst':        'course_mst',
  'Batch_Mst':         'batch_mst',
  'MST_BatchCategory': 'mst_batchcategory',
  'Consultant_Mst':    'consultant_mst',
  'CV_Shortlisted':    'cv_shortlisted',
  'CVChild':           'cvchild',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function buildUpsert(table, columns) {
  const cols = columns.map((c) => `\`${c}\``).join(', ');
  const updates = columns.map((c) => `\`${c}\`=VALUES(\`${c}\`)`).join(', ');
  return `INSERT INTO \`${table}\` (${cols}) VALUES ? ON DUPLICATE KEY UPDATE ${updates}`;
}

async function getColumns(pool, table) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME AS c, EXTRA AS extra
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [table],
  );
  return rows
    .filter((r) => !(r.extra ?? '').toLowerCase().includes('generated'))
    .map((r) => r.c);
}

async function tableExists(pool, table) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [table],
  );
  return rows.length > 0;
}

/** Intersect old columns with what actually exists in the target table to avoid
 *  inserting into extra columns the legacy DB doesn't have (e.g. Created_By). */
async function getSharedColumns(oldPool, newPool, oldTable, newTable) {
  const oldCols = await getColumns(oldPool, oldTable);
  const newCols = await getColumns(newPool, newTable);
  const newColsLower = new Set(newCols.map((c) => c.toLowerCase()));
  return oldCols.filter((c) => newColsLower.has(c.toLowerCase()));
}

async function upsertBatched(newPool, targetTable, columns, rows, dryRun) {
  if (!rows.length) return 0;
  if (dryRun) return rows.length;

  const upsertSql = buildUpsert(targetTable, columns);
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const values = chunk.map((r) => columns.map((c) => r[c] ?? null));
    await newPool.query(upsertSql, [values]);
    written += chunk.length;
  }
  return written;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`=== Legacy → New DB migration ===`);
  console.log(`  Since date : ${SINCE_DATE}`);
  console.log(`  Dry run    : ${DRY_RUN}`);
  console.log('');

  const oldPool = await mysql.createPool({
    host: requireEnv('OLD_DB_HOST'),
    port: Number(process.env.OLD_DB_PORT ?? 3306),
    user: requireEnv('OLD_DB_USER'),
    password: requireEnv('OLD_DB_PASSWORD'),
    database: requireEnv('OLD_DB_NAME'),
    waitForConnections: true,
    connectionLimit: 5,
    dateStrings: true,
  });

  const newPool = await mysql.createPool({
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 3306),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    waitForConnections: true,
    connectionLimit: 5,
    dateStrings: true,
  });

  let inquiryIds = [];

  try {
    // 1. Student_Inquiry ────────────────────────────────────────────────────
    {
      const srcTable = 'Student_Inquiry';
      const dstTable = TABLE_MAP[srcTable];
      console.log(`[1/5] ${srcTable} → ${dstTable} — fetching rows since ${SINCE_DATE}…`);

      const columns = await getSharedColumns(oldPool, newPool, srcTable, dstTable);
      if (!columns.length) throw new Error(`No shared columns found for ${srcTable}`);

      // Inquiry_Dt is VARCHAR in legacy DB — parse multiple common formats
      const dtExpr = `COALESCE(
        STR_TO_DATE(SUBSTRING(Inquiry_Dt,1,19),'%Y-%m-%d %H:%i:%s'),
        STR_TO_DATE(SUBSTRING(Inquiry_Dt,1,10),'%Y-%m-%d'),
        STR_TO_DATE(SUBSTRING(Inquiry_Dt,1,10),'%d-%m-%Y'),
        STR_TO_DATE(SUBSTRING(Inquiry_Dt,1,10),'%d/%m/%Y'),
        DATE('1970-01-01')
      )`;

      const colsSql = columns.map((c) => `\`${c}\``).join(', ');
      const [rows] = await oldPool.query(
        `SELECT ${colsSql} FROM \`${srcTable}\`
         WHERE (IsDelete = 0 OR IsDelete IS NULL)
           AND ${dtExpr} >= ?
         ORDER BY Inquiry_Id ASC`,
        [SINCE_DATE],
      );

      console.log(`   Found ${rows.length} row(s) in legacy DB`);
      const written = await upsertBatched(newPool, dstTable, columns, rows, DRY_RUN);
      console.log(`   ${DRY_RUN ? '[dry-run] would write' : 'Upserted'} ${written} row(s)`);

      inquiryIds = rows.map((r) => r['Inquiry_Id']).filter(Boolean);
    }

    // 2. awt_inquirydiscussion ───────────────────────────────────────────────
    {
      const table = 'awt_inquirydiscussion'; // same name in both DBs
      console.log(`\n[2/5] ${table} — fetching discussions for ${inquiryIds.length} inquiry IDs…`);

      if (!inquiryIds.length) {
        console.log('   No inquiry IDs to look up, skipping.');
      } else if (!(await tableExists(oldPool, table))) {
        console.log('   Table not found in legacy DB, skipping.');
      } else {
        const columns = await getSharedColumns(oldPool, newPool, table, table);
        const colsSql = columns.map((c) => `\`${c}\``).join(', ');

        let rows = [];
        for (let i = 0; i < inquiryIds.length; i += 500) {
          const chunk = inquiryIds.slice(i, i + 500);
          const placeholders = chunk.map(() => '?').join(',');
          const [chunkRows] = await oldPool.query(
            `SELECT ${colsSql} FROM \`${table}\` WHERE Inquiry_Id IN (${placeholders})`,
            chunk,
          );
          rows = rows.concat(chunkRows);
        }

        console.log(`   Found ${rows.length} row(s) in legacy DB`);
        const written = await upsertBatched(newPool, table, columns, rows, DRY_RUN);
        console.log(`   ${DRY_RUN ? '[dry-run] would write' : 'Upserted'} ${written} row(s)`);
      }
    }

    // 3–8. Master tables (legacy PascalCase → new lowercase) ────────────────
    const masterPairs = [
      ['Course_Mst',        'course_mst'],
      ['Batch_Mst',         'batch_mst'],
      ['MST_BatchCategory', 'mst_batchcategory'],
      ['Consultant_Mst',    'consultant_mst'],
      ['consultant_branch', 'consultant_branch'],
      ['consultant_follows','consultant_follows'],
      ['CV_Shortlisted',    'cv_shortlisted'],
      ['CVChild',           'cvchild'],
    ];

    for (let idx = 0; idx < masterPairs.length; idx++) {
      const [srcTable, dstTable] = masterPairs[idx];
      const stepNum = idx + 3;
      console.log(`\n[${stepNum}/10] ${srcTable}${srcTable !== dstTable ? ' → ' + dstTable : ''} — upserting all rows…`);

      if (!(await tableExists(oldPool, srcTable))) {
        console.log(`   Table not found in legacy DB, skipping.`);
        continue;
      }

      const columns = await getSharedColumns(oldPool, newPool, srcTable, dstTable);
      const colsSql = columns.map((c) => `\`${c}\``).join(', ');
      const [rows] = await oldPool.query(`SELECT ${colsSql} FROM \`${srcTable}\``);

      console.log(`   Found ${rows.length} row(s)`);
      const written = await upsertBatched(newPool, dstTable, columns, rows, DRY_RUN);
      console.log(`   ${DRY_RUN ? '[dry-run] would write' : 'Upserted'} ${written} row(s)`);
    }

    console.log('\n=== Migration complete ===');
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err?.message ?? err);
  process.exit(1);
});
