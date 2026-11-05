/**
 * Fills the missing course on FY 2026-27 admissions from the admission's own batch.
 *
 *   node scripts/db/fill-admission-course-from-batch.mjs --dry-run   # show what would change
 *   node scripts/db/fill-admission-course-from-batch.mjs             # apply (with backup table)
 *
 * Only touches admission_master rows dated from 2026-04-01 with Course_Id NULL/0 whose batch has a
 * course. The old values are copied to admission_master_course_fill_bak_20261105 first; the update
 * runs in a transaction and rolls back if the row count does not match the backup.
 * Admissions with no batch are listed at the end; they need a course picked by hand.
 * (admission_master is not touched by any legacy sync, so the fill stays.)
 */
import mysql from 'mysql2/promise';
import fs from 'fs';

for (const l of fs.readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const dryRun = process.argv.includes('--dry-run');
const c = await mysql.createConnection({
  host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, port: +(process.env.DB_PORT || 3306),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
});

const WHERE = `am.IsDelete = 0 AND am.Admission_Date >= '2026-04-01'
  AND (am.Course_Id IS NULL OR am.Course_Id = 0) AND b.Course_Id > 0`;

const [todo] = await c.query(
  `SELECT am.Admission_Id, am.Student_Id, sm.Student_Name, b.Batch_code, cm.Course_Name
     FROM admission_master am
     JOIN batch_mst b ON b.Batch_Id = am.Batch_Id
     LEFT JOIN course_mst cm ON cm.Course_Id = b.Course_Id
     LEFT JOIN student_master sm ON sm.Student_Id = am.Student_Id
    WHERE ${WHERE}
    ORDER BY am.Admission_Date`
);
console.table(todo);
console.log(`${todo.length} admission(s) can be filled from their batch.`);

if (!dryRun && todo.length) {
  await c.query(
    `CREATE TABLE IF NOT EXISTS admission_master_course_fill_bak_20261105 AS
     SELECT am.Admission_Id, am.Student_Id, am.Course_Id, am.Batch_Id, NOW() AS backed_up_at
       FROM admission_master am JOIN batch_mst b ON b.Batch_Id = am.Batch_Id WHERE ${WHERE}`
  );
  await c.beginTransaction();
  const [u] = await c.query(
    `UPDATE admission_master am JOIN batch_mst b ON b.Batch_Id = am.Batch_Id SET am.Course_Id = b.Course_Id WHERE ${WHERE}`
  );
  if (u.affectedRows !== todo.length) {
    await c.rollback();
    throw new Error(`Expected ${todo.length} rows, got ${u.affectedRows}. Rolled back.`);
  }
  // Same gap on the student record (Course_Id 0) for students in this set.
  const [u2] = await c.query(
    `UPDATE student_master sm JOIN batch_mst b ON b.Batch_code = sm.Batch_Code
        SET sm.Course_Id = b.Course_Id
      WHERE sm.Student_Id IN (?) AND (sm.Course_Id IS NULL OR sm.Course_Id = 0) AND b.Course_Id > 0`,
    [todo.map((r) => r.Student_Id)]
  );
  await c.commit();
  console.log(`Updated ${u.affectedRows} admission(s) and ${u2.affectedRows} student record(s). Backup: admission_master_course_fill_bak_20261105`);
  await c.query(
    `INSERT INTO software_changelog (Title, Description, Category, Author, Created_Date)
     VALUES (?, ?, 'Fix', 'System', NOW())`,
    ['Filled missing course on FY 2026-27 admissions',
     `${u.affectedRows} admissions had no course; it was filled from each admission's batch (backup table admission_master_course_fill_bak_20261105).`]
  ).catch(() => console.log('(changelog entry not written; log it manually)'));
}

const [left] = await c.query(
  `SELECT am.Admission_Id, am.Student_Id, sm.Student_Name, DATE_FORMAT(am.Admission_Date, '%Y-%m-%d') AS Admission_Date, sm.Present_Mobile
     FROM admission_master am
     LEFT JOIN course_mst cm ON cm.Course_Id = am.Course_Id
     LEFT JOIN batch_mst b ON b.Batch_Id = am.Batch_Id
     LEFT JOIN student_master sm ON sm.Student_Id = am.Student_Id
    WHERE am.IsDelete = 0 AND am.Admission_Date >= '2026-04-01' AND cm.Course_Id IS NULL
      AND NOT (COALESCE(b.Course_Id, 0) > 0)`
);
console.log('Need a course picked by hand (no batch on the admission):');
console.table(left);
await c.end();
