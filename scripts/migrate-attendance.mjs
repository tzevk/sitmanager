/**
 * Attendance migration: OLD DB → NEW DB student_attendance
 *
 *   node scripts/migrate-attendance.mjs                                   # dry-run, strict
 *   node scripts/migrate-attendance.mjs --commit                          # write strict (~400 rows)
 *   node scripts/migrate-attendance.mjs --allow-null-admission            # dry-run, permissive
 *   node scripts/migrate-attendance.mjs --commit --allow-null-admission   # write permissive (~337k rows)
 *   node scripts/migrate-attendance.mjs --commit --since=2020-01-01
 *
 * MODES:
 *   strict (default)         — Requires admission_master match; skips ~99% of OLD rows
 *                              because most historical attendance has no admission record.
 *   --allow-null-admission   — Inserts with Admission_Id = NULL when no match; required to
 *                              actually migrate ALL the data. Will ALTER the column to nullable
 *                              on first --commit run. Reports must use LEFT JOIN admission_master.
 *
 * SOURCE  : OLD `Lecture_taken_child` JOIN `Batch_Lecture_Master`
 *           - Lecture_taken_child : per-student rows (Student_Id, Student_Atten, In/Out_Time, Late)
 *           - Batch_Lecture_Master : batch_id + date per lecture (joined via Take_Id = id)
 *
 * DESTINATION : NEW `student_attendance` (Batch_Id, Student_Id, Admission_Id,
 *               Attendance_Date, Session, In_Time, Out_Time, Status, Remarks)
 *
 * MAPPING:
 *   Status     = Present + Late=Yes → 'L', Present → 'P', Absent → 'A'
 *   Session    = In_Time hour < 13 → 'first_half', else 'second_half'
 *   In_Time    = "5:31 PM" → "17:31:00"  (loose parser, NULL on failure)
 *
 * IDEMPOTENT via unique key (Batch_Id, Student_Id, Attendance_Date, Session) —
 * INSERT IGNORE skips duplicates so re-runs are safe.
 */

import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir   = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');

function loadEnv(p) {
  const env = {};
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const t = l.trim(); if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('='); if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}

const env = loadEnv(envPath);
const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const ALLOW_NULL_ADM = args.includes('--allow-null-admission');
const sinceArg = args.find(a => a.startsWith('--since='));
const SINCE = sinceArg ? sinceArg.slice('--since='.length) : null;

const OLD_CFG = {
  host: env.OLD_DB_HOST, port: parseInt(env.OLD_DB_PORT || '3306', 10),
  database: env.OLD_DB_NAME, user: env.OLD_DB_USER, password: env.OLD_DB_PASSWORD,
  dateStrings: true, connectTimeout: 30_000,
};
const NEW_CFG = {
  host: env.DB_HOST, port: parseInt(env.DB_PORT || '3306', 10),
  database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD,
  dateStrings: true, connectTimeout: 30_000,
  multipleStatements: false,
};

const READ_ONLY_RE = /^(with|select|show|describe|desc|explain)\b/i;
function assertReadOnly(sql) {
  const s = String(sql).replace(/^(\s|\/\*[\s\S]*?\*\/|--[^\n]*\n|#[^\n]*\n)*/, '').trim();
  if (!READ_ONLY_RE.test(s)) throw new Error(`[SAFETY] non-read query blocked: ${s.slice(0, 80)}`);
}

function hr(c = '─', w = 78) { return c.repeat(w); }
function pad(n, w = 8) { return String(n).padStart(w); }

/* Parse "5:31 PM" / "2:36PM" / "10:56 AM" / "5:00 PM" → "HH:MM:00" or null. */
function parseTime(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s.toLowerCase() === 'null') return null;
  // Tolerate a wide range of separators / no spaces
  const m = s.match(/^(\d{1,2})\s*[:.]?\s*(\d{0,2})\s*([APap][Mm])?$/);
  if (!m) {
    // Already 24h "08:30" or "08:30:00"
    const m2 = s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (!m2) return null;
    const hh = Math.min(23, parseInt(m2[1], 10));
    const mm = Math.min(59, parseInt(m2[2], 10));
    const ss = m2[3] ? Math.min(59, parseInt(m2[3], 10)) : 0;
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  }
  let hh = parseInt(m[1], 10);
  const mm = m[2] ? parseInt(m[2], 10) : 0;
  const mer = (m[3] || '').toUpperCase();
  if (mer === 'PM' && hh < 12) hh += 12;
  if (mer === 'AM' && hh === 12) hh = 0;
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`;
}

function deriveStatus(atten, late) {
  const a = String(atten || '').trim().toLowerCase();
  const l = String(late || '').trim().toLowerCase();
  if (a === 'present') return l === 'yes' ? 'L' : 'P';
  if (a === 'absent')  return 'A';
  return null;
}

function deriveSession(timeStr) {
  if (!timeStr) return 'first_half';
  const hh = parseInt(timeStr.slice(0, 2), 10);
  return hh < 13 ? 'first_half' : 'second_half';
}

async function ensureAdmissionNullable(newConn) {
  const [cols] = await newConn.query(`
    SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_attendance' AND COLUMN_NAME = 'Admission_Id'
  `);
  const isNullable = cols[0]?.IS_NULLABLE === 'YES';
  if (isNullable) {
    console.log('  student_attendance.Admission_Id : already NULL (no schema change needed)');
    return;
  }
  if (!COMMIT) {
    console.log('  student_attendance.Admission_Id : currently NOT NULL — will ALTER on --commit');
    return;
  }
  process.stdout.write('  ALTERing student_attendance.Admission_Id → NULL ... ');
  await newConn.query(`ALTER TABLE student_attendance MODIFY COLUMN Admission_Id INT NULL`);
  console.log('OK');
}

async function main() {
  console.log(hr('═'));
  console.log(`  ATTENDANCE MIGRATION  [${COMMIT ? '⚡ COMMIT' : '🔍 DRY-RUN'}]${ALLOW_NULL_ADM ? ' [permissive]' : ' [strict]'}${SINCE ? ` (since ${SINCE})` : ''}`);
  console.log(`  OLD : ${OLD_CFG.user}@${OLD_CFG.host}/${OLD_CFG.database}`);
  console.log(`  NEW : ${NEW_CFG.user}@${NEW_CFG.host}/${NEW_CFG.database}`);
  console.log(hr('═'));

  process.stdout.write('  Connecting OLD ... ');
  const oldConn = await mysql.createConnection(OLD_CFG);
  console.log('OK');
  process.stdout.write('  Connecting NEW ... ');
  const newConn = await mysql.createConnection(NEW_CFG);
  console.log('OK');

  if (ALLOW_NULL_ADM) {
    await ensureAdmissionNullable(newConn);
  }

  /* 1. Build Admission_Id lookup map: (Student_Id, Batch_Id) → Admission_Id */
  process.stdout.write('  Loading admission_master index from NEW ... ');
  const [admRows] = await newConn.query(`
    SELECT Admission_Id, Student_Id, Batch_Id
    FROM admission_master
    WHERE (IsDelete = 0 OR IsDelete IS NULL)
  `);
  const admMap = new Map();
  for (const r of admRows) {
    admMap.set(`${r.Student_Id}|${r.Batch_Id}`, r.Admission_Id);
  }
  console.log(`${admRows.length} live admissions indexed`);

  /* 2. Stream OLD rows in chunks ordered so 'Present' wins over 'Absent' on
        unique-key collisions for the same student/day/session. */
  const sinceClause = SINCE ? `AND blm.date >= ${mysql.escape(SINCE)}` : '';

  const [{ n: total }] = (await (async () => {
    const sql = `
      SELECT COUNT(*) AS n
      FROM Lecture_taken_child ltc
      INNER JOIN Batch_Lecture_Master blm ON blm.id = ltc.Take_Id
      WHERE (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)
        AND blm.date REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        AND ltc.Student_Id IS NOT NULL
        AND ltc.Student_Atten IN ('Present','Absent')
        ${sinceClause}
    `;
    assertReadOnly(sql);
    const [rows] = await oldConn.query(sql);
    return [rows[0]];
  })());
  console.log(`  OLD candidate rows : ${total}`);

  if (!total) { console.log('\n  Nothing to migrate.'); await oldConn.end(); await newConn.end(); return; }

  const stats = {
    read: 0, parsed: 0,
    noAdmission: 0, badTime: 0, badStatus: 0,
    inserted: 0, skippedDup: 0, errors: 0,
  };

  const BATCH = 500;
  let lastReportAt = Date.now();

  // Stream by ID range to keep memory bounded
  const [{ minId, maxId }] = (await oldConn.query(`
    SELECT MIN(ID) AS minId, MAX(ID) AS maxId FROM Lecture_taken_child
  `))[0];

  // Iterate by chunked ID windows for stability
  const WINDOW = 50_000;
  for (let lo = minId; lo <= maxId; lo += WINDOW) {
    const hi = Math.min(lo + WINDOW - 1, maxId);
    const sql = `
      SELECT
        ltc.ID, ltc.Student_Id, ltc.Student_Atten, ltc.In_Time, ltc.Out_Time, ltc.Late,
        blm.batch_id AS batch_id, blm.date AS lecture_date
      FROM Lecture_taken_child ltc
      INNER JOIN Batch_Lecture_Master blm ON blm.id = ltc.Take_Id
      WHERE ltc.ID BETWEEN ? AND ?
        AND (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)
        AND blm.date REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        AND ltc.Student_Id IS NOT NULL
        AND ltc.Student_Atten IN ('Present','Absent')
        ${sinceClause}
      ORDER BY ltc.Student_Atten ASC -- 'Absent' < 'Present' alphabetically; reverse:
    `;
    // We want Present first so it wins INSERT IGNORE. ASCII 'A' < 'P', so DESC.
    const sqlPresentFirst = sql.replace('ASC -- ', 'DESC -- ');
    assertReadOnly(sqlPresentFirst);
    const [chunk] = await oldConn.query(sqlPresentFirst, [lo, hi]);

    /* Build batch insert */
    const values = [];
    for (const r of chunk) {
      stats.read++;
      const status = deriveStatus(r.Student_Atten, r.Late);
      if (!status) { stats.badStatus++; continue; }
      const inTime  = parseTime(r.In_Time);
      const outTime = parseTime(r.Out_Time);
      // Bad time isn't fatal — we just store NULL. Only count if both bad.
      if (!inTime && !outTime && (r.In_Time || r.Out_Time)) stats.badTime++;
      const session = deriveSession(inTime || outTime);
      const studentId = Number(r.Student_Id);
      const batchId   = Number(r.batch_id);
      if (!Number.isFinite(studentId) || !Number.isFinite(batchId)) { stats.badStatus++; continue; }
      const admissionId = admMap.get(`${studentId}|${batchId}`) ?? null;
      if (!admissionId) {
        stats.noAdmission++;
        if (!ALLOW_NULL_ADM) continue; // strict mode: skip
      }
      stats.parsed++;
      values.push([batchId, studentId, admissionId, r.lecture_date, session, inTime, outTime, status, null]);
    }

    /* Insert batches */
    if (COMMIT && values.length) {
      for (let i = 0; i < values.length; i += BATCH) {
        const slice = values.slice(i, i + BATCH);
        try {
          const [res] = await newConn.query(
            `INSERT IGNORE INTO student_attendance
             (Batch_Id, Student_Id, Admission_Id, Attendance_Date, Session, In_Time, Out_Time, Status, Remarks)
             VALUES ?`,
            [slice]
          );
          stats.inserted += res.affectedRows ?? 0;
          stats.skippedDup += slice.length - (res.affectedRows ?? 0);
        } catch (e) {
          stats.errors += slice.length;
          console.warn(`    insert error: ${e.message}`);
        }
      }
    }

    /* Progress report every ~3 seconds */
    if (Date.now() - lastReportAt > 3000) {
      console.log(`    ID ${pad(lo,9)} → ${pad(hi,9)} | read=${pad(stats.read,8)} parsed=${pad(stats.parsed,8)} ${COMMIT ? `inserted=${pad(stats.inserted,8)}` : ''}`);
      lastReportAt = Date.now();
    }
  }

  /* Summary */
  console.log('\n' + hr('═'));
  console.log('  SUMMARY');
  console.log(hr('═'));
  console.log(`  Mode                         : ${COMMIT ? '⚡ COMMIT' : '🔍 DRY-RUN'} ${ALLOW_NULL_ADM ? '(permissive)' : '(strict)'}`);
  console.log(`  OLD candidate rows           : ${pad(total)}`);
  console.log(`  Rows read                    : ${pad(stats.read)}`);
  console.log(`  Rows parsed (would insert)   : ${pad(stats.parsed)}`);
  console.log(`  Rows w/ no Admission_Id      : ${pad(stats.noAdmission)}  ${ALLOW_NULL_ADM ? '(inserted with NULL)' : '(skipped — strict mode)'}`);
  console.log(`  Skipped — bad time format    : ${pad(stats.badTime)}`);
  console.log(`  Skipped — bad status         : ${pad(stats.badStatus)}`);
  if (COMMIT) {
    console.log(hr('─'));
    console.log(`  Inserted                     : ${pad(stats.inserted)}`);
    console.log(`  Skipped duplicates (existed) : ${pad(stats.skippedDup)}`);
    console.log(`  Errors                       : ${pad(stats.errors)}`);
  } else {
    console.log(`\n  Run again with --commit to actually write to the new DB.`);
  }
  console.log(hr('═'));

  await oldConn.end();
  await newConn.end();
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
