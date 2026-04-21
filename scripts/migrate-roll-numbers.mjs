/**
 * Roll-number migration: old DB → new DB
 * Run:  node scripts/migrate-roll-numbers.mjs [--commit] [--force]
 *
 *   --commit   Actually write to new DB (default: dry-run)
 *   --force    Overwrite roll numbers that already exist in new DB
 */

import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');

// ── Parse .env.local ────────────────────────────────────────────────
function loadEnv(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnv(envPath);

const args   = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const FORCE  = args.includes('--force');

// ── Connection configs ───────────────────────────────────────────────
const OLD_CFG = {
  host:     env.OLD_DB_HOST,
  port:     parseInt(env.OLD_DB_PORT || '3306', 10),
  database: env.OLD_DB_NAME,
  user:     env.OLD_DB_USER,
  password: env.OLD_DB_PASSWORD,
  namedPlaceholders: true,
  dateStrings: true,
  connectTimeout: 30_000,
};

const NEW_CFG = {
  host:     env.DB_HOST,
  port:     parseInt(env.DB_PORT || '3306', 10),
  database: env.DB_NAME,
  user:     env.DB_USER,
  password: env.DB_PASSWORD,
  namedPlaceholders: true,
  dateStrings: true,
  connectTimeout: 30_000,
};

// ── Read-only guard for old DB ───────────────────────────────────────
const READ_ONLY_RE = /^(with|select|show|describe|desc|explain)\b/i;
function assertReadOnly(sql) {
  const s = String(sql).replace(/^(\s|\/\*[\s\S]*?\*\/|--[^\n]*\n|#[^\n]*\n)*/, '').trim();
  if (!READ_ONLY_RE.test(s)) {
    throw new Error(`[SAFETY] Blocked non-read query on OLD DB:\n  ${s.slice(0, 80)}`);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────
function pad(n, w = 6) { return String(n).padStart(w, ' '); }
function line(char = '─', w = 70) { return char.repeat(w); }

function printSummary(s) {
  console.log('\n' + line());
  console.log('  MIGRATION SUMMARY');
  console.log(line());
  console.log(`  Mode              : ${s.commit ? '⚡ COMMIT (writing to new DB)' : '🔍 DRY RUN (no writes)'}`);
  console.log(`  Force overwrite   : ${s.force  ? 'yes' : 'no'}`);
  console.log(line('─', 70));
  console.log(`  Old DB records    :${pad(s.total)}`);
  console.log(`  Matched by ID     :${pad(s.byId)}`);
  console.log(`  Matched by name   :${pad(s.byName)}`);
  console.log(`  Not found         :${pad(s.notFound)}`);
  console.log(`  Skipped (exists)  :${pad(s.skipped)}`);
  console.log(`  ${s.commit ? 'Updated' : 'Would update'}          :${pad(s.updated)}`);
  console.log(line());
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log(line());
  console.log(`  Roll-number migration  [${COMMIT ? 'COMMIT' : 'DRY RUN'}${FORCE ? ' + FORCE' : ''}]`);
  console.log(`  Old DB : ${OLD_CFG.user}@${OLD_CFG.host}/${OLD_CFG.database}`);
  console.log(`  New DB : ${NEW_CFG.user}@${NEW_CFG.host}/${NEW_CFG.database}`);
  console.log(line());

  // ── Connect ──────────────────────────────────────────────────────
  process.stdout.write('  Connecting to old DB ... ');
  const oldConn = await mysql.createConnection(OLD_CFG);
  console.log('OK');

  process.stdout.write('  Connecting to new DB ... ');
  const newConn = await mysql.createConnection(NEW_CFG);
  console.log('OK\n');

  try {
    // ── 1. Read old DB ─────────────────────────────────────────────
    // Old DB uses: Admission_master (capital A), Student_Master, Batch_Mst
    // Roll numbers are stored in Student_Code (not Roll_No — that column doesn't exist in old DB)
    const readSql = `
      SELECT
        CAST(am.Student_Id AS UNSIGNED)   AS Student_Id,
        CAST(am.Batch_Id   AS UNSIGNED)   AS Batch_Id,
        am.Student_Code                   AS Roll_No,
        COALESCE(s.Student_Name, '')      AS Student_Name,
        COALESCE(b.Batch_code,   '')      AS Batch_code
      FROM Admission_master am
      LEFT JOIN Student_Master s ON s.Student_Id = am.Student_Id
      LEFT JOIN Batch_Mst      b ON b.Batch_Id   = am.Batch_Id
      WHERE am.Student_Code IS NOT NULL
        AND am.Student_Code != ''
        AND am.Student_Code REGEXP '^[0-9]+$'
        AND LENGTH(am.Student_Code) <= 20
        AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
      ORDER BY CAST(am.Batch_Id AS UNSIGNED), CAST(am.Student_Id AS UNSIGNED)
    `;
    assertReadOnly(readSql);

    process.stdout.write('  Reading roll numbers from old DB ... ');
    const [oldRows] = await oldConn.query(readSql);
    console.log(`${oldRows.length} records found`);

    if (oldRows.length === 0) {
      console.log('\n  Nothing to migrate. Exiting.');
      return;
    }

    // ── 2. Read new DB admission index ─────────────────────────────
    process.stdout.write('  Reading admission index from new DB ... ');
    const [newRows] = await newConn.query(`
      SELECT
        am.Admission_Id,
        am.Student_Id,
        am.Batch_Id,
        COALESCE(am.Roll_No, '')     AS Roll_No,
        COALESCE(s.Student_Name, '') AS Student_Name,
        COALESCE(b.Batch_code,   '') AS Batch_code
      FROM admission_master am
      LEFT JOIN student_master s ON s.Student_Id = am.Student_Id
      LEFT JOIN batch_mst      b ON b.Batch_Id   = am.Batch_Id
      WHERE (am.IsDelete = 0 OR am.IsDelete IS NULL)
        AND (am.Cancel   = 0 OR am.Cancel   IS NULL)
    `);
    console.log(`${newRows.length} records indexed`);

    // Build lookup maps
    const byId   = new Map();
    const byName = new Map();
    for (const r of newRows) {
      const idKey   = `${r.Student_Id}::${r.Batch_Id}`;
      const nameKey = `${String(r.Student_Name).trim().toLowerCase()}::${String(r.Batch_code).trim().toLowerCase()}`;
      if (!byId.has(idKey))     byId.set(idKey,   r);
      if (!byName.has(nameKey)) byName.set(nameKey, r);
    }

    // ── 3. Match and plan ──────────────────────────────────────────
    console.log('\n  Matching records...\n');

    const toUpdate  = [];
    const notFound  = [];
    const skipped   = [];
    let byIdCount   = 0;
    let byNameCount = 0;

    for (const old of oldRows) {
      const rollNo = String(old.Roll_No).trim();
      if (!rollNo) continue;

      const idKey   = `${old.Student_Id}::${old.Batch_Id}`;
      const nameKey = `${String(old.Student_Name).trim().toLowerCase()}::${String(old.Batch_code).trim().toLowerCase()}`;

      let match    = byId.get(idKey);
      let strategy = match ? 'id' : null;

      if (!match && nameKey !== '::') {
        match    = byName.get(nameKey);
        strategy = match ? 'name+batch' : null;
      }

      if (!match) {
        notFound.push({ rollNo, name: old.Student_Name, batch: old.Batch_code });
        continue;
      }

      const existing = String(match.Roll_No || '').trim();
      if (existing && !FORCE) {
        skipped.push({ rollNo, name: old.Student_Name, batch: old.Batch_code, existing });
        continue;
      }

      if (strategy === 'id')         byIdCount++;
      else if (strategy === 'name+batch') byNameCount++;

      toUpdate.push({
        admissionId : match.Admission_Id,
        rollNo,
        name        : old.Student_Name,
        batch       : old.Batch_code,
        strategy,
        existing    : existing || null,
      });
    }

    // ── 4. Print not-found / skipped detail ───────────────────────
    if (notFound.length) {
      console.log(`  ⚠  Not matched in new DB (${notFound.length}):`);
      for (const r of notFound) {
        console.log(`     ${r.rollNo.padEnd(20)} ${r.name.padEnd(30)} [${r.batch}]`);
      }
      console.log();
    }

    if (skipped.length) {
      console.log(`  ⏭  Skipped — already has roll no. in new DB (${skipped.length}):`);
      for (const r of skipped) {
        console.log(`     old=${r.rollNo.padEnd(18)} new=${r.existing.padEnd(18)} ${r.name} [${r.batch}]`);
      }
      console.log();
    }

    if (toUpdate.length) {
      console.log(`  ✓  ${COMMIT ? 'Will update' : 'Would update'} (${toUpdate.length}):`);
      for (const r of toUpdate) {
        const flag = r.existing ? ` [overwrite: ${r.existing}]` : '';
        console.log(`     ${r.rollNo.padEnd(20)} ${r.name.padEnd(30)} [${r.batch}] via ${r.strategy}${flag}`);
      }
      console.log();
    }

    // ── 5. Write (only when --commit) ─────────────────────────────
    let actuallyUpdated = 0;

    if (COMMIT && toUpdate.length > 0) {
      process.stdout.write(`  Writing ${toUpdate.length} updates ... `);
      await newConn.beginTransaction();
      try {
        for (const { admissionId, rollNo } of toUpdate) {
          await newConn.query(
            `UPDATE admission_master SET Roll_No = ? WHERE Admission_Id = ?`,
            [rollNo, admissionId]
          );
          actuallyUpdated++;
        }
        await newConn.commit();
        console.log('committed ✓');
      } catch (err) {
        await newConn.rollback();
        console.log('FAILED — rolled back ✗');
        throw err;
      }
    } else if (!COMMIT && toUpdate.length > 0) {
      console.log('  (Dry run — no writes made. Re-run with --commit to apply.)');
    }

    // ── 6. Summary ─────────────────────────────────────────────────
    printSummary({
      commit   : COMMIT,
      force    : FORCE,
      total    : oldRows.length,
      byId     : byIdCount,
      byName   : byNameCount,
      notFound : notFound.length,
      skipped  : skipped.length,
      updated  : COMMIT ? actuallyUpdated : toUpdate.length,
    });

  } finally {
    await oldConn.end();
    await newConn.end();
  }
}

main().catch(err => {
  console.error('\n  ERROR:', err.message);
  process.exit(1);
});
