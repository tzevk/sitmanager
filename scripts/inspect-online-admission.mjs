/**
 * Inspect OLD DB for online-admission-related data.
 *
 *   node scripts/inspect-online-admission.mjs
 *
 * Read-only. Discovers what tables and columns exist in the OLD DB that look
 * like they hold online-admission form submissions, prints schema and samples,
 * and cross-checks against the NEW DB so we can plan a migration.
 *
 * Output is meant to be piped to a file:
 *   node scripts/inspect-online-admission.mjs > inspection.txt
 */

import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir   = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');

function loadEnv(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

const env = loadEnv(envPath);

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

const READ_ONLY_RE = /^(with|select|show|describe|desc|explain)\b/i;
function assertReadOnly(sql) {
  const s = String(sql).replace(/^(\s|\/\*[\s\S]*?\*\/|--[^\n]*\n|#[^\n]*\n)*/, '').trim();
  if (!READ_ONLY_RE.test(s)) {
    throw new Error(`[SAFETY] non-read query blocked:\n  ${s.slice(0, 80)}`);
  }
}

async function ro(conn, sql, params = []) {
  assertReadOnly(sql);
  const [rows] = await conn.query(sql, params);
  return rows;
}

function hr(c = '─', w = 78) { return c.repeat(w); }
function header(label) {
  console.log('\n' + hr('═'));
  console.log('  ' + label);
  console.log(hr('═'));
}
function sub(label) {
  console.log('\n' + hr());
  console.log('  ' + label);
  console.log(hr());
}

async function main() {
  console.log(hr('═'));
  console.log('  ONLINE ADMISSION — OLD DB INSPECTION');
  console.log(`  OLD : ${OLD_CFG.user}@${OLD_CFG.host}/${OLD_CFG.database}`);
  console.log(`  NEW : ${NEW_CFG.user}@${NEW_CFG.host}/${NEW_CFG.database}`);
  console.log(hr('═'));

  process.stdout.write('  Connecting to old DB ... ');
  const oldConn = await mysql.createConnection(OLD_CFG);
  console.log('OK');
  process.stdout.write('  Connecting to new DB ... ');
  const newConn = await mysql.createConnection(NEW_CFG);
  console.log('OK');

  try {
    /* ─── 1. Find admission/inquiry/online tables in OLD DB ─────────── */
    header('1. CANDIDATE TABLES IN OLD DB');

    const tables = await ro(oldConn, `
      SELECT TABLE_NAME, TABLE_ROWS, ENGINE, CREATE_TIME, UPDATE_TIME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ?
        AND (
          TABLE_NAME LIKE '%online%'
          OR TABLE_NAME LIKE '%admission%'
          OR TABLE_NAME LIKE '%inquiry%'
          OR TABLE_NAME LIKE '%enquiry%'
          OR TABLE_NAME LIKE '%application%'
          OR TABLE_NAME LIKE '%form%'
          OR TABLE_NAME LIKE '%payload%'
        )
      ORDER BY TABLE_NAME
    `, [OLD_CFG.database]);

    for (const t of tables) {
      console.log(`  ${(t.TABLE_NAME + ' ').padEnd(48, '.')} ${String(t.TABLE_ROWS ?? '?').padStart(8)} rows  [${t.ENGINE}]`);
    }
    if (!tables.length) console.log('  (no matching tables found)');

    /* ─── 2. Detail each candidate table ────────────────────────────── */
    for (const t of tables) {
      sub(`TABLE: ${t.TABLE_NAME}`);

      const cols = await ro(oldConn, `
        SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [OLD_CFG.database, t.TABLE_NAME]);

      console.log('  Columns:');
      for (const c of cols) {
        const nn = c.IS_NULLABLE === 'NO' ? 'NOT NULL' : '';
        const k  = c.COLUMN_KEY ? `[${c.COLUMN_KEY}]` : '';
        console.log(`    - ${c.COLUMN_NAME.padEnd(30)} ${c.COLUMN_TYPE.padEnd(20)} ${nn} ${k}`);
      }

      // Actual row count (TABLE_ROWS is approximate for InnoDB)
      try {
        const [{ n }] = await ro(oldConn, `SELECT COUNT(*) AS n FROM \`${t.TABLE_NAME}\``);
        console.log(`  Actual row count: ${n}`);
      } catch (e) {
        console.log(`  Row count: (failed: ${e.message})`);
      }

      // Sample 3 rows
      try {
        const sample = await ro(oldConn, `SELECT * FROM \`${t.TABLE_NAME}\` LIMIT 3`);
        if (sample.length) {
          console.log('  Sample rows (first 3):');
          for (const row of sample) {
            const compact = {};
            for (const [k, v] of Object.entries(row)) {
              const s = v == null ? 'null' : String(v);
              compact[k] = s.length > 60 ? s.slice(0, 57) + '...' : s;
            }
            console.log('    ' + JSON.stringify(compact));
          }
        } else {
          console.log('  (table is empty)');
        }
      } catch (e) {
        console.log(`  Sample failed: ${e.message}`);
      }
    }

    /* ─── 3. Marker columns: how does old DB tag online inquiries? ──── */
    header('3. ONLINE-INQUIRY MARKERS IN OLD Student_Inquiry');
    try {
      const [{ n: total }] = await ro(oldConn, `SELECT COUNT(*) AS n FROM Student_Inquiry`);
      console.log(`  Total Student_Inquiry rows: ${total}`);

      const dist = await ro(oldConn, `
        SELECT OnlineState AS v, COUNT(*) AS n
        FROM Student_Inquiry
        GROUP BY OnlineState
        ORDER BY n DESC
        LIMIT 20
      `);
      console.log('  OnlineState distribution:');
      for (const r of dist) console.log(`    ${String(r.v ?? 'NULL').padEnd(8)} → ${r.n}`);

      const stat = await ro(oldConn, `
        SELECT Status_id AS v, COUNT(*) AS n
        FROM Student_Inquiry
        GROUP BY Status_id
        ORDER BY n DESC
        LIMIT 20
      `);
      console.log('  Status_id distribution:');
      for (const r of stat) console.log(`    ${String(r.v ?? 'NULL').padEnd(8)} → ${r.n}`);
    } catch (e) {
      console.log(`  (failed: ${e.message})`);
    }

    /* ─── 4. Cross-check NEW DB ─────────────────────────────────────── */
    header('4. CURRENT STATE OF NEW DB');
    try {
      const [{ n: payload }] = await ro(newConn, `
        SELECT COUNT(*) AS n FROM online_admission_payload
      `);
      console.log(`  online_admission_payload : ${payload} rows`);
    } catch (e) {
      console.log(`  online_admission_payload : MISSING (${e.message})`);
    }

    try {
      const [{ n: si }] = await ro(newConn, `
        SELECT COUNT(*) AS n FROM Student_Inquiry WHERE OnlineState IS NOT NULL
      `);
      console.log(`  Student_Inquiry (OnlineState SET) : ${si} rows`);

      const [{ n: si2 }] = await ro(newConn, `
        SELECT COUNT(*) AS n FROM Student_Inquiry
      `);
      console.log(`  Student_Inquiry (total)            : ${si2} rows`);
    } catch (e) {
      console.log(`  Student_Inquiry check failed: ${e.message}`);
    }

    try {
      const [{ n: am }] = await ro(newConn, `
        SELECT COUNT(*) AS n FROM admission_master
        WHERE (IsDelete = 0 OR IsDelete IS NULL)
      `);
      console.log(`  admission_master (live) : ${am} rows`);
    } catch (e) {
      console.log(`  admission_master check failed: ${e.message}`);
    }

    /* ─── 5. Diff: what's only in OLD ───────────────────────────────── */
    header('5. POTENTIAL GAP — Inquiry_Ids in OLD but missing in NEW');
    try {
      const [{ n: oldOnline }] = await ro(oldConn, `
        SELECT COUNT(*) AS n FROM Student_Inquiry WHERE OnlineState IS NOT NULL
      `);
      console.log(`  OLD Student_Inquiry.OnlineState NOT NULL : ${oldOnline}`);

      const oldIds = await ro(oldConn, `
        SELECT Inquiry_Id FROM Student_Inquiry WHERE OnlineState IS NOT NULL
      `);

      // batched IN check (limit 5000 per chunk)
      let missing = 0, presentInNew = 0;
      const ids = oldIds.map(r => r.Inquiry_Id);
      for (let i = 0; i < ids.length; i += 5000) {
        const chunk = ids.slice(i, i + 5000);
        if (!chunk.length) continue;
        const placeholders = chunk.map(() => '?').join(',');
        const found = await ro(newConn,
          `SELECT Inquiry_Id FROM Student_Inquiry WHERE Inquiry_Id IN (${placeholders})`,
          chunk);
        const foundSet = new Set(found.map(r => r.Inquiry_Id));
        presentInNew += foundSet.size;
        missing += chunk.length - foundSet.size;
      }
      console.log(`  Already in NEW Student_Inquiry          : ${presentInNew}`);
      console.log(`  Missing from NEW Student_Inquiry        : ${missing}`);
    } catch (e) {
      console.log(`  Gap check failed: ${e.message}`);
    }

    console.log('\n' + hr('═'));
    console.log('  Inspection complete.');
    console.log(hr('═') + '\n');
  } finally {
    await oldConn.end();
    await newConn.end();
  }
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
