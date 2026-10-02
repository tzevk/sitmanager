/**
 * Normalized academic status for any individual mark (assignment, unit test,
 * final exam attempt, viva/MOC). 0 is a valid mark — nothing here uses
 * `!marks`; "no mark" is only ever null.
 *
 *  EVALUATED       a mark is recorded (including 0)
 *  ABSENT          recorded absent for a test / exam, no mark
 *  NOT_SUBMITTED   assignment recorded as not submitted, no mark
 *  NOT_EVALUATED   nothing recorded yet for this student, or a blank mark
 *  RESULT_PENDING  a result exists but is not published to students yet
 *  NOT_APPLICABLE  doesn't apply to this student (e.g. a re-exam they didn't sit)
 *
 * Attendance never changes this status — "absent on the lecture date" is a
 * separate fact carried alongside it.
 */
export type AcademicStatus =
  | 'EVALUATED'
  | 'ABSENT'
  | 'NOT_SUBMITTED'
  | 'NOT_EVALUATED'
  | 'RESULT_PENDING'
  | 'NOT_APPLICABLE';

export type AssessmentKind = 'ASSIGNMENT' | 'UNIT_TEST' | 'FINAL_EXAM' | 'VIVA_MOC';

/** Parses a stored mark. Accepts numbers and numeric strings (exam_taken_child
 * stores VARCHAR); '', null and non-numeric text are "no mark". 0 stays 0. */
export function parseMark(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const text = String(raw).trim();
  if (text === '' || !/^-?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
}

export interface NormalizedMark {
  status: AcademicStatus;
  marks: number | null;
  /** True when the stored status says Absent but a mark was recorded anyway —
   * the mark is kept (it is a recorded fact); the conflict is surfaced so it can
   * be challenged, not silently resolved. */
  statusConflict: boolean;
}

/**
 * @param row  the student's stored row, or null when none exists
 * @param kind which kind of assessment (decides ABSENT vs NOT_SUBMITTED)
 */
export function normalizeMark(
  row: { marks: unknown; status: unknown } | null,
  kind: AssessmentKind
): NormalizedMark {
  if (!row) return { status: 'NOT_EVALUATED', marks: null, statusConflict: false };
  const marks = parseMark(row.marks);
  const recordedAbsent = String(row.status ?? '').trim().toLowerCase() === 'absent';

  if (marks !== null) {
    // An absent-with-zero row is the CRM's way of recording "absent" (the staff
    // forms store 0 for absent students), so 0 + Absent is not a mark.
    if (recordedAbsent && marks === 0) {
      return { status: kind === 'ASSIGNMENT' ? 'NOT_SUBMITTED' : 'ABSENT', marks: null, statusConflict: false };
    }
    return { status: 'EVALUATED', marks, statusConflict: recordedAbsent };
  }
  if (recordedAbsent) {
    return { status: kind === 'ASSIGNMENT' ? 'NOT_SUBMITTED' : 'ABSENT', marks: null, statusConflict: false };
  }
  return { status: 'NOT_EVALUATED', marks: null, statusConflict: false };
}

/** Student-facing label for a status. */
export function statusLabel(status: AcademicStatus): string {
  switch (status) {
    case 'EVALUATED': return 'Evaluated';
    case 'ABSENT': return 'Absent';
    case 'NOT_SUBMITTED': return 'Not Submitted';
    case 'NOT_EVALUATED': return 'Evaluation Pending';
    case 'RESULT_PENDING': return 'Result Pending';
    case 'NOT_APPLICABLE': return 'Not Applicable';
  }
}
