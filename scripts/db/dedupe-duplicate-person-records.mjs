/**
 * Clean up duplicate PERSON records surfacing in Student Master search: the same
 * name+mobile exists as multiple, separate student_master rows (different
 * Student_Ids — not just duplicate admission rows on one student, which
 * dedupe-duplicate-admissions.mjs already handles), each with its own active
 * admission_master row. Root cause looks like repeated/duplicate online-admission
 * form submissions, each creating a brand-new student + admission.
 *
 * Only touches the SAFE subset: groups where exactly one record has
 * Status_id=8 (genuinely admitted) and the rest are still at an inquiry-stage
 * Status_id (3, 5, 9, etc) — i.e. unambiguous junk duplicates of an already-admitted
 * student, not two independently-admitted people who happen to share a name.
 * Groups with more than one Status_id=8 record are left untouched — those need a
 * human to confirm whether they're a genuine re-enrollment (same person, different
 * year/course) or an actual duplicate that would need a real records merge.
 *
 * Some duplicates have their own linked s_fees_mst / student_attendance rows, so
 * this re-points those onto the kept (Status_id=8) admission before soft-deleting
 * (IsDelete=1, nothing destroyed) the duplicate admission_master row. student_master
 * rows themselves are left alone (still queryable for inquiry history) — only their
 * admission is retired, which is what makes them disappear from Student Master.
 *
 * Usage:
 *   node scripts/db/dedupe-duplicate-person-records.mjs           (dry run)
 *   node scripts/db/dedupe-duplicate-person-records.mjs --apply   (writes)
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const apply = process.argv.includes('--apply');
const CHILD_TABLES = ['s_fees_mst', 'student_attendance', 'fees_details', 'viva_moc_child'];

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  });

  console.log(`Mode: ${apply ? 'APPLY (writing)' : 'DRY-RUN (no writes)'}`);

  const [groups] = await pool.query(`
    SELECT sm.Student_Name, sm.Present_Mobile, COUNT(DISTINCT sm.Student_Id) c
    FROM student_master sm
    JOIN admission_master am ON am.Student_Id = sm.Student_Id AND am.IsDelete = 0 AND am.IsActive = 1
    WHERE (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
      AND sm.Student_Name IS NOT NULL AND sm.Student_Name <> ''
      AND sm.Present_Mobile IS NOT NULL AND sm.Present_Mobile <> ''
    GROUP BY sm.Student_Name, sm.Present_Mobile
    HAVING COUNT(DISTINCT sm.Student_Id) > 1
  `);

  let cleanGroups = 0;
  let ambiguousGroups = 0;
  let totalReassigned = 0;
  let totalSoftDeleted = 0;

  for (const g of groups) {
    const [rows] = await pool.query(
      `SELECT sm.Student_Id, sm.Status_id, am.Admission_Id
       FROM student_master sm
       JOIN admission_master am ON am.Student_Id = sm.Student_Id AND am.IsDelete = 0 AND am.IsActive = 1
       WHERE sm.Student_Name = ? AND sm.Present_Mobile = ?`,
      [g.Student_Name, g.Present_Mobile]
    );
    const admitted = rows.filter((r) => Number(r.Status_id) === 8);
    const others = rows.filter((r) => Number(r.Status_id) !== 8);

    if (admitted.length !== 1 || others.length !== rows.length - 1) {
      ambiguousGroups++;
      continue;
    }

    cleanGroups++;
    const keepAdmissionId = admitted[0].Admission_Id;
    console.log(`\n${g.Student_Name} (${g.Present_Mobile}) — keep Admission_Id ${keepAdmissionId}`);

    for (const dup of others) {
      for (const table of CHILD_TABLES) {
        const [childRows] = await pool.query(`SELECT COUNT(*) c FROM \`${table}\` WHERE Admission_Id = ?`, [dup.Admission_Id]);
        const count = childRows[0].c;
        if (count > 0) {
          console.log(`  ${table}: reassign ${count} row(s) from Admission_Id ${dup.Admission_Id} -> ${keepAdmissionId}`);
          totalReassigned += count;
          if (apply) {
            await pool.query(`UPDATE \`${table}\` SET Admission_Id = ? WHERE Admission_Id = ?`, [keepAdmissionId, dup.Admission_Id]);
          }
        }
      }
      console.log(`  soft-delete duplicate Admission_Id ${dup.Admission_Id} (Student_Id ${dup.Student_Id}, Status_id ${dup.Status_id})`);
      totalSoftDeleted++;
      if (apply) {
        await pool.query(`UPDATE admission_master SET IsDelete = 1 WHERE Admission_Id = ?`, [dup.Admission_Id]);
      }
    }
  }

  console.log(`\nClean groups processed: ${cleanGroups}`);
  console.log(`Ambiguous groups skipped (multiple Status_id=8 records — needs human review): ${ambiguousGroups}`);
  console.log(`Total child rows reassigned: ${totalReassigned}`);
  console.log(`Total duplicate admission rows soft-deleted: ${totalSoftDeleted}`);

  await pool.end();
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
