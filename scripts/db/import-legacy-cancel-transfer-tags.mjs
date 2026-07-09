/**
 * Backfill Cancelled / Transferred tags for students whose cancellation or batch
 * transfer only ever happened in the legacy system (never went through the app's
 * own Edit Student flow, so student_master.Transfered / Moved_To_Batch_Code /
 * Moved_From_Batch_Code and admission_master.Cancel were never populated here).
 *
 * Sources in the legacy DB (OLD_DB_*):
 *   - Batch_cancel (IsDelete=0 AND IsActive=1): Student_Id + Batch_Id → cancelled.
 *     Batch_Id numbering is shared 1:1 with the main DB's batch_mst (verified by
 *     spot-checking overlapping ids), so it's matched directly against
 *     admission_master.Student_Id + Batch_Id — no batch-code translation needed.
 *   - awt_batchtransfer (deleted=0): student, oldbatch_code, trans_batchcode — all
 *     three are Batch_Id values (same shared numbering), resolved to Batch_code
 *     strings via the main DB's own batch_mst.
 *   - awt_batchmoving (deleted=0): student_id, batch_code, newbatch_code — already
 *     stored as Batch_code strings matching batch_mst.Batch_code directly.
 *   Where a student appears in more than one transfer source/row, the most recent
 *   event (by created_date) wins, matching the app's single-current-state model.
 *
 * Idempotent / non-destructive: only fills students whose Cancel/Transfered field is
 * currently empty — never overwrites a transfer/cancellation already tracked via the
 * app itself. Safe to re-run.
 *
 * Usage:
 *   node scripts/db/import-legacy-cancel-transfer-tags.mjs           (dry run)
 *   node scripts/db/import-legacy-cancel-transfer-tags.mjs --apply   (writes)
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const apply = process.argv.includes('--apply');

const conn = (o) => mysql.createConnection({
  host: o.h, port: o.p ? Number(o.p) : 3306, user: o.u, password: o.pw, database: o.d, dateStrings: true,
});

function isYes(v) {
  return ['yes', '1', 'true'].includes(String(v ?? '').trim().toLowerCase());
}

async function main() {
  const old = await conn({ h: process.env.OLD_DB_HOST, p: process.env.OLD_DB_PORT, u: process.env.OLD_DB_USER, pw: process.env.OLD_DB_PASSWORD, d: process.env.OLD_DB_NAME });
  const cur = await conn({ h: process.env.DB_HOST, p: process.env.DB_PORT, u: process.env.DB_USER, pw: process.env.DB_PASSWORD, d: process.env.DB_NAME });

  console.log(`Mode: ${apply ? 'APPLY (writing)' : 'DRY-RUN (no writes)'}`);

  // ── 1. Cancellations ────────────────────────────────────────────────────
  const [cancelRows] = await old.query(
    `SELECT Student_Id, Batch_Id FROM Batch_cancel WHERE IsDelete = 0 AND IsActive = 1`
  );
  console.log(`Legacy cancellation records: ${cancelRows.length}`);

  let cancelMatched = 0;
  let cancelUpdated = 0;
  for (const row of cancelRows) {
    const studentId = Number(row.Student_Id);
    const batchId = Number(row.Batch_Id);
    if (!studentId || !batchId) continue;

    const [admRows] = await cur.query(
      `SELECT Admission_Id, Cancel FROM admission_master
       WHERE Student_Id = ? AND Batch_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Admission_Id DESC LIMIT 1`,
      [studentId, batchId]
    );
    const adm = admRows[0];
    if (!adm) continue;
    cancelMatched++;
    if (isYes(adm.Cancel)) continue; // already tracked

    cancelUpdated++;
    if (apply) {
      await cur.query(`UPDATE admission_master SET Cancel = 'Yes' WHERE Admission_Id = ?`, [adm.Admission_Id]);
    }
  }
  console.log(`Cancellations matched to an admission row: ${cancelMatched}, needing update: ${cancelUpdated}`);

  // ── 2. Transfers ────────────────────────────────────────────────────────
  const [batchMst] = await cur.query(`SELECT Batch_Id, Batch_code, Course_Id FROM batch_mst`);
  const batchById = new Map(batchMst.map((b) => [Number(b.Batch_Id), b]));
  const batchByCode = new Map(batchMst.map((b) => [String(b.Batch_code).trim().toUpperCase(), b]));

  const transferEvents = new Map(); // Student_Id -> { fromCode, toCode, toBatch, at }

  const considerEvent = (studentId, fromBatch, toBatch, at) => {
    if (!studentId || !fromBatch || !toBatch) return;
    const prev = transferEvents.get(studentId);
    if (prev && prev.at >= at) return;
    transferEvents.set(studentId, {
      fromCode: fromBatch.Batch_code,
      toCode: toBatch.Batch_code,
      toCourseId: toBatch.Course_Id,
      at,
    });
  };

  const [transferRows] = await old.query(
    `SELECT student, oldbatch_code, trans_batchcode, created_date, updated_date
     FROM awt_batchtransfer WHERE deleted = 0`
  );
  for (const row of transferRows) {
    const studentId = Number(row.student);
    const fromBatch = batchById.get(Number(row.oldbatch_code));
    const toBatch = batchById.get(Number(row.trans_batchcode));
    const at = new Date(row.updated_date || row.created_date || 0).getTime();
    considerEvent(studentId, fromBatch, toBatch, at);
  }

  const [movingRows] = await old.query(
    `SELECT student_id, batch_code, newbatch_code, created_date, updated_date
     FROM awt_batchmoving WHERE deleted = 0`
  );
  for (const row of movingRows) {
    const studentId = Number(row.student_id);
    const fromBatch = batchByCode.get(String(row.batch_code ?? '').trim().toUpperCase());
    const toBatch = batchByCode.get(String(row.newbatch_code ?? '').trim().toUpperCase());
    const at = new Date(row.updated_date || row.created_date || 0).getTime();
    considerEvent(studentId, fromBatch, toBatch, at);
  }

  console.log(`Legacy transfer events resolved: ${transferEvents.size}`);

  let transferMatched = 0;
  let transferUpdated = 0;
  for (const [studentId, ev] of transferEvents) {
    const [smRows] = await cur.query(
      `SELECT Student_Id, Transfered FROM student_master WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [studentId]
    );
    const sm = smRows[0];
    if (!sm) continue;
    transferMatched++;
    if (isYes(sm.Transfered)) continue; // already tracked

    transferUpdated++;
    if (apply) {
      await cur.query(
        `UPDATE student_master
         SET Transfered = 'Yes', Moved_From_Batch_Code = ?, Moved_To_Batch_Code = ?, Moved_To_Course_Id = ?
         WHERE Student_Id = ?`,
        [ev.fromCode, ev.toCode, ev.toCourseId, studentId]
      );
    }
  }
  console.log(`Transfers matched to a student: ${transferMatched}, needing update: ${transferUpdated}`);

  await old.end();
  await cur.end();
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
