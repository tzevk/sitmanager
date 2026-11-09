/**
 * Undo name-based dedupe for leads that were really different people (different valid phone).
 * Restores IsDelete=0, moves their discussions back, marks log rows restored.
 * Skips a lead if its phone+programme already belongs to another live lead (true duplicate).
 * Usage: node scripts/restore-dedupe-different-people.mjs [--apply]
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local'), quiet: true });
const apply = process.argv.includes('--apply');
const c = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
const P = (x) => `RIGHT(REGEXP_REPLACE(IFNULL(${x}.Present_Mobile,''),'[^0-9]',''),10)`;
try {
  const [cols] = await c.query(`SHOW COLUMNS FROM inquiry_dedupe_log LIKE 'restored_at'`);
  if (!cols.length && apply) await c.query(`ALTER TABLE inquiry_dedupe_log ADD COLUMN restored_at DATETIME NULL`);
  const restoredCond = cols.length || apply ? 'AND l.restored_at IS NULL' : '';
  const [rows] = await c.query(`SET STATEMENT max_statement_time=60 FOR
    SELECT l.id, l.kept_inquiry_id k, l.deleted_inquiry_id d, l.moved_discussion_ids m, ${P('d')} ph, d.Course_Id course
    FROM inquiry_dedupe_log l
    JOIN student_inquiry d ON d.Inquiry_Id=l.deleted_inquiry_id
    JOIN student_inquiry k ON k.Inquiry_Id=l.kept_inquiry_id
    WHERE l.reason='same name + training programme' ${restoredCond} AND IFNULL(d.IsDelete,0)=1
      AND LENGTH(${P('d')})=10 AND ${P('d')}<>'2147483647' AND LEFT(${P('d')},1)<>'0'
      AND ${P('d')}<>${P('k')}`);
  const seen = new Set();
  let ok = 0, skip = 0, disc = 0;
  for (const r of rows) {
    const key = r.ph + '|' + r.course;
    const [[live]] = await c.query(`SET STATEMENT max_statement_time=20 FOR
      SELECT COUNT(*) n FROM student_inquiry s WHERE IFNULL(s.IsDelete,0)=0 AND s.Course_Id=? AND s.Present_Mobile LIKE ? AND ${P('s')}=?`,
      [r.course, '%' + r.ph.slice(-4), r.ph]);
    if (Number(live.n) || seen.has(key)) { skip++; continue; }
    seen.add(key);
    const ids = String(r.m || '').split(',').map((x) => x.trim()).filter(Boolean).map(Number);
    ok++; disc += ids.length;
    if (!apply) continue;
    if (ids.length) await c.query(`UPDATE awt_inquirydiscussion SET Inquiry_id=? WHERE id IN (?) AND Inquiry_id=?`, [String(r.d), ids, String(r.k)]);
    await c.query(`UPDATE student_inquiry SET IsDelete=0 WHERE Inquiry_Id=?`, [r.d]);
    await c.query(`UPDATE inquiry_dedupe_log SET restored_at=NOW() WHERE id=?`, [r.id]);
  }
  console.log(`${apply ? 'restored' : 'would restore'}=${ok} skipped_true_duplicates=${skip} discussions_moved_back=${disc}`);
} finally { await c.end(); }
