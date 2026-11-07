/**
 * Remove duplicate leads of ONE PERSON for the SAME training programme.
 * Same person = same phone (last 10 digits, placeholders ignored) OR same e-mail.
 * Leads for different programmes are left alone. Keeps one per person+programme:
 * closed admission → assigned counsellor → most discussions → oldest. Others are
 * soft-deleted (IsDelete=1), their discussions moved to the kept lead, every change
 * logged in inquiry_dedupe_log (reversible).
 *   node scripts/dedupe-inquiries-contact-course.mjs [--apply]
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local'), quiet: true });

export const phoneKey = (v) => {
  const d = String(v ?? '').replace(/\D/g, '').slice(-10);
  return d.length === 10 && d !== '2147483647' && !/^(\d)\1{9}$/.test(d) && !d.startsWith('0') ? d : null;
};
export const emailKey = (v) => { const s = String(v ?? '').trim().toLowerCase(); return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : null; };

const apply = process.argv.includes('--apply');
const c = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true,
});
try {
  const [rows] = await c.query(`SET STATEMENT max_statement_time=120 FOR
    SELECT s.Inquiry_Id, s.Course_Id, s.Present_Mobile, s.Email,
           s.OnlineState IN ('8','52') closed, ia.Inquiry_Id IS NOT NULL assigned, IFNULL(d.n,0) discs
      FROM student_inquiry s
      LEFT JOIN inquiry_assignments ia ON ia.Inquiry_Id = s.Inquiry_Id
      LEFT JOIN (SELECT Inquiry_Id_Int, COUNT(*) n FROM awt_inquirydiscussion WHERE IFNULL(deleted,0)=0 GROUP BY 1) d ON d.Inquiry_Id_Int = s.Inquiry_Id
     WHERE IFNULL(s.IsDelete,0)=0 AND IFNULL(s.Course_Id,'') NOT IN ('','0')`);
  // union-find over leads sharing phone or e-mail within a programme
  const parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent.set(a, b); };
  const seen = new Map();
  for (const r of rows) {
    parent.set(r.Inquiry_Id, r.Inquiry_Id);
    for (const k of [phoneKey(r.Present_Mobile) && `p|${phoneKey(r.Present_Mobile)}`, emailKey(r.Email) && `e|${emailKey(r.Email)}`].filter(Boolean)) {
      const key = `${k}|${r.Course_Id}`;
      if (seen.has(key)) union(r.Inquiry_Id, seen.get(key)); else seen.set(key, r.Inquiry_Id);
    }
  }
  const groups = new Map();
  for (const r of rows) { const g = find(r.Inquiry_Id); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(r); }
  const plan = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    g.sort((a, b) => b.closed - a.closed || b.assigned - a.assigned || b.discs - a.discs || a.Inquiry_Id - b.Inquiry_Id);
    const [keep, ...drop] = g;
    for (const d of drop) plan.push([keep.Inquiry_Id, d.Inquiry_Id, Number(d.discs)]);
  }
  console.log(`to_delete=${plan.length} discussions_to_move=${plan.reduce((a, p) => a + p[2], 0)}`);
  if (!apply) process.exit(0);
  let done = 0;
  for (const [keep, drop] of plan) {
    await c.beginTransaction();
    const [ds] = await c.query(`SELECT id FROM awt_inquirydiscussion WHERE Inquiry_Id_Int = ?`, [drop]);
    const ids = ds.map((d) => d.id);
    if (ids.length) await c.query(`UPDATE awt_inquirydiscussion SET Inquiry_id = ? WHERE id IN (?)`, [String(keep), ids]);
    await c.query(`UPDATE student_inquiry SET IsDelete = 1 WHERE Inquiry_Id = ? AND IFNULL(IsDelete,0) = 0`, [drop]);
    await c.query(`INSERT INTO inquiry_dedupe_log (kept_inquiry_id, deleted_inquiry_id, moved_discussion_ids, reason) VALUES (?,?,?, 'same phone/e-mail + training programme')`,
      [keep, drop, ids.join(',') || null]);
    await c.commit();
    if (++done % 200 === 0) console.log(`${done}/${plan.length}`);
  }
  console.log(`done: ${done} leads soft-deleted`);
} finally {
  await c.end();
}
