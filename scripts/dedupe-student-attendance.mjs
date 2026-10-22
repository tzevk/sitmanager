/**
 * Remove duplicate student_attendance rows and add the uq_attendance unique key.
 *
 *   node scripts/dedupe-student-attendance.mjs           # dry run: counts only
 *   node scripts/dedupe-student-attendance.mjs --apply   # backup, delete, add key
 *
 * Production never had uq_attendance (Batch_Id, Student_Id, Attendance_Date, Session)
 * — ensureAttendanceTable() can't add it while duplicates exist — so re-saves
 * inserted extra rows. Per key we keep the newest row with a non-blank Status
 * (falling back to the newest row): that is the last value staff saved, and what
 * the Attendance Taken page already treats as effective.
 *
 * Every deleted row is first copied into student_attendance_duplicate_backup_<YYYYMMDD>,
 * so the cleanup can be reversed with INSERT INTO student_attendance SELECT * FROM <backup>.
 */

import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

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

const apply = process.argv.includes('--apply');
const env = loadEnv(resolve(__dir, '../.env.local'));
const conn = await mysql.createConnection({
  host: env.DB_HOST, port: parseInt(env.DB_PORT || '3306', 10),
  database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD,
  dateStrings: true, connectTimeout: 30_000,
});

const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const backupTable = `student_attendance_duplicate_backup_${stamp}`;

// Ids of every row that is NOT its key's keeper.
const LOSERS = `
  SELECT sa.Attendance_Id
  FROM student_attendance sa
  JOIN (
    SELECT Batch_Id, Student_Id, Attendance_Date, Session,
           COALESCE(MAX(CASE WHEN Status <> '' THEN Attendance_Id END), MAX(Attendance_Id)) AS keep_id
    FROM student_attendance
    GROUP BY Batch_Id, Student_Id, Attendance_Date, Session
    HAVING COUNT(*) > 1
  ) k ON k.Batch_Id = sa.Batch_Id AND k.Student_Id = sa.Student_Id
     AND k.Attendance_Date = sa.Attendance_Date AND k.Session = sa.Session
  WHERE sa.Attendance_Id <> k.keep_id`;

try {
  const [[before]] = await conn.query(`SELECT COUNT(*) AS total FROM student_attendance`);
  const [[dup]] = await conn.query(`SELECT COUNT(*) AS n FROM (${LOSERS}) x`);
  console.log(`student_attendance: ${before.total} rows, ${dup.n} duplicate rows to remove`);

  if (!apply) {
    console.log('Dry run — pass --apply to back up, delete and add uq_attendance.');
  } else {
    if (Number(dup.n) > 0) {
      await conn.query(`CREATE TABLE IF NOT EXISTS \`${backupTable}\` LIKE student_attendance`);
      await conn.beginTransaction();
      const [ins] = await conn.query(
        `INSERT IGNORE INTO \`${backupTable}\` SELECT sa.* FROM student_attendance sa
         JOIN (${LOSERS}) l ON l.Attendance_Id = sa.Attendance_Id`
      );
      const [del] = await conn.query(
        `DELETE sa FROM student_attendance sa
         JOIN \`${backupTable}\` b ON b.Attendance_Id = sa.Attendance_Id`
      );
      if (del.affectedRows !== ins.affectedRows) {
        throw new Error(`Deleted ${del.affectedRows} rows but backed up ${ins.affectedRows} — rolling back`);
      }
      await conn.commit();
      console.log(`Backed up ${ins.affectedRows} rows to ${backupTable}, deleted ${del.affectedRows}`);
    }

    const [[idx]] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_attendance' AND INDEX_NAME = 'uq_attendance'`
    );
    if (!Number(idx.cnt)) {
      await conn.query(
        `ALTER TABLE student_attendance
         ADD UNIQUE KEY uq_attendance (Batch_Id, Student_Id, Attendance_Date, Session),
         ALGORITHM=INPLACE, LOCK=NONE`
      );
      console.log('Added unique key uq_attendance');
    }

    const [[after]] = await conn.query(`SELECT COUNT(*) AS total FROM student_attendance`);
    const [[left]] = await conn.query(`SELECT COUNT(*) AS n FROM (${LOSERS}) x`);
    console.log(`student_attendance now: ${after.total} rows, ${left.n} duplicates left`);
  }
} catch (err) {
  await conn.rollback().catch(() => {});
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
