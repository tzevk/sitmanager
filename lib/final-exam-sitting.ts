/* eslint-disable @typescript-eslint/no-explicit-any */
import { RE_EXAM_PATTERN, recordedAttempt } from '@/lib/final-exam-attempt';
import { ensureFinalExamAttemptColumn } from '@/lib/final-exam-attempt-schema';

/**
 * Create / update a final exam sitting (final_exam_master row), including
 * re-exams. When a sitting is flagged as a re-exam (attempt 2 or 3) and no exam
 * entry is chosen, the batch master's exam entry for it ("Re-Final Exam" /
 * "Re-Final Exam - II" in batch_final_exam) is reused if it already exists, or
 * created — so staff don't have to add it in Batch Master first.
 *
 * Everything runs in one transaction under a named lock (FINAL_EXAM_LOCK): two
 * people saving the same re-exam at once can't create duplicate batch master
 * entries or duplicate sittings.
 *
 * batch_final_exam has no primary key or AUTO_INCREMENT — Exam_Id is a plain INT
 * — so new entries get MAX(Exam_Id) + 1, allocated under the same lock. Inserting
 * without an Exam_Id leaves it NULL, and such an entry can never be linked to a
 * sitting.
 */

/** Serialises Exam_Id allocation and re-exam sitting checks across all sessions. */
export const FINAL_EXAM_LOCK = 'sit:final_exam_entries';

async function acquireFinalExamLock(conn: any): Promise<void> {
  const [[row]] = await conn.query('SELECT GET_LOCK(?, 10) AS ok', [FINAL_EXAM_LOCK]);
  if (Number(row?.ok) !== 1) {
    throw new SittingError('Another final exam is being saved right now — please try again in a moment', 409);
  }
}

async function releaseFinalExamLock(conn: any): Promise<void> {
  await conn.query('SELECT RELEASE_LOCK(?)', [FINAL_EXAM_LOCK]).catch(() => {});
}

export interface BatchFinalExamEntry {
  batchId: number;
  subject: string;
  examDate?: string | null;
  maxMarks?: number | string | null;
  duration?: string | null;
}

/** Inserts a batch master exam entry with the next Exam_Id. Caller must hold FINAL_EXAM_LOCK. */
async function insertBatchFinalExam(conn: any, e: BatchFinalExamEntry): Promise<number> {
  const [[next]] = await conn.query('SELECT COALESCE(MAX(Exam_Id), 0) + 1 AS id FROM batch_final_exam');
  const examId = Number(next.id);
  await conn.query(
    `INSERT INTO batch_final_exam (Exam_Id, Batch_Id, Subject, Exam_Date, Max_Marks, Duration, IsActive, IsDelete)
     VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
    [examId, e.batchId, e.subject, e.examDate || null, e.maxMarks || null, e.duration || null]
  );
  return examId;
}

/** Adds a batch master final exam entry (Batch Master → Final Exam Details). */
export async function addBatchFinalExam(pool: any, e: BatchFinalExamEntry): Promise<number> {
  const conn = await pool.getConnection();
  let locked = false;
  try {
    await acquireFinalExamLock(conn);
    locked = true;
    return await insertBatchFinalExam(conn, e);
  } finally {
    if (locked) await releaseFinalExamLock(conn);
    conn.release();
  }
}

export class SittingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface SittingInput {
  Course_Id?: unknown;
  Batch_Id?: unknown;
  Exam_Id?: unknown;
  Test_No?: unknown;
  Attempt_No?: unknown;
  Max_Marks?: unknown;
  Exam_Dt?: unknown;
}

export interface SittingResult {
  Take_Id: number;
  Exam_Id: number | null;
  Attempt_No: number;
  /** Subject of the batch master entry created by this save, if any. */
  createdReExamEntry: string | null;
}

/** Batch master subject used for an automatically created re-exam entry. */
export function reExamSubject(attempt: number): string {
  return attempt >= 3 ? 'Re-Final Exam - II' : 'Re-Final Exam';
}

const ATTEMPT_NAMES: Record<number, string> = { 2: 'Second Attempt', 3: 'Third Attempt' };
const toInt = (v: unknown) => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function saveFinalExamSitting(pool: any, input: SittingInput, takeId: number | null = null): Promise<SittingResult> {
  const batchId = toInt(input.Batch_Id);
  const courseId = toInt(input.Course_Id);
  const examDate = String(input.Exam_Dt ?? '').trim() || null;
  const attempt = recordedAttempt(input.Attempt_No) ?? 1;
  const isReExam = attempt >= 2;
  let examId = toInt(input.Exam_Id);
  const maxMarks = toInt(input.Max_Marks);
  let testNo = toInt(input.Test_No);

  if (!courseId || !batchId || !examDate) throw new SittingError('Course, Batch, and Exam Date are required');
  if (isReExam && !maxMarks) throw new SittingError('Max Marks is required for a re-exam');

  await ensureFinalExamAttemptColumn(pool);

  const conn = await pool.getConnection();
  let locked = false;
  try {
    // Lock first, then start the transaction, so its snapshot already includes
    // anything the previous lock holder committed (e.g. the last Exam_Id).
    await acquireFinalExamLock(conn);
    locked = true;

    await conn.beginTransaction();
    let createdReExamEntry: string | null = null;

    if (examId && !takeId) {
      // New sittings must use one of this batch's own exam entries. (Not enforced
      // on edits, so older records with mismatched entries stay editable.)
      const [own] = await conn.query(
        'SELECT Exam_Id FROM batch_final_exam WHERE Exam_Id = ? AND Batch_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)',
        [examId, batchId]
      );
      if ((own as any[]).length === 0) throw new SittingError('The selected exam is not in this batch’s master — reselect it');
    } else if (isReExam && !examId) {
      // No exam entry chosen for a re-exam: reuse this attempt's batch master entry, or create it.
      const subject = reExamSubject(attempt);
      const [existing] = await conn.query(
        `SELECT Exam_Id FROM batch_final_exam
         WHERE Batch_Id = ? AND LOWER(TRIM(Subject)) = LOWER(?) AND (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY Exam_Id LIMIT 1`,
        [batchId, subject]
      );
      if ((existing as any[]).length > 0) {
        examId = Number((existing as any[])[0].Exam_Id);
      } else {
        // Same duration as the batch's regular exam, if it has one.
        const [defs] = await conn.query(
          `SELECT Subject, Duration FROM batch_final_exam
           WHERE Batch_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Exam_Id`,
          [batchId]
        );
        const regular = (defs as any[]).filter((d) => !RE_EXAM_PATTERN.test(String(d.Subject || '')));
        examId = await insertBatchFinalExam(conn, {
          batchId, subject, examDate, maxMarks, duration: regular[0]?.Duration ?? null,
        });
        createdReExamEntry = subject;
      }
    }

    if (isReExam) {
      // One sitting per re-exam attempt per batch.
      const [dupes] = await conn.query(
        `SELECT Take_Id, DATE_FORMAT(Test_Dt, '%d-%m-%Y') AS Dt FROM final_exam_master
         WHERE Batch_Id = ? AND Attempt_No = ? AND (IsDelete = 0 OR IsDelete IS NULL) ${takeId ? 'AND Take_Id <> ?' : ''}
         LIMIT 1`,
        takeId ? [batchId, attempt, takeId] : [batchId, attempt]
      );
      const dupe = (dupes as any[])[0];
      if (dupe) {
        throw new SittingError(
          `The ${ATTEMPT_NAMES[attempt]} re-exam is already recorded for this batch (dated ${dupe.Dt}). Open it from the list to enter marks.`,
          409
        );
      }
      if (!testNo) {
        const [[mx]] = await conn.query(
          `SELECT COALESCE(MAX(Test_No), 0) AS m FROM final_exam_master
           WHERE Batch_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL) ${takeId ? 'AND Take_Id <> ?' : ''}`,
          takeId ? [batchId, takeId] : [batchId]
        );
        testNo = Number(mx?.m || 0) + 1;
      }
    }

    let savedTakeId = takeId;
    if (takeId) {
      const [upd] = await conn.query(
        `UPDATE final_exam_master SET
           Course_Id = ?, Batch_Id = ?, Test_Id = ?, Test_No = ?, Attempt_No = ?, Marks = ?, Test_Dt = ?
         WHERE Take_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
        [courseId, batchId, examId, testNo, attempt, maxMarks, examDate, takeId]
      );
      if (Number((upd as any).affectedRows) === 0) throw new SittingError('Final exam record not found', 404);
    } else {
      const [ins] = await conn.query(
        `INSERT INTO final_exam_master (Course_Id, Batch_Id, Test_Id, Test_No, Attempt_No, Marks, Test_Dt, IsActive, IsDelete)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`,
        [courseId, batchId, examId, testNo, attempt, maxMarks, examDate]
      );
      savedTakeId = Number((ins as any).insertId);
    }

    await conn.commit();
    return { Take_Id: savedTakeId!, Exam_Id: examId, Attempt_No: attempt, createdReExamEntry };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    if (locked) await releaseFinalExamLock(conn);
    conn.release();
  }
}
