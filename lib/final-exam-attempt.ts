/**
 * Final exam attempts. A batch's final exam can be sat up to three times: the
 * regular exam, then up to two re-exams. Each sitting (final_exam_master row)
 * records which attempt it is in Attempt_No (1, 2 or 3).
 *
 * Older sittings have no Attempt_No; for those the attempt is inferred from the
 * exam's subject name ("Re-Final Exam", "REEXAM", "Repeat - Final Exam", …) —
 * final_exam_master.Test_No is NOT an attempt number, since multi-paper finals
 * also use Test_No 2, 3….
 *
 * Client-safe (no database imports) — the schema check is in
 * lib/final-exam-attempt-schema.ts.
 */

export const FINAL_EXAM_ATTEMPTS = [
  { value: 1, label: 'First Attempt (Regular)' },
  { value: 2, label: 'Second Attempt (Re-Exam)' },
  { value: 3, label: 'Third Attempt (Re-Exam II)' },
] as const;

export const MAX_FINAL_EXAM_ATTEMPT = 3;

/** Subject name of a re-exam paper, for sittings recorded before Attempt_No existed. */
export const RE_EXAM_PATTERN = /re[\s-]*exam|re[\s-]*final|repeat|rexam/i;

/** The recorded attempt (1–3), or null when the sitting predates Attempt_No. */
export function recordedAttempt(attemptNo: unknown): number | null {
  const n = Number(attemptNo);
  return Number.isInteger(n) && n >= 1 && n <= MAX_FINAL_EXAM_ATTEMPT ? n : null;
}

/** True when a sitting is a re-exam (attempt 2+), by Attempt_No or else by subject name. */
export function isReExamSitting(attemptNo: unknown, subject: unknown): boolean {
  const recorded = recordedAttempt(attemptNo);
  return recorded !== null ? recorded >= 2 : RE_EXAM_PATTERN.test(String(subject || ''));
}
