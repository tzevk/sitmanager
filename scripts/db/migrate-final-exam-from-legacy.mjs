/**
 * Migrate final-examination data from the legacy DB (OLD_DB_*) into the current
 * DB, and de-duplicate the current exam_taken_child marks table.
 *
 * Two parts:
 *  1. MIGRATE — copy any final_exam_master + exam_taken_child rows that exist in
 *     the legacy DB but not in the current DB (matched by primary key). The two
 *     schemas are identical and share a PK space, and the overlapping rows have
 *     already been verified byte-identical, so this only ever adds the genuinely
 *     missing tail (verified: 3 masters + 15 child rows at time of writing).
 *  2. DEDUPE — collapse duplicate (Take_Id, Student_Id) groups in
 *     exam_taken_child down to a single row each: keep the row with the highest
 *     numeric Marks_Given (real mark beats a placeholder 0), tie-broken by the
 *     lowest ID. The redundant rows are SOFT-deleted (IsDelete = 1), never hard
 *     deleted, so the operation is reversible.
 *
 * Usage:
 *   node scripts/db/migrate-final-exam-from-legacy.mjs            # dry run
 *   node scripts/db/migrate-final-exam-from-legacy.mjs --apply    # execute
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const APPLY = process.argv.includes('--apply');

const curCfg = {
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
};
const oldCfg = {
  host: process.env.OLD_DB_HOST, port: Number(process.env.OLD_DB_PORT || 3306),
  database: process.env.OLD_DB_NAME, user: process.env.OLD_DB_USER, password: process.env.OLD_DB_PASSWORD,
};

async function main() {
  const cur = await mysql.createConnection(curCfg);
  const old = await mysql.createConnection(oldCfg);

  /* ── Part 1: migrate missing master rows ─────────────────────────── */
  const [curMaster] = await cur.query('SELECT Take_Id FROM final_exam_master');
  const curMasterIds = new Set(curMaster.map(r => r.Take_Id));
  const [oldMaster] = await old.query('SELECT * FROM Final_exam_master');
  const missingMaster = oldMaster.filter(r => !curMasterIds.has(r.Take_Id));

  console.log(`Master rows to migrate (in legacy, not current): ${missingMaster.length}`);
  for (const r of missingMaster) {
    console.log(`  Take_Id ${r.Take_Id} — Course ${r.Course_Id}, Batch ${r.Batch_Id}, ${r.Test_Dt}, Marks ${r.Marks}`);
    if (APPLY) {
      await cur.query(
        `INSERT IGNORE INTO final_exam_master
          (Take_Id, Course_Id, Batch_Id, Marks, Test_Id, Test_Dt, Test_No, IsActive, IsDelete)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.Take_Id, r.Course_Id, r.Batch_Id, r.Marks, r.Test_Id, r.Test_Dt, r.Test_No, r.IsActive, r.IsDelete]
      );
    }
  }

  /* ── Part 1b: migrate missing child rows ─────────────────────────── */
  const [curChild] = await cur.query('SELECT ID FROM exam_taken_child');
  const curChildIds = new Set(curChild.map(r => r.ID));
  const [oldChild] = await old.query('SELECT * FROM Exam_taken_child');
  const missingChild = oldChild.filter(r => !curChildIds.has(r.ID));

  console.log(`\nChild (marks) rows to migrate: ${missingChild.length}`);
  for (const r of missingChild) {
    if (APPLY) {
      await cur.query(
        `INSERT IGNORE INTO exam_taken_child
          (ID, Take_Id, Student_Id, Student_Name, Marks_Given, Marks_from, Status, IsActive, IsDelete)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.ID, r.Take_Id, r.Student_Id, r.Student_Name, r.Marks_Given, r.Marks_from, r.Status, r.IsActive, r.IsDelete]
      );
    }
  }
  console.log(`  (${missingChild.length} rows across Take_Ids ${[...new Set(missingChild.map(r => r.Take_Id))].join(', ')})`);

  /* ── Part 2: de-duplicate exam_taken_child ───────────────────────── */
  // One winner per (Take_Id, Student_Id): highest numeric mark, then lowest ID.
  const [dupeRows] = await cur.query(`
    SELECT ID, Take_Id, Student_Id, Marks_Given
    FROM exam_taken_child
    WHERE (IsDelete = 0 OR IsDelete IS NULL)
      AND (Take_Id, Student_Id) IN (
        SELECT Take_Id, Student_Id FROM exam_taken_child
        WHERE (IsDelete = 0 OR IsDelete IS NULL)
        GROUP BY Take_Id, Student_Id HAVING COUNT(*) > 1
      )
    ORDER BY Take_Id, Student_Id, CAST(Marks_Given AS DECIMAL(10,2)) DESC, ID ASC
  `);

  const seen = new Set();
  const losers = [];
  for (const r of dupeRows) {
    const key = `${r.Take_Id}:${r.Student_Id}`;
    if (seen.has(key)) losers.push(r.ID);      // not the first (winner) → soft-delete
    else seen.add(key);                        // first per group = winner (kept)
  }

  console.log(`\nDuplicate groups collapsed: ${seen.size}`);
  console.log(`Redundant rows to soft-delete (IsDelete=1): ${losers.length}`);
  if (APPLY && losers.length) {
    // chunk to keep the IN() list sane
    for (let i = 0; i < losers.length; i += 500) {
      const chunk = losers.slice(i, i + 500);
      await cur.query(
        `UPDATE exam_taken_child SET IsDelete = 1 WHERE ID IN (${chunk.map(() => '?').join(',')})`,
        chunk
      );
    }
  }

  if (!APPLY) {
    console.log('\nDRY RUN — no changes written. Re-run with --apply to execute.');
  } else {
    console.log('\nAPPLIED.');
    // Post-verification
    const [[m]] = await cur.query('SELECT COUNT(*) c FROM final_exam_master');
    const [[c]] = await cur.query('SELECT COUNT(*) c FROM exam_taken_child WHERE (IsDelete=0 OR IsDelete IS NULL)');
    const [remainingDupes] = await cur.query(`
      SELECT COUNT(*) c FROM (
        SELECT Take_Id, Student_Id FROM exam_taken_child
        WHERE (IsDelete=0 OR IsDelete IS NULL)
        GROUP BY Take_Id, Student_Id HAVING COUNT(*) > 1
      ) x`);
    console.log(`Post: final_exam_master=${m.c}, live exam_taken_child=${c.c}, remaining dupe groups=${remainingDupes[0].c}`);
  }

  await cur.end();
  await old.end();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
