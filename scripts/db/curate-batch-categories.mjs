/**
 * Curate mst_batchcategory down to exactly the approved set:
 *   Online, Weekend, Full Time, Part Time
 *
 * - Renames near matches to the canonical label (e.g. "Weekend Batches" -> "Weekend",
 *   "ONLINE" -> "Online") so existing prefix/type metadata is preserved.
 * - Soft-deletes (IsDelete=1) everything else (Corporate Training, Transfer, junk, Pune…).
 * - Inserts any approved category that doesn't already exist.
 *
 * Usage: node scripts/db/curate-batch-categories.mjs [--apply]  (dry-run by default)
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const apply = process.argv.includes('--apply');
const TARGETS = ['Online', 'Weekend', 'Full Time', 'Part Time'];

function canonical(name) {
  const n = String(name || '').trim().toLowerCase();
  if (n === 'full time' || n === 'fulltime') return 'Full Time';
  if (n === 'part time' || n === 'parttime') return 'Part Time';
  if (n.includes('weekend')) return 'Weekend';
  if (n.includes('online')) return 'Online';
  return null; // not an approved category -> remove
}

const c = await mysql.createConnection({
  host: process.env.DB_HOST, port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
});

console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
const [rows] = await c.query(
  "SELECT id, BatchCategory FROM mst_batchcategory WHERE IsActive = 1 AND (IsDelete IS NULL OR IsDelete = 0) ORDER BY id"
);

const used = new Set();
const actions = [];
for (const r of rows) {
  const target = canonical(r.BatchCategory);
  if (target && !used.has(target)) {
    used.add(target);
    if (r.BatchCategory !== target) actions.push({ type: 'rename', id: r.id, from: r.BatchCategory, to: target });
    else actions.push({ type: 'keep', id: r.id, name: target });
  } else {
    actions.push({ type: 'delete', id: r.id, name: r.BatchCategory, reason: target ? 'duplicate' : 'not approved' });
  }
}
for (const t of TARGETS) {
  if (!used.has(t)) actions.push({ type: 'insert', name: t });
}

actions.forEach(a => console.log('  ', JSON.stringify(a)));

if (apply) {
  await c.beginTransaction();
  try {
    for (const a of actions) {
      if (a.type === 'rename') {
        await c.query('UPDATE mst_batchcategory SET BatchCategory = ? WHERE id = ?', [a.to, a.id]);
      } else if (a.type === 'delete') {
        await c.query('UPDATE mst_batchcategory SET IsDelete = 1 WHERE id = ?', [a.id]);
      } else if (a.type === 'insert') {
        await c.query(
          "INSERT INTO mst_batchcategory (BatchCategory, Batch_Type, IsActive, IsDelete) VALUES (?, 'Inhouse', 1, 0)",
          [a.name]
        );
      }
    }
    await c.commit();
    console.log('Applied.');
  } catch (e) {
    await c.rollback();
    console.error('Rolled back:', e.message);
    process.exit(1);
  }
} else {
  console.log('\nDry-run only. Re-run with --apply to execute.');
}
await c.end();
