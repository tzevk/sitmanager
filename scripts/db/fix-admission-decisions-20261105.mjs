/**
 * Applies the 2026-11-05 admission clean-up decisions (made by the admissions team):
 *   - Krishna Raut, Process Engineering 03090: one admission, on live record 176720
 *     (admitted, has the fee payment). Admission 18595 + attendance move there from deleted 176712;
 *     orphan admissions 18674 / 18675 deleted; empty live duplicates 176709/13/14/15 deleted.
 *   - Aditya Pravin Jadhav, transferred to 01167: attendance on old deleted record 176405 moves to
 *     176734 (his live 01167 record). His orphan admissions 18419/18420 are removed by
 *     merge-duplicate-admissions.mjs.
 *   - Removed: TEST NO DELETE (18849), Santosh Dinkar Mestry (18506), junk SK SAMIMUDDIN (18410),
 *     RASHMIN (18411), Chinmay (18430).
 *
 *   node scripts/db/fix-admission-decisions-20261105.mjs --dry-run
 *   node scripts/db/fix-admission-decisions-20261105.mjs
 *
 * Soft deletes only (IsDelete = 1). Every touched row is copied to dedupe_bak_20261105_decisions_*.
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

const KRISHNA_KEEP = 176720;
const KRISHNA_ADMISSION = 18595;          // live admission on deleted record 176712
const KRISHNA_FROM = [176712, 176709, 176713, 176714, 176715, 176716, 176718];
const KRISHNA_DELETE_STUDENTS = [176709, 176713, 176714, 176715]; // live, empty duplicates
const KRISHNA_DELETE_ADMISSIONS = [18674, 18675];
const ADITYA_KEEP = 176734;
const ADITYA_FROM = [176405];
const REMOVE_ADMISSIONS = [18849, 18506, 18410, 18411, 18430]; // test, Santosh, junk ×3

// Safety: the records must still look as they did when this was decided.
const krishna = await q(`SELECT Student_Id, Student_Name, IsDelete, Batch_Code FROM student_master WHERE Student_Id IN (?)`, [[KRISHNA_KEEP, ...KRISHNA_FROM]]);
const adm = await q(`SELECT Admission_Id, Student_Id, IsDelete FROM admission_master WHERE Admission_Id IN (?)`, [[KRISHNA_ADMISSION, ...KRISHNA_DELETE_ADMISSIONS, ...REMOVE_ADMISSIONS]]);
const keeper = krishna.find((r) => r.Student_Id === KRISHNA_KEEP);
if (!keeper || Number(keeper.IsDelete) === 1 || !/raut/i.test(keeper.Student_Name)) throw new Error('Krishna keeper 176720 changed — stopping.');
if (!adm.some((a) => a.Admission_Id === KRISHNA_ADMISSION && Number(a.Student_Id) === 176712)) throw new Error('Admission 18595 changed — stopping.');
const [[aditya]] = await c.query(`SELECT Student_Id, IsDelete, Batch_Code FROM student_master WHERE Student_Id = ?`, [ADITYA_KEEP]);
if (!aditya || Number(aditya.IsDelete) === 1 || aditya.Batch_Code !== '01167') throw new Error('Aditya 176734 changed — stopping.');

// Tables with a Student_Id column (except the two masters handled explicitly).
const refTables = await q(`
  SELECT c.TABLE_NAME AS t, c.COLUMN_NAME AS col FROM INFORMATION_SCHEMA.COLUMNS c
    JOIN INFORMATION_SCHEMA.TABLES tb ON tb.TABLE_SCHEMA = c.TABLE_SCHEMA AND tb.TABLE_NAME = c.TABLE_NAME AND tb.TABLE_TYPE = 'BASE TABLE'
   WHERE c.TABLE_SCHEMA = DATABASE() AND LOWER(c.COLUMN_NAME) = 'student_id'
     AND LOWER(c.TABLE_NAME) NOT IN ('student_master', 'admission_master')
     AND c.TABLE_NAME NOT LIKE '%\\_bak\\_%' AND c.TABLE_NAME NOT LIKE '%backup%'`);

const moves = [];
for (const [to, from] of [[KRISHNA_KEEP, KRISHNA_FROM], [ADITYA_KEEP, ADITYA_FROM]]) {
  for (const { t, col } of refTables) {
    const [[{ n }]] = await c.query(`SELECT COUNT(*) n FROM \`${t}\` WHERE \`${col}\` IN (?)`, [from]);
    if (Number(n)) moves.push({ to, from, t, col, n: Number(n) });
  }
}
console.log('Rows to move onto the kept records:');
console.table(moves.map((m) => ({ keep: m.to, table: m.t, rows: m.n })));
console.log('Admission 18595 → student 176720 (Krishna, 03090, Process Engineering)');
console.log('Admissions to delete:', [...KRISHNA_DELETE_ADMISSIONS, ...REMOVE_ADMISSIONS].join(', '));
console.log('Student records to delete:', KRISHNA_DELETE_STUDENTS.join(', '));
if (dryRun) { await c.end(); process.exit(0); }

// Backups
const bak = async (name, sql, params) => {
  await c.query(`CREATE TABLE IF NOT EXISTS \`dedupe_bak_20261105_decisions_${name}\` AS ${sql} AND 1 = 0`, params);
  await c.query(`INSERT INTO \`dedupe_bak_20261105_decisions_${name}\` ${sql}`, params);
};
await bak('admission_master', `SELECT * FROM admission_master WHERE (Admission_Id IN (?) OR Student_Id IN (?))`,
  [[KRISHNA_ADMISSION, ...KRISHNA_DELETE_ADMISSIONS, ...REMOVE_ADMISSIONS], [KRISHNA_KEEP]]);
await bak('student_master', `SELECT * FROM student_master WHERE (Student_Id IN (?))`, [[KRISHNA_KEEP, ...KRISHNA_FROM, ADITYA_KEEP, ...ADITYA_FROM]]);
for (const t of new Set(moves.map((m) => m.t))) {
  const col = moves.find((m) => m.t === t).col;
  await bak(t.slice(0, 30), `SELECT * FROM \`${t}\` WHERE (\`${col}\` IN (?))`, [[...KRISHNA_FROM, ...ADITYA_FROM]]);
}

// Apply
let clashes = 0;
for (const m of moves) {
  await c.query(`UPDATE IGNORE \`${m.t}\` SET \`${m.col}\` = ? WHERE \`${m.col}\` IN (?)`, [m.to, m.from]);
  const [[{ n }]] = await c.query(`SELECT COUNT(*) n FROM \`${m.t}\` WHERE \`${m.col}\` IN (?)`, [m.from]);
  clashes += Number(n);
}
await c.query(`UPDATE admission_master SET Student_Id = ?, Course_Id = COALESCE(NULLIF(Course_Id, 0), 3) WHERE Admission_Id = ?`, [KRISHNA_KEEP, KRISHNA_ADMISSION]);
await c.query(`UPDATE student_master SET Status_id = 8, Course_Id = 3, Batch_Code = '03090' WHERE Student_Id = ?`, [KRISHNA_KEEP]);
await c.query(`UPDATE admission_master SET IsDelete = 1 WHERE Admission_Id IN (?)`, [[...KRISHNA_DELETE_ADMISSIONS, ...REMOVE_ADMISSIONS]]);
await c.query(`UPDATE student_master SET IsDelete = 1 WHERE Student_Id IN (?)`, [KRISHNA_DELETE_STUDENTS]);
console.log(`Done. Rows that clashed and stayed on the old records: ${clashes}. Backups: dedupe_bak_20261105_decisions_*`);
await c.query(`INSERT INTO software_changelog (Title, Description, Category, Author, Created_Date) VALUES (?, ?, 'Fix', 'System', NOW())`, [
  'Admission clean-up decisions applied (Krishna Raut, Aditya Jadhav, test/junk entries)',
  'Krishna Raut kept as one Process Engineering 03090 admission on record 176720 (admission and attendance moved from deleted record; 2 orphan admissions and 4 empty duplicate records deleted). Aditya Pravin Jadhav: attendance from old record moved to his 01167 record. Removed admissions: TEST NO DELETE, Santosh Dinkar Mestry, SK SAMIMUDDIN, RASHMIN, Chinmay. Backups dedupe_bak_20261105_decisions_*.',
]).catch(() => console.log('(changelog entry not written; log it manually)'));
await c.end();
