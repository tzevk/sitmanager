/**
 * Merges duplicate FY 2026-27 admissions (same person admitted under several Student_Ids) into one
 * student, then deletes the duplicates.
 *
 *   node scripts/db/merge-duplicate-admissions.mjs --dry-run   # show groups, keeper and what moves
 *   node scripts/db/merge-duplicate-admissions.mjs             # apply
 *
 * A duplicate group = active, non-cancelled admissions from 2026-04-01 with the same real mobile
 * (last 10 digits; the 2147483647 placeholder is ignored), the same batch (or both without batch)
 * and the same first name. Keeper = the Student_Id with the most fee rows, then attendance rows,
 * then the lowest id.
 *
 * Apply does, per group:
 *   1. backs up every row it will touch into dedupe_bak_20261105_<table>
 *   2. student_master: fills the keeper's empty columns from the duplicates
 *   3. every other table with a Student_Id column: repoints the duplicate's rows to the keeper
 *      (UPDATE IGNORE — a row that would clash with the keeper's own row, e.g. the same attendance
 *      slot, stays on the deleted duplicate and is reported)
 *   4. soft-deletes the duplicate's admission_master and student_master rows (IsDelete = 1)
 * Everything is reversible from the backup tables + dedupe_merge_log_20261105.
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
const q = async (sql, p = []) => (await c.query(sql, p))[0];
const SUFFIX = '20261105';

// ── 1. Find groups ───────────────────────────────────────────────────────────
const rows = await q(`
  SELECT am.Admission_Id, am.Student_Id, am.Batch_Id, sm.Student_Name,
         RIGHT(REGEXP_REPLACE(COALESCE(sm.Present_Mobile, ''), '[^0-9]', ''), 10) AS mobile10,
         LOWER(SUBSTRING_INDEX(TRIM(sm.Student_Name), ' ', 1)) AS first_name
    FROM admission_master am
    JOIN student_master sm ON sm.Student_Id = am.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
   WHERE am.IsDelete = 0 AND am.Admission_Date >= '2026-04-01'
     AND LOWER(TRIM(COALESCE(am.Cancel, ''))) NOT IN ('yes','y','1','true','cancelled','canceled')`);
const groups = new Map();
for (const r of rows) {
  if (!/^\d{10}$/.test(r.mobile10) || r.mobile10 === '2147483647' || /^(\d)\1{9}$/.test(r.mobile10)) continue;
  const key = `${r.mobile10}|${r.Batch_Id ?? 'none'}|${r.first_name}`;
  (groups.get(key) ?? groups.set(key, []).get(key)).push(r);
}
const dupGroups = [...groups.values()].filter((g) => new Set(g.map((r) => String(r.Student_Id))).size > 1);

// Tables holding a Student_Id column (base tables only, not our own backups).
const refTables = (await q(`
  SELECT c.TABLE_NAME AS t, c.COLUMN_NAME AS col
    FROM INFORMATION_SCHEMA.COLUMNS c
    JOIN INFORMATION_SCHEMA.TABLES tb ON tb.TABLE_SCHEMA = c.TABLE_SCHEMA AND tb.TABLE_NAME = c.TABLE_NAME AND tb.TABLE_TYPE = 'BASE TABLE'
   WHERE c.TABLE_SCHEMA = DATABASE() AND LOWER(c.COLUMN_NAME) = 'student_id'
     AND LOWER(c.TABLE_NAME) NOT IN ('student_master', 'admission_master')
     AND c.TABLE_NAME NOT LIKE 'dedupe\\_bak\\_%' AND c.TABLE_NAME NOT LIKE '%\\_bak\\_%' AND c.TABLE_NAME NOT LIKE '%backup%'`));

const countIn = async (table, col, ids) => Number((await q(`SELECT COUNT(*) n FROM \`${table}\` WHERE \`${col}\` IN (?)`, [ids]))[0].n);
const fees = (ids) => countIn('s_fees_mst', 'Student_Id', ids).catch(() => 0);
const att = (ids) => countIn('student_attendance', 'student_id', ids).catch(() => 0);

const plan = [];
for (const g of dupGroups) {
  const ids = [...new Set(g.map((r) => String(r.Student_Id)))];
  const scored = [];
  for (const id of ids) scored.push({ id, fees: await fees([id]), att: await att([id]) });
  scored.sort((a, b) => b.fees - a.fees || b.att - a.att || Number(a.id) - Number(b.id));
  const keeper = scored[0].id;
  const dups = scored.slice(1).map((s) => s.id);
  const moves = [];
  for (const { t, col } of refTables) {
    const n = await countIn(t, col, dups).catch(() => 0);
    if (n) moves.push({ table: t, col, rows: n });
  }
  plan.push({
    name: g[0].Student_Name, batch: g[0].Batch_Id, keeper, dups,
    scores: scored.map((s) => `${s.id}: fees ${s.fees}, attendance ${s.att}`).join(' | '),
    dupAdmissions: g.filter((r) => dups.includes(String(r.Student_Id))).map((r) => r.Admission_Id),
    moves,
  });
}

for (const p of plan) {
  console.log(`\n${p.name} (batch ${p.batch ?? 'none'}) — keep ${p.keeper}, delete ${p.dups.join(', ')}`);
  console.log(`  ${p.scores}`);
  console.log(`  rows to move: ${p.moves.length ? p.moves.map((m) => `${m.table} ${m.rows}`).join(', ') : 'none'}`);
}
console.log(`\n${plan.length} group(s), ${plan.reduce((a, p) => a + p.dups.length, 0)} duplicate student record(s), ${plan.reduce((a, p) => a + p.dupAdmissions.length, 0)} duplicate admission(s).`);

// Orphans: live admissions whose student record was already deleted. They still count as
// admissions everywhere. Only those without any fee row, and not test records, are removed.
const orphans = await q(`
  SELECT am.Admission_Id, am.Student_Id, sm.Student_Name, DATE_FORMAT(am.Admission_Date, '%Y-%m-%d') AS d
    FROM admission_master am
    JOIN student_master sm ON sm.Student_Id = am.Student_Id AND sm.IsDelete = 1
   WHERE am.IsDelete = 0 AND am.Admission_Date >= '2026-04-01'
     AND LOWER(TRIM(COALESCE(am.Cancel, ''))) NOT IN ('yes','y','1','true','cancelled','canceled')
     AND LOWER(sm.Student_Name) NOT LIKE '%test%'
     AND NOT EXISTS (SELECT 1 FROM s_fees_mst f WHERE f.Student_Id = am.Student_Id)
     -- only when the same person (real mobile) has a live admission on a live record, so their
     -- admission is still counted once
     AND RIGHT(REGEXP_REPLACE(COALESCE(sm.Present_Mobile, ''), '[^0-9]', ''), 10) REGEXP '^[0-9]{10}$'
     AND sm.Present_Mobile <> '2147483647'
     AND EXISTS (SELECT 1 FROM student_master s2 JOIN admission_master a2 ON a2.Student_Id = s2.Student_Id AND a2.IsDelete = 0
                  WHERE (s2.IsDelete = 0 OR s2.IsDelete IS NULL)
                    AND RIGHT(REGEXP_REPLACE(COALESCE(s2.Present_Mobile, ''), '[^0-9]', ''), 10)
                      = RIGHT(REGEXP_REPLACE(COALESCE(sm.Present_Mobile, ''), '[^0-9]', ''), 10))`);
console.log(`\nAdmissions of already-deleted students (no fees, person admitted on a live record) to delete: ${orphans.length}`);
console.table(orphans);

if (dryRun || (!plan.length && !orphans.length)) { await c.end(); process.exit(0); }

if (orphans.length) {
  const bak = `dedupe_bak_${SUFFIX}_orphan_admissions`;
  await c.query(`CREATE TABLE IF NOT EXISTS \`${bak}\` AS SELECT * FROM admission_master WHERE 1 = 0`);
  await c.query(`INSERT INTO \`${bak}\` SELECT * FROM admission_master WHERE Admission_Id IN (?)`, [orphans.map((o) => o.Admission_Id)]);
  const [u] = await c.query(`UPDATE admission_master SET IsDelete = 1 WHERE Admission_Id IN (?) AND IsDelete = 0`, [orphans.map((o) => o.Admission_Id)]);
  console.log(`Deleted ${u.affectedRows} orphan admission(s). Backup: ${bak}`);
}
if (!plan.length) { await c.end(); process.exit(0); }

// ── 2. Backups ───────────────────────────────────────────────────────────────
const allDups = plan.flatMap((p) => p.dups);
const allKeepers = plan.map((p) => p.keeper);
const backup = async (table, col, ids) => {
  const bak = `dedupe_bak_${SUFFIX}_${table}`.slice(0, 64);
  await c.query(`CREATE TABLE IF NOT EXISTS \`${bak}\` AS SELECT * FROM \`${table}\` WHERE 1 = 0`);
  await c.query(`INSERT INTO \`${bak}\` SELECT * FROM \`${table}\` WHERE \`${col}\` IN (?)`, [ids]);
};
await backup('student_master', 'Student_Id', [...allDups, ...allKeepers]);
await backup('admission_master', 'Student_Id', [...allDups, ...allKeepers]);
const touched = new Map();
for (const p of plan) for (const m of p.moves) touched.set(m.table, m.col);
for (const [t, col] of touched) await backup(t, col, allDups);
await c.query(`CREATE TABLE IF NOT EXISTS dedupe_merge_log_${SUFFIX} (
  id INT AUTO_INCREMENT PRIMARY KEY, keeper_id INT, duplicate_id INT, table_name VARCHAR(64),
  moved INT, left_on_duplicate INT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

// ── 3. Merge ─────────────────────────────────────────────────────────────────
const smCols = (await q(`SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_master'
                          AND EXTRA NOT LIKE '%GENERATED%' AND COLUMN_KEY <> 'PRI' AND COLUMN_NAME NOT IN ('IsDelete')`)).map((r) => r.c);
let leftTotal = 0;
for (const p of plan) {
  for (const dup of p.dups) {
    // fill keeper's empty fields from the duplicate
    await c.query(
      `UPDATE student_master k JOIN student_master d ON d.Student_Id = ?
          SET ${smCols.map((col) => `k.\`${col}\` = CASE WHEN k.\`${col}\` IS NULL OR TRIM(CAST(k.\`${col}\` AS CHAR)) IN ('', '0') THEN d.\`${col}\` ELSE k.\`${col}\` END`).join(', ')}
        WHERE k.Student_Id = ?`,
      [dup, p.keeper]
    );
    for (const m of p.moves) {
      const [u] = await c.query(`UPDATE IGNORE \`${m.table}\` SET \`${m.col}\` = ? WHERE \`${m.col}\` = ?`, [p.keeper, dup]);
      const left = await countIn(m.table, m.col, [dup]);
      leftTotal += left;
      await c.query(`INSERT INTO dedupe_merge_log_${SUFFIX} (keeper_id, duplicate_id, table_name, moved, left_on_duplicate) VALUES (?,?,?,?,?)`,
        [p.keeper, dup, m.table, u.affectedRows, left]);
    }
    await c.query(`UPDATE admission_master SET IsDelete = 1 WHERE Student_Id = ? AND IsDelete = 0`, [dup]);
    await c.query(`UPDATE student_master SET IsDelete = 1 WHERE Student_Id = ?`, [dup]);
    await c.query(`INSERT INTO dedupe_merge_log_${SUFFIX} (keeper_id, duplicate_id, table_name, moved, left_on_duplicate) VALUES (?,?,'deleted',0,0)`, [p.keeper, dup]);
  }
}
console.log(`\nDone. ${allDups.length} duplicate(s) merged and deleted. Rows left on deleted duplicates (clashes): ${leftTotal}. Log: dedupe_merge_log_${SUFFIX}`);
await c.query(`INSERT INTO software_changelog (Title, Description, Category, Author, Created_Date) VALUES (?, ?, 'Fix', 'System', NOW())`, [
  'Duplicate FY 2026-27 admissions merged',
  `${plan.length} students had been admitted under more than one Student_Id (same mobile, batch and first name). Their data was merged into one record and ${allDups.length} duplicate student/admission records were deleted (soft). Backups: dedupe_bak_${SUFFIX}_*; log: dedupe_merge_log_${SUFFIX}.`,
]).catch(() => console.log('(changelog entry not written; log it manually)'));
await c.end();
