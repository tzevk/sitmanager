/**
 * Transfer a single student (all details) from the legacy DB to the main DB.
 *
 * Mirrors lib/services/legacy-student-sync.service.ts (shared-column upsert via
 * ON DUPLICATE KEY UPDATE) but scoped to specific Student_Id(s), so it refreshes
 * every shared column for one student across student_master + admission_master.
 *
 * Usage:
 *   node scripts/db/transfer-single-student-from-legacy.mjs --ids 176538,176540 [--apply]
 * Without --apply it runs as a dry-run (no writes).
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

function loadEnv() {
  // .env.local then .env (dotenv/config already loaded .env; layer .env.local)
}

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const idsArg = (() => {
  const i = args.indexOf('--ids');
  return i >= 0 ? args[i + 1] : '';
})();
const IDS = idsArg.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);

if (!IDS.length) {
  console.error('Provide --ids <comma-separated Student_Id list>');
  process.exit(1);
}

const conn = (o) => mysql.createConnection({ host: o.h, port: o.p || 3306, user: o.u, password: o.pw, database: o.d, dateStrings: true });

async function resolveTable(pool, lower, preferred) {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = ?
     ORDER BY CASE WHEN TABLE_NAME = ? THEN 0 ELSE 1 END LIMIT 1`,
    [lower, preferred]
  );
  return String(rows[0]?.TABLE_NAME || '').trim() || null;
}

async function getColumns(pool, table) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME c, EXTRA extra FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
    [table]
  );
  return rows.filter((r) => !String(r.extra ?? '').toLowerCase().includes('generated')).map((r) => String(r.c));
}

async function pickStudentCol(pool, table) {
  const cols = await getColumns(pool, table);
  return cols.find((c) => c.toLowerCase() === 'student_id') || cols.find((c) => c.toLowerCase().includes('student') && c.toLowerCase().includes('id')) || null;
}

async function transferTable(old, cur, cfg) {
  const src = await resolveTable(old, cfg.lower, cfg.preferred);
  const dst = await resolveTable(cur, cfg.lower, cfg.preferred);
  if (!src) return { table: cfg.preferred, skipped: 'legacy source not found' };
  if (!dst) return { table: cfg.preferred, skipped: 'main target not found' };

  const filterCol = await pickStudentCol(old, src);
  if (!filterCol) return { table: src, skipped: 'no Student_Id column to filter by' };

  const [oldCols, newCols] = await Promise.all([getColumns(old, src), getColumns(cur, dst)]);
  const targetSet = new Set(newCols.map((c) => c.toLowerCase()));
  const shared = oldCols.filter((c) => targetSet.has(c.toLowerCase()));
  if (!shared.length) return { table: src, skipped: 'no shared columns' };

  const colSql = shared.map((c) => `\`${c}\``).join(', ');
  const placeholders = IDS.map(() => '?').join(',');
  const [rows] = await old.query(`SELECT ${colSql} FROM \`${src}\` WHERE \`${filterCol}\` IN (${placeholders})`, IDS);

  if (!rows.length) return { table: src, fetched: 0, written: 0, sharedCols: shared.length };

  let written = 0;
  if (apply) {
    const sql = `INSERT INTO \`${dst}\` (${colSql}) VALUES ? ON DUPLICATE KEY UPDATE ${shared.map((c) => `\`${c}\`=VALUES(\`${c}\`)`).join(', ')}`;
    const values = rows.map((row) => shared.map((c) => row[c] ?? null));
    await cur.query(sql, [values]);
    written = rows.length;
  }
  return { table: src, target: dst, filterCol, fetched: rows.length, written, sharedCols: shared.length, ids: rows.map((r) => r[filterCol]) };
}

(async () => {
  const old = await conn({ h: process.env.OLD_DB_HOST, p: process.env.OLD_DB_PORT, u: process.env.OLD_DB_USER, pw: process.env.OLD_DB_PASSWORD, d: process.env.OLD_DB_NAME });
  const cur = await conn({ h: process.env.DB_HOST, p: process.env.DB_PORT, u: process.env.DB_USER, pw: process.env.DB_PASSWORD, d: process.env.DB_NAME });

  console.log(`Mode: ${apply ? 'APPLY (writing)' : 'DRY-RUN (no writes)'}  |  Student_Ids: ${IDS.join(', ')}`);
  const tables = [
    { lower: 'student_master', preferred: 'Student_Master' },
    { lower: 'admission_master', preferred: 'Admission_Master' },
  ];
  for (const cfg of tables) {
    const res = await transferTable(old, cur, cfg);
    console.log(JSON.stringify(res));
  }
  await old.end();
  await cur.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
