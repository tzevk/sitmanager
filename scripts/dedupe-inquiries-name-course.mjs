/**
 * Remove duplicate leads: same name (case/space-insensitive) + same training programme.
 * Keeps one lead per group — closed admission first, then one with an assigned counsellor,
 * then most discussions, then the oldest. Others are soft-deleted (IsDelete=1) and their
 * discussions moved to the kept lead. Every change is recorded in inquiry_dedupe_log so it
 * can be undone.   node scripts/dedupe-inquiries-name-course.mjs [--apply]
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local'), quiet: true });

const apply = process.argv.includes('--apply');
const c = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true,
});
try {
  const [rows] = await c.query(`SET STATEMENT max_statement_time=120 FOR
    SELECT s.Inquiry_Id, LOWER(TRIM(REGEXP_REPLACE(s.Student_Name,'\\\\s+',' '))) nm, s.Course_Id,
           s.OnlineState IN ('8','52') closed, ia.Inquiry_Id IS NOT NULL assigned,
           (SELECT COUNT(*) FROM awt_inquirydiscussion d WHERE d.Inquiry_Id_Int = s.Inquiry_Id AND IFNULL(d.deleted,0)=0) discs
      FROM student_inquiry s
      JOIN (SELECT LOWER(TRIM(REGEXP_REPLACE(Student_Name,'\\\\s+',' '))) nm, Course_Id FROM student_inquiry
             WHERE IFNULL(IsDelete,0)=0 AND TRIM(IFNULL(Student_Name,''))<>'' AND IFNULL(Course_Id,'') NOT IN ('','0')
             GROUP BY 1,2 HAVING COUNT(*)>1) g
        ON g.nm = LOWER(TRIM(REGEXP_REPLACE(s.Student_Name,'\\\\s+',' '))) AND g.Course_Id = s.Course_Id
      LEFT JOIN inquiry_assignments ia ON ia.Inquiry_Id = s.Inquiry_Id
     WHERE IFNULL(s.IsDelete,0)=0`);
  const groups = new Map();
  for (const r of rows) {
    const k = `${r.nm}|${r.Course_Id}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const plan = [];
  for (const g of groups.values()) {
    g.sort((a, b) => b.closed - a.closed || b.assigned - a.assigned || b.discs - a.discs || a.Inquiry_Id - b.Inquiry_Id);
    const [keep, ...drop] = g;
    for (const d of drop) plan.push([keep.Inquiry_Id, d.Inquiry_Id, d.discs]);
  }
  console.log(`groups=${groups.size} to_delete=${plan.length} discussions_to_move=${plan.reduce((a, p) => a + Number(p[2]), 0)}`);
  console.log('sample:', plan.slice(0, 5));
  if (!apply) process.exit(0);

  await c.query(`CREATE TABLE IF NOT EXISTS inquiry_dedupe_log (
    id INT AUTO_INCREMENT PRIMARY KEY, kept_inquiry_id INT NOT NULL, deleted_inquiry_id INT NOT NULL,
    moved_discussion_ids TEXT NULL, reason VARCHAR(100) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY (deleted_inquiry_id))`);
  let done = 0;
  for (const [keep, drop] of plan) {
    await c.beginTransaction();
    const [ds] = await c.query(`SELECT id FROM awt_inquirydiscussion WHERE Inquiry_Id_Int = ?`, [drop]);
    const ids = ds.map((d) => d.id);
    if (ids.length) await c.query(`UPDATE awt_inquirydiscussion SET Inquiry_id = ? WHERE id IN (?)`, [String(keep), ids]);
    await c.query(`UPDATE student_inquiry SET IsDelete = 1 WHERE Inquiry_Id = ? AND IFNULL(IsDelete,0) = 0`, [drop]);
    await c.query(`INSERT INTO inquiry_dedupe_log (kept_inquiry_id, deleted_inquiry_id, moved_discussion_ids, reason) VALUES (?,?,?, 'same name + training programme')`,
      [keep, drop, ids.join(',') || null]);
    await c.commit();
    if (++done % 500 === 0) console.log(`${done}/${plan.length}`);
  }
  console.log(`done: ${done} leads soft-deleted`);
} finally {
  await c.end();
}
