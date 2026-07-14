/**
 * Transfer ALL genuinely-missing fee-payment receipts from the legacy DB
 * (OLD_DB_*) into the current DB, DB-wide.
 *
 * A legacy row is imported only when ALL of these hold:
 *   - it is a credit/payment row (TypeR = 'C')
 *   - it is active in legacy (IsDelete = 0)          → skip voided drafts
 *   - its Fees_Id does not already exist in current  → not already transferred
 *   - the student exists in current student_master   → no orphan rows
 *   - NO active credit row already exists in current for the same
 *     (Student_Id, Amount, RDate)                     → the same payment kept
 *     under a different receipt number / Fees_Id in each DB. This is the trap
 *     that caused double-counting during the 10025/10026 pass (legacy R-02/001
 *     vs current R-02/005 for the same 40 000 payment), so it is skipped.
 *
 * For imported rows that have a blank Fees_Code, a canonical R-MM/NNN receipt
 * number is generated for the payment's own month (continuing that month's
 * running sequence, unique within this run).
 *
 * Usage:
 *   node scripts/db/transfer-missing-fee-receipts.mjs           # dry run
 *   node scripts/db/transfer-missing-fee-receipts.mjs --apply   # execute
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const APPLY = process.argv.includes('--apply');
// Restrict to recent (2025-2026) payments — the active batches. The bulk of
// legacy's missing rows are 2008-2020 historical data the new system never
// carried; those are deliberately out of scope.
const RECENT_ONLY = !process.argv.includes('--all');
const isRecent = (r) => {
  const y = String(r.FeesYear ?? '');
  const ry = String(r.RDate ?? '').trim().slice(0, 4);
  return y === '2025' || y === '2026' || ry === '2025' || ry === '2026';
};

const norm = (v) => String(v ?? '').trim();
const amtKey = (a) => Number(a || 0).toFixed(2);
const dayKey = (d) => norm(d).slice(0, 10);

async function main() {
  const cur = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  });
  const old = await mysql.createConnection({
    host: process.env.OLD_DB_HOST, port: Number(process.env.OLD_DB_PORT || 3306),
    database: process.env.OLD_DB_NAME, user: process.env.OLD_DB_USER, password: process.env.OLD_DB_PASSWORD,
  });

  // Current state -------------------------------------------------------
  const [curRows] = await cur.query(
    `SELECT Fees_Id, Student_Id, Fees_Code, TypeR, Amount, RDate, IsDelete FROM s_fees_mst`
  );
  const curFeesIds = new Set(curRows.map((r) => r.Fees_Id));
  // Per-student list of current credit rows, for robust duplicate detection.
  // A legacy row is a duplicate of an existing current payment when, for the
  // same student & amount, EITHER an active current credit falls within a
  // ±DAY_WINDOW day window (same payment re-dated across systems) OR ANY
  // current credit with that amount was voided (IsDelete=1) — the operator
  // already removed that payment, so it must not be resurrected.
  const DAY_WINDOW = 12;
  const curCreditByStudent = new Map(); // sid -> [{amt, t, deleted}]
  const dayMs = 24 * 3600 * 1000;
  const toT = (d) => { const s = dayKey(d); const t = Date.parse(s); return Number.isFinite(t) ? t : null; };
  for (const r of curRows) {
    if (r.TypeR !== 'C') continue;
    if (!curCreditByStudent.has(r.Student_Id)) curCreditByStudent.set(r.Student_Id, []);
    curCreditByStudent.get(r.Student_Id).push({ amt: amtKey(r.Amount), t: toT(r.RDate), deleted: r.IsDelete === 1 });
  }
  const isDuplicatePayment = (sid, amount, rdate) => {
    const list = curCreditByStudent.get(sid);
    if (!list) return false;
    const a = amtKey(amount);
    const t = toT(rdate);
    for (const c of list) {
      if (c.amt !== a) continue;
      if (c.deleted) return true;                                  // voided in current
      if (t != null && c.t != null && Math.abs(c.t - t) <= DAY_WINDOW * dayMs) return true; // near-date active dup
      if ((t == null || c.t == null) && c.amt === a) return true;  // undated but same amount
    }
    return false;
  };
  const [curStudents] = await cur.query(`SELECT Student_Id FROM student_master`);
  const curStudentIds = new Set(curStudents.map((r) => r.Student_Id));

  // existing receipt-code sequences per month (for blank-code generation)
  const monthMaxSeq = {}; // 'MM' -> max seq
  for (const r of curRows) {
    const code = norm(r.Fees_Code);
    const m = code.match(/^R-(\d{2})\/(\d+)$/);
    if (m) {
      const mm = m[1];
      const seq = Number(m[2]);
      if (!(mm in monthMaxSeq) || seq > monthMaxSeq[mm]) monthMaxSeq[mm] = seq;
    }
  }

  // Legacy candidates ---------------------------------------------------
  const [oldRows] = await old.query(
    `SELECT * FROM S_Fees_Mst WHERE TypeR = 'C' AND IsDelete = 0`
  );

  const toImport = [];
  const skipped = { alreadyPresent: 0, notCredit: 0, deleted: 0, noStudent: 0, duplicatePayment: 0, outOfScope: 0 };

  for (const r of oldRows) {
    if (curFeesIds.has(r.Fees_Id)) { skipped.alreadyPresent++; continue; }
    if (RECENT_ONLY && !isRecent(r)) { skipped.outOfScope++; continue; }
    if (!curStudentIds.has(r.Student_Id)) { skipped.noStudent++; continue; }
    if (isDuplicatePayment(r.Student_Id, r.Amount, r.RDate)) { skipped.duplicatePayment++; continue; }
    toImport.push(r);
    // reserve this payment so two legacy rows that dupe each other don't both import
    if (!curCreditByStudent.has(r.Student_Id)) curCreditByStudent.set(r.Student_Id, []);
    curCreditByStudent.get(r.Student_Id).push({ amt: amtKey(r.Amount), t: toT(r.RDate), deleted: false });
  }

  // Assign generated codes for blank-code imports
  const genForMonth = (mm) => {
    const next = (monthMaxSeq[mm] ?? 0) + 1;
    monthMaxSeq[mm] = next;
    return `R-${mm}/${String(next).padStart(3, '0')}`;
  };
  let blankGenerated = 0, codedKept = 0;
  for (const r of toImport) {
    if (!norm(r.Fees_Code)) {
      const mm = dayKey(r.RDate).slice(5, 7) || String(new Date().getMonth() + 1).padStart(2, '0');
      if (/^\d{2}$/.test(mm)) { r.__genCode = genForMonth(mm); blankGenerated++; }
    } else codedKept++;
  }

  const total = toImport.reduce((s, r) => s + Number(r.Amount || 0), 0);
  console.log(`Mode: ${RECENT_ONLY ? 'RECENT ONLY (2025-2026)' : 'ALL YEARS'}`);
  console.log(`Legacy active credit rows scanned: ${oldRows.length}`);
  console.log(`Skipped — already in current:        ${skipped.alreadyPresent}`);
  if (RECENT_ONLY) console.log(`Skipped — out of scope (pre-2025):   ${skipped.outOfScope}`);
  console.log(`Skipped — student not in current:    ${skipped.noStudent}`);
  console.log(`Skipped — duplicate payment (same student+amount+date): ${skipped.duplicatePayment}`);
  console.log(`\nTO IMPORT: ${toImport.length} rows, total Rs. ${total.toLocaleString('en-IN')}`);
  console.log(`  with existing receipt code: ${codedKept}`);
  console.log(`  blank code → generated:     ${blankGenerated}`);

  if (!APPLY) {
    console.log('\nSample (first 25):');
    for (const r of toImport.slice(0, 25)) {
      console.log(`  stu ${r.Student_Id}  FeesId ${r.Fees_Id}  ${norm(r.Fees_Code) || r.__genCode + ' (gen)'}  Rs.${r.Amount}  ${dayKey(r.RDate)}`);
    }
    console.log('\nDRY RUN — nothing written. Re-run with --apply to execute.');
    await cur.end(); await old.end();
    return;
  }

  // Apply ---------------------------------------------------------------
  const [colRows] = await cur.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's_fees_mst' ORDER BY ORDINAL_POSITION`
  );
  const colNames = colRows.map((c) => c.COLUMN_NAME);

  let done = 0;
  for (const r of toImport) {
    if (r.__genCode) r.Fees_Code = r.__genCode;
    const cols = colNames.filter((c) => c in r);
    await cur.query(
      `INSERT IGNORE INTO s_fees_mst (${cols.map((c) => '`' + c + '`').join(',')})
       VALUES (${cols.map(() => '?').join(',')})`,
      cols.map((c) => r[c])
    );
    done++;
  }
  console.log(`\nAPPLIED — imported ${done} receipt rows.`);

  await cur.end(); await old.end();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
