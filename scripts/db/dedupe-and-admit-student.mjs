/**
 * Dedupe a duplicated student into a single record and (optionally) make them
 * appear in the Student Master list.
 *
 *  - Soft-deletes the duplicate row (student_master.IsDelete = 1).
 *  - Sets the survivor to Status_id = 8 ("Admission Taken").
 *  - Creates a minimal active admission_master row for the survivor if none
 *    exists, so the row satisfies the student-list filter
 *    (am.IsActive=1, am.IsDelete=0, sm.Status_id=8 — see
 *    app/api/admission-activity/student/route.ts).
 *
 * Batch_Id / Course_Id for the admission are derived from the survivor's
 * student_master.Batch_Code via batch_mst. No fees/amount are invented.
 *
 * Usage:
 *   node scripts/db/dedupe-and-admit-student.mjs --survivor 176540 --remove 176538 [--apply]
 * Dry-run (default) prints the intended actions without writing.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const num = (flag) => { const i = args.indexOf(flag); return i >= 0 ? parseInt(args[i + 1], 10) : NaN; };
const survivor = num('--survivor');
const remove = num('--remove');

if (!Number.isInteger(survivor) || !Number.isInteger(remove)) {
  console.error('Provide --survivor <id> --remove <id>');
  process.exit(1);
}

const c = await mysql.createConnection({
  host: process.env.DB_HOST, port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, dateStrings: true,
});

console.log(`Mode: ${apply ? 'APPLY (writing)' : 'DRY-RUN (no writes)'}  survivor=${survivor} remove=${remove}`);

// Resolve Course_Id / Batch_Id from the survivor's Batch_Code.
const [[sm]] = [await c.query('SELECT Student_Id, Student_Name, Course_Id, Batch_Code, Status_id FROM student_master WHERE Student_Id = ?', [survivor])];
const surv = sm[0];
if (!surv) { console.error('Survivor not found'); process.exit(1); }
const [batchRows] = await c.query('SELECT Batch_Id, Course_Id FROM batch_mst WHERE Batch_code = ? LIMIT 1', [surv.Batch_Code]);
const batchId = batchRows[0]?.Batch_Id ?? null;
const courseId = surv.Course_Id ?? batchRows[0]?.Course_Id ?? null;

const [exist] = await c.query('SELECT Admission_Id FROM admission_master WHERE Student_Id = ? AND IsDelete = 0 AND IsActive = 1 LIMIT 1', [survivor]);
const hasAdmission = exist.length > 0;

console.log('Plan:');
console.log(`  1. student_master[${remove}].IsDelete = 1   (soft-delete duplicate)`);
console.log(`  2. student_master[${survivor}].Status_id = 8 (Admission Taken)  [was ${surv.Status_id}]`);
console.log(`  3. ${hasAdmission ? 'admission already exists — skip insert' : `INSERT admission_master (Student_Id=${survivor}, Course_Id=${courseId}, Batch_Id=${batchId}, Admission_Date=CURDATE(), IsActive=1, IsDelete=0)`}`);

if (!apply) { console.log('\nDry-run only. Re-run with --apply to execute.'); await c.end(); process.exit(0); }

await c.beginTransaction();
try {
  await c.query('UPDATE student_master SET IsDelete = 1 WHERE Student_Id = ?', [remove]);
  await c.query('UPDATE student_master SET Status_id = 8 WHERE Student_Id = ?', [survivor]);
  if (!hasAdmission) {
    await c.query(
      `INSERT INTO admission_master (Student_Id, Course_Id, Batch_Id, Admission_Date, IsActive, IsDelete, Cancel)
       VALUES (?, ?, ?, CURDATE(), 1, 0, NULL)`,
      [survivor, courseId, batchId]
    );
  }
  await c.commit();
  console.log('\nApplied successfully.');
} catch (e) {
  await c.rollback();
  console.error('Rolled back:', e.message);
  process.exit(1);
}
await c.end();
