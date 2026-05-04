/**
 * Inspect OLD DB for attendance data.
 *
 *   node scripts/inspect-attendance.mjs
 *
 * Read-only. Discovers what tables and columns hold student attendance in the
 * OLD DB, prints schema and samples, and cross-checks against NEW DB so we can
 * plan a migration before writing one.
 *
 * Pipe to a file for review:
 *   node scripts/inspect-attendance.mjs > attendance-inspection.txt
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
function header(label) { console.log('\n' + hr('═')); console.log('  ' + label); console.log(hr('═')); }
function sub(label)    { console.log('\n' + hr());     console.log('  ' + label); console.log(hr()); }

async function main() {
  console.log(hr('═'));
  console.log('  ATTENDANCE — OLD DB INSPECTION');
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
    /* ─── 1. Find attendance-related tables in OLD DB ──────────────── */
    header('1. CANDIDATE TABLES IN OLD DB');

    const tables = await ro(oldConn, `
      SELECT TABLE_NAME, TABLE_ROWS, ENGINE, CREATE_TIME, UPDATE_TIME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ?
        AND (
          TABLE_NAME LIKE '%attendance%'
          OR TABLE_NAME LIKE '%attend%'
          OR TABLE_NAME LIKE '%present%'
          OR TABLE_NAME LIKE '%absent%'
        )
      ORDER BY TABLE_NAME
    `, [OLD_CFG.database]);

    for (const t of tables) {
      console.log(`  ${(t.TABLE_NAME + ' ').padEnd(48, '.')} ${String(t.TABLE_ROWS ?? '?').padStart(10)} rows  [${t.ENGINE}]`);
    }
    if (!tables.length) console.log('  (no matching tables found)');

    /* ─── 2. Detail each candidate table ───────────────────────────── */
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
        console.log(`    - ${c.COLUMN_NAME.padEnd(30)} ${c.COLUMN_TYPE.padEnd(28)} ${nn} ${k}`);
      }

      try {
        const [{ n }] = await ro(oldConn, `SELECT COUNT(*) AS n FROM \`${t.TABLE_NAME}\``);
        console.log(`  Actual row count: ${n}`);
      } catch (e) { console.log(`  Row count: (failed: ${e.message})`); }

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
        } else { console.log('  (table is empty)'); }
      } catch (e) { console.log(`  Sample failed: ${e.message}`); }

      // Date range and per-year distribution
      const dateColCandidates = cols
        .filter(c => /date|attend/i.test(c.COLUMN_NAME) && /date|datetime|timestamp|varchar/i.test(c.COLUMN_TYPE))
        .map(c => c.COLUMN_NAME);
      for (const dc of dateColCandidates) {
        try {
          const range = await ro(oldConn,
            `SELECT MIN(\`${dc}\`) AS mn, MAX(\`${dc}\`) AS mx FROM \`${t.TABLE_NAME}\``);
          console.log(`  Range of ${dc}: ${range[0]?.mn} → ${range[0]?.mx}`);
        } catch (e) { /* ignore */ }
      }
    }

    /* ─── 3. Status column distribution (if attendance-shaped table found) ─ */
    const candidate = tables.find(t => /attendance/i.test(t.TABLE_NAME));
    if (candidate) {
      header(`3. STATUS DISTRIBUTION IN OLD ${candidate.TABLE_NAME}`);
      try {
        // Try common status column names
        const statusCols = ['Status', 'status', 'attend_status', 'Attend_Status', 'Type', 'type'];
        for (const col of statusCols) {
          try {
            const dist = await ro(oldConn,
              `SELECT \`${col}\` AS v, COUNT(*) AS n
               FROM \`${candidate.TABLE_NAME}\`
               GROUP BY \`${col}\` ORDER BY n DESC LIMIT 10`);
            if (dist.length) {
              console.log(`  ${col} distribution:`);
              for (const r of dist) console.log(`    ${String(r.v ?? 'NULL').padEnd(20)} → ${r.n}`);
              break;
            }
          } catch { /* try next */ }
        }
      } catch (e) { console.log(`  (failed: ${e.message})`); }
    }

    /* ─── 4. NEW DB current state ──────────────────────────────────── */
    header('4. CURRENT STATE OF NEW DB');
    try {
      const [{ n }] = await ro(newConn, `SELECT COUNT(*) AS n FROM student_attendance`);
      console.log(`  student_attendance (total)              : ${n}`);
      const [{ n: live }] = await ro(newConn, `
        SELECT COUNT(*) AS n FROM student_attendance WHERE (IsDelete = 0 OR IsDelete IS NULL)
      `);
      console.log(`  student_attendance (IsDelete=0)         : ${live}`);
      const range = await ro(newConn, `
        SELECT MIN(Attendance_Date) AS mn, MAX(Attendance_Date) AS mx FROM student_attendance
      `);
      console.log(`  Attendance_Date range                   : ${range[0]?.mn} → ${range[0]?.mx}`);
      const dist = await ro(newConn, `
        SELECT Status, COUNT(*) AS n FROM student_attendance GROUP BY Status ORDER BY n DESC
      `);
      console.log('  Status distribution:');
      for (const r of dist) console.log(`    ${String(r.Status ?? 'NULL').padEnd(8)} → ${r.n}`);

      const sessions = await ro(newConn, `
        SELECT Session, COUNT(*) AS n FROM student_attendance GROUP BY Session
      `);
      console.log('  Session distribution:');
      for (const r of sessions) console.log(`    ${String(r.Session ?? 'NULL').padEnd(15)} → ${r.n}`);
    } catch (e) {
      console.log(`  (NEW student_attendance not found / failed: ${e.message})`);
    }

    /* ─── 5. Gap estimate: rows in OLD that aren't in NEW ──────────── */
    if (candidate) {
      header(`5. GAP — rows in OLD ${candidate.TABLE_NAME} not in NEW student_attendance`);
      try {
        const cols = await ro(oldConn, `
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        `, [OLD_CFG.database, candidate.TABLE_NAME]);
        const colSet = new Set(cols.map(c => c.COLUMN_NAME));
        const has = (n) => colSet.has(n);

        // Pick best dedupe key: (Student_Id, Batch_Id, Attendance_Date)
        const stuCol = has('Student_Id') ? 'Student_Id' : has('student_id') ? 'student_id' : null;
        const dateCol = has('Attendance_Date') ? 'Attendance_Date'
                      : has('attendance_date') ? 'attendance_date'
                      : has('Attend_Date') ? 'Attend_Date'
                      : has('Date') ? 'Date' : null;
        const batchCol = has('Batch_Id') ? 'Batch_Id' : has('batch_id') ? 'batch_id' : null;

        if (!stuCol || !dateCol) {
          console.log(`  Cannot infer key columns; needed Student_Id + date col. Found: stu=${stuCol}, date=${dateCol}, batch=${batchCol}`);
        } else {
          const [{ n: oldTotal }] = await ro(oldConn, `SELECT COUNT(*) AS n FROM \`${candidate.TABLE_NAME}\``);
          console.log(`  OLD ${candidate.TABLE_NAME} total: ${oldTotal}`);

          // Sample 5000 keys, check overlap
          const sampleSize = Math.min(5000, oldTotal);
          const keys = await ro(oldConn, `
            SELECT \`${stuCol}\` AS sid,
                   ${batchCol ? `\`${batchCol}\` AS bid,` : 'NULL AS bid,'}
                   \`${dateCol}\` AS d
            FROM \`${candidate.TABLE_NAME}\`
            ORDER BY RAND() LIMIT ${sampleSize}
          `);
          let foundCount = 0, missingCount = 0;
          for (let i = 0; i < keys.length; i += 200) {
            const chunk = keys.slice(i, i + 200);
            const conds = chunk.map(() => batchCol
              ? '(Student_Id = ? AND Batch_Id = ? AND Attendance_Date = ?)'
              : '(Student_Id = ? AND Attendance_Date = ?)').join(' OR ');
            const params = chunk.flatMap(k => batchCol ? [k.sid, k.bid, k.d] : [k.sid, k.d]);
            const [{ n: hits }] = await ro(newConn,
              `SELECT COUNT(*) AS n FROM student_attendance WHERE ${conds}`, params);
            foundCount += hits;
            missingCount += chunk.length - hits;
          }
          console.log(`  Sampled ${keys.length} OLD rows.`);
          console.log(`  Already present in NEW : ${foundCount}`);
          console.log(`  Missing from NEW       : ${missingCount}`);
          const pct = keys.length ? Math.round((missingCount / keys.length) * 100) : 0;
          console.log(`  Estimated missing %    : ${pct}% → roughly ${Math.round(oldTotal * pct / 100)} of ${oldTotal} total`);
        }
      } catch (e) {
        console.log(`  Gap check failed: ${e.message}`);
      }
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
