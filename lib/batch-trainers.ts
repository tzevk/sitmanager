/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Trainers linked to a batch, picked on Batch Master ("Trainers" field). This
 * decides which batches a trainer sees in the Trainer Portal.
 *
 * A batch with no trainers picked yet falls back to the older implicit link —
 * the trainer is the faculty on one of its lecture-plan rows, or has taken a
 * lecture in it — so nobody loses their batches before staff fill this in.
 */

let tableReady: Promise<void> | null = null;

export function ensureBatchTrainerTable(pool: any): Promise<void> {
  if (!tableReady) {
    tableReady = pool.query(
      `CREATE TABLE IF NOT EXISTS batch_trainer (
         batch_id INT NOT NULL,
         faculty_id INT NOT NULL,
         created_at DATETIME NULL,
         PRIMARY KEY (batch_id, faculty_id),
         KEY idx_batch_trainer_faculty (faculty_id)
       )`
    ).then(() => undefined).catch((err: unknown) => { tableReady = null; throw err; });
  }
  return tableReady!;
}

/**
 * SQL condition (alias `b` = batch_mst) selecting the batches a trainer may
 * see. Takes three params, all the trainer's Faculty_Id: trainerBatchParams().
 */
export const TRAINER_BATCH_CONDITION = `(
  EXISTS (SELECT 1 FROM batch_trainer bt WHERE bt.batch_id = b.Batch_Id AND bt.faculty_id = ?)
  OR (
    NOT EXISTS (SELECT 1 FROM batch_trainer bt0 WHERE bt0.batch_id = b.Batch_Id)
    AND (
      EXISTS (SELECT 1 FROM batch_slecture_master bsl
              WHERE bsl.batch_id = b.Batch_Id AND bsl.faculty_id = ?
                AND (bsl.deleted IS NULL OR bsl.deleted = '0' OR bsl.deleted = 0))
      OR EXISTS (SELECT 1 FROM lecture_taken_master ltm
                 WHERE ltm.Batch_Id = b.Batch_Id AND ltm.Faculty_Id = ?
                   AND (ltm.IsDelete = 0 OR ltm.IsDelete IS NULL))
    )
  )
)`;

export const trainerBatchParams = (facultyId: number) => [facultyId, facultyId, facultyId];

/** Whether this trainer may see / act on this batch. */
export async function trainerCanAccessBatch(pool: any, facultyId: number, batchId: number): Promise<boolean> {
  if (!facultyId || !batchId) return false;
  await ensureBatchTrainerTable(pool);
  const [rows] = await pool.query(
    `SELECT 1 FROM batch_mst b WHERE b.Batch_Id = ? AND ${TRAINER_BATCH_CONDITION} LIMIT 1`,
    [batchId, ...trainerBatchParams(facultyId)]
  );
  return (rows as any[]).length > 0;
}

export async function getBatchTrainerIds(pool: any, batchId: number): Promise<number[]> {
  await ensureBatchTrainerTable(pool);
  const [rows] = await pool.query(
    `SELECT faculty_id FROM batch_trainer WHERE batch_id = ? ORDER BY faculty_id`,
    [batchId]
  );
  return (rows as any[]).map((r) => Number(r.faculty_id));
}

/** Replaces the batch's trainer list. */
export async function setBatchTrainerIds(pool: any, batchId: number, facultyIds: number[]) {
  await ensureBatchTrainerTable(pool);
  const ids = [...new Set(facultyIds.filter((n) => Number.isFinite(n) && n > 0))];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM batch_trainer WHERE batch_id = ?`, [batchId]);
    if (ids.length) {
      await conn.query(
        `INSERT INTO batch_trainer (batch_id, faculty_id, created_at) VALUES ${ids.map(() => '(?, ?, NOW())').join(',')}`,
        ids.flatMap((id) => [batchId, id])
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
