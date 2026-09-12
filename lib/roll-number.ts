import type { Pool, PoolConnection } from 'mysql2/promise';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Canonical roll number format used across this institute:
// {2-digit batch start year}{5-digit batch code}{4-digit sequential serial}
// e.g. batch "09071" starting in 2026, student #3 → "26090710003".
// Derived from the batch's own start year (not "today"), so the prefix a
// batch gets doesn't shift depending on when within its life a roll number
// happens to be allotted.
export function rollNumberPrefix(batchCode: string, sdate: unknown): string {
  const code = String(batchCode || '').trim();
  const date = sdate ? new Date(String(sdate)) : null;
  const yy = date && !Number.isNaN(date.getTime())
    ? String(date.getFullYear()).slice(-2)
    : String(new Date().getFullYear()).slice(-2);
  return `${yy}${code}`;
}

export function buildRollNumber(prefix: string, serial: number): string {
  return `${prefix}${String(serial).padStart(4, '0')}`;
}

/**
 * Assigns a roll number to a freshly-granted admission, once, permanently —
 * the number is simply "one past whatever's already used in this batch", so
 * it never depends on alphabetical name order and never has to be
 * recomputed when a later student is admitted. Call this exactly once, right
 * after inserting the admission_master row for a newly-granted admission.
 *
 * Does nothing (and returns null) if the row already has a Roll_No, or if
 * the batch can't be resolved — callers should treat a null return as
 * non-fatal (the Allot Roll Number page's manual "Auto Generate" action
 * remains available as a fallback for any row this doesn't reach).
 */
export async function assignRollNumberOnGrant(
  db: Pool | PoolConnection,
  admissionId: number,
  batchId: number
): Promise<string | null> {
  if (!admissionId || !batchId) return null;

  const [existingRows] = await db.query(
    `SELECT TRIM(CAST(Roll_No AS CHAR)) AS Roll_No FROM admission_master WHERE Admission_Id = ? LIMIT 1`,
    [admissionId]
  ) as [any[], any];
  if (existingRows[0]?.Roll_No) return existingRows[0].Roll_No; // already assigned — never overwrite

  const [batchRows] = await db.query(
    `SELECT Batch_code, SDate FROM batch_mst WHERE Batch_Id = ? LIMIT 1`,
    [batchId]
  ) as [any[], any];
  const batch = batchRows[0];
  if (!batch) return null;

  const prefix = rollNumberPrefix(batch.Batch_code, batch.SDate);

  // Next serial = one past the highest already used under this batch's own
  // prefix — appends at the end of the sequence regardless of the new
  // student's name, so no existing student's roll number ever shifts.
  const [rollRows] = await db.query(
    `SELECT TRIM(CAST(Roll_No AS CHAR)) AS Roll_No
     FROM admission_master
     WHERE Batch_Id = ? AND Roll_No LIKE ?`,
    [batchId, `${prefix}%`]
  ) as [any[], any];

  let maxSerial = 0;
  for (const row of rollRows) {
    const roll = String(row.Roll_No || '');
    if (roll.startsWith(prefix) && /^\d{4}$/.test(roll.slice(prefix.length))) {
      const serial = Number(roll.slice(prefix.length));
      if (serial > maxSerial) maxSerial = serial;
    }
  }

  const rollNo = buildRollNumber(prefix, maxSerial + 1);
  await db.query(
    `UPDATE admission_master SET Roll_No = ? WHERE Admission_Id = ? AND (Roll_No IS NULL OR TRIM(CAST(Roll_No AS CHAR)) = '')`,
    [rollNo, admissionId]
  );
  return rollNo;
}
