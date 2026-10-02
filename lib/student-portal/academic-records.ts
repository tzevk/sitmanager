/* eslint-disable @typescript-eslint/no-explicit-any */
import { isReExamSitting, recordedAttempt } from '@/lib/final-exam-attempt';
import { hasFinalExamAttemptColumn } from '@/lib/final-exam-attempt-schema';
import { getAbsentAllDayByDate } from '@/lib/student-portal/academic-attendance';
import { normalizeMark, type AcademicStatus, type AssessmentKind } from '@/lib/student-portal/academic-status';
import type { StudentPortalContext } from '@/lib/student-portal/context';

/**
 * One data contract for every individual academic record a student can see —
 * the base for Results, the Performance Report and Raise an Issue. Reads the
 * CRM's own tables directly; nothing is copied or cached.
 *
 *  ASSIGNMENT  assignment_taken (sheet)        + assignment_given_child (student row)
 *  UNIT_TEST   test_taken_master (sitting)     + test_taken_child
 *  FINAL_EXAM  final_exam_master (sitting)     + exam_taken_child   — one record per attempt sitting
 *  VIVA_MOC    awt_vivamoctaken (batchcode = Batch_Id) + viva_moc_child
 *
 * Data rules (traced from the CRM, see the Phase 2 notes):
 *  - Staff saves don't update in place (no unique key on sheet+student), so a
 *    student can have several rows per sheet; the NEWEST row (highest id) wins.
 *  - Student columns sometimes hold the Admission_Id — both ids are matched.
 *  - Attendance never changes a record's status or mark: absentOnLectureDate is
 *    a separate fact (assignments only, matched by date — there is no direct
 *    assignment → lecture link in the CRM).
 */

export type SourceModule = 'ASSIGNMENT' | 'UNIT_TEST' | 'FINAL_EXAM' | 'VIVA_MOC';

export interface AcademicRecord {
  sourceModule: SourceModule;
  /**
   * Which test this is. ASSIGNMENT / UNIT_TEST: the Batch Master entry
   * (assignmentstaken.id / awt_unittesttaken.id) — stable before and after
   * marks are entered; a legacy sheet with no Batch Master entry uses the
   * negated sheet id. FINAL_EXAM: the sitting (Take_Id). VIVA_MOC: the sheet id.
   */
  parentId: number;
  /** The marks sheet staff fill in (Given_Id / Take_Id / viva id); null when no sheet exists yet. */
  sheetId: number | null;
  /** The student's own row in the child table, or null when nothing is recorded. */
  recordId: number | null;
  studentId: number;
  assessmentName: string;
  assessmentNo: number | null;
  /** Final exam only: 1 = first attempt, 2 / 3 = re-exams. */
  attempt: number | null;
  date: string | null;
  maxMarks: number | null;
  /** The recorded mark (0 is a mark). Hidden from students until published. */
  marksObtained: number | null;
  status: AcademicStatus;
  /** Recorded status says Absent but a mark exists — kept, flagged for review. */
  statusConflict: boolean;
  /** Viva/MOC only: discipline deduction recorded with the entry. */
  disciplineDeduction: number | null;
  /** True / false when lecture attendance exists for that date, else null. */
  absentOnLectureDate: boolean | null;
  /** Marks publishing isn't built yet (decided for a later phase) → always false. */
  published: boolean;
}

/**
 * Whether students may see this record's result. Marks are only visible after
 * publication; no publishing mechanism exists yet, so nothing is published.
 * The later Academics phase replaces this with the real check.
 */
export function isPublished(record: Pick<AcademicRecord, 'sourceModule' | 'parentId'>): boolean {
  void record; // per-record once publishing exists
  return false;
}

/** What a student is allowed to see: unpublished results become RESULT_PENDING
 * with no mark. Records with nothing recorded / not applicable pass through. */
export function toStudentView(record: AcademicRecord): AcademicRecord {
  if (record.published) return record;
  if (record.status === 'NOT_EVALUATED' || record.status === 'NOT_APPLICABLE') return record;
  return { ...record, marksObtained: null, status: 'RESULT_PENDING', statusConflict: false, disciplineDeduction: null };
}

const num = (v: unknown) => (v === null || v === undefined || String(v).trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** Newest row per (parent, student) — rows must be ordered by id ascending. */
function newestByParent(rows: any[], parentCol: string): Map<number, any> {
  const map = new Map<number, any>();
  for (const r of rows) map.set(Number(r[parentCol]), r);
  return map;
}

/** Batch Master dates are free-text varchar; keep YYYY-MM-DD, drop anything else. */
function normDate(v: unknown): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v ?? '').trim());
  return m ? m[1] : null;
}

/**
 * Pairs each Batch Master definition with its marks sheet. When a definition
 * has several sheets (re-entered), the newest one holding this student's row
 * wins, else the newest sheet. Sheets that link to no definition of this batch
 * (legacy data) are returned on their own so recorded marks are never dropped.
 */
function linkSheetsToDefinitions(
  defs: any[], sheets: any[], sheetIdCol: string, defIdCol: string, mine: Map<number, any>
): Array<{ def: any | null; sheet: any | null }> {
  const defIds = new Set(defs.map((d) => Number(d.id)));
  const byDef = new Map<number, any[]>();
  const orphans: any[] = [];
  for (const sh of sheets) {
    const d = Number(sh[defIdCol]);
    if (defIds.has(d)) byDef.set(d, [...(byDef.get(d) ?? []), sh]);
    else orphans.push(sh);
  }
  const out: Array<{ def: any | null; sheet: any | null }> = defs.map((def) => {
    const list = byDef.get(Number(def.id)) ?? []; // ascending by sheet id
    const withMine = list.filter((sh) => mine.has(Number(sh[sheetIdCol])));
    return { def, sheet: withMine.at(-1) ?? list.at(-1) ?? null };
  });
  for (const sh of orphans) out.push({ def: null, sheet: sh });
  return out;
}

export async function getStudentAcademicRecords(
  pool: any,
  ctx: StudentPortalContext,
  modules: SourceModule[] = ['ASSIGNMENT', 'UNIT_TEST', 'FINAL_EXAM', 'VIVA_MOC']
): Promise<AcademicRecord[]> {
  if (!ctx.batchId) return [];
  const batchId = ctx.batchId;
  const ids = [ctx.studentId, ...ctx.batchAdmissionIds];
  const want = new Set(modules);
  const records: AcademicRecord[] = [];
  const base = { studentId: ctx.studentId, published: false, statusConflict: false, disciplineDeduction: null, absentOnLectureDate: null };

  const push = (r: Omit<AcademicRecord, 'published'> & { published?: boolean }) => {
    const rec = { ...r, published: false } as AcademicRecord;
    rec.published = isPublished(rec);
    records.push(rec);
  };

  const fromRow = (row: any, kind: AssessmentKind) => {
    const n = normalizeMark(row ? { marks: row.Marks_Given ?? row.Marks, status: row.Status } : null, kind);
    return { status: n.status, marksObtained: n.marks, statusConflict: n.statusConflict, recordId: row ? Number(row.ID ?? row.id) : null };
  };

  if (want.has('ASSIGNMENT')) {
    // Source of truth: the batch's Assignment list in Batch Master
    // (assignmentstaken). Marks come from the "Assignments Taken" sheet linked
    // to each entry (assignment_taken.Assignment_Id).
    const [defs] = await pool.query(
      `SELECT id, assignmentname, subjects, marks, assignmentdate FROM assignmentstaken
       WHERE batch_id = ? AND (deleted = 0 OR deleted IS NULL)
       ORDER BY id`,
      [String(batchId)]
    );
    const [sheets] = await pool.query(
      `SELECT Given_Id, Assignment_Id, Assign_No, DATE_FORMAT(Assign_Dt, '%Y-%m-%d') AS Assign_Dt, Marks
       FROM assignment_taken
       WHERE Batch_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Given_Id`,
      [batchId]
    );
    const sheetIds = (sheets as any[]).map((s) => s.Given_Id);
    const rows = sheetIds.length
      ? (await pool.query(
          `SELECT ID, Given_Id, Marks_Given, Status FROM assignment_given_child
           WHERE Given_Id IN (?) AND Student_Id IN (?) AND (IsDelete = 0 OR IsDelete IS NULL)
           ORDER BY ID`,
          [sheetIds, ids]
        ))[0]
      : [];
    const mine = newestByParent(rows as any[], 'Given_Id');
    const absentByDate = await getAbsentAllDayByDate(pool, ctx);
    const items = linkSheetsToDefinitions(defs as any[], sheets as any[], 'Given_Id', 'Assignment_Id', mine);
    for (const { def, sheet } of items) {
      const date = sheet?.Assign_Dt ?? normDate(def?.assignmentdate);
      push({
        ...base,
        ...fromRow(sheet ? mine.get(Number(sheet.Given_Id)) ?? null : null, 'ASSIGNMENT'),
        sourceModule: 'ASSIGNMENT',
        parentId: def ? Number(def.id) : -Number(sheet.Given_Id),
        sheetId: sheet ? Number(sheet.Given_Id) : null,
        assessmentName: def?.assignmentname || `Assignment ${sheet?.Assign_No ?? ''}`.trim(),
        assessmentNo: num(sheet?.Assign_No),
        attempt: null,
        date,
        maxMarks: num(def?.marks) ?? num(sheet?.Marks),
        absentOnLectureDate: date && absentByDate.has(date) ? absentByDate.get(date)! : null,
      });
    }
  }

  if (want.has('UNIT_TEST')) {
    // Source of truth: the batch's Unit Test list in Batch Master
    // (awt_unittesttaken). Marks come from the "Unit Test Taken" sheet linked to
    // each entry (test_taken_master.Test_Id).
    const [defs] = await pool.query(
      `SELECT id, subject, marks, utdate FROM awt_unittesttaken
       WHERE batch_id = ? AND (deleted = 0 OR deleted IS NULL)
       ORDER BY id`,
      [String(batchId)]
    );
    const [sheets] = await pool.query(
      `SELECT Take_Id, Test_Id, Test_No, DATE_FORMAT(Test_Dt, '%Y-%m-%d') AS Test_Dt, Marks
       FROM test_taken_master
       WHERE Batch_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Take_Id`,
      [batchId]
    );
    const takeIds = (sheets as any[]).map((s) => s.Take_Id);
    const rows = takeIds.length
      ? (await pool.query(
          `SELECT ID, Take_Id, Marks_Given, Status FROM test_taken_child
           WHERE Take_Id IN (?) AND Student_Id IN (?) AND (IsDelete = 0 OR IsDelete IS NULL)
           ORDER BY ID`,
          [takeIds, ids]
        ))[0]
      : [];
    const mine = newestByParent(rows as any[], 'Take_Id');
    const items = linkSheetsToDefinitions(defs as any[], sheets as any[], 'Take_Id', 'Test_Id', mine);
    for (const { def, sheet } of items) {
      push({
        ...base,
        ...fromRow(sheet ? mine.get(Number(sheet.Take_Id)) ?? null : null, 'UNIT_TEST'),
        sourceModule: 'UNIT_TEST',
        parentId: def ? Number(def.id) : -Number(sheet.Take_Id),
        sheetId: sheet ? Number(sheet.Take_Id) : null,
        assessmentName: def?.subject || `Unit Test ${sheet?.Test_No ?? ''}`.trim(),
        assessmentNo: num(sheet?.Test_No),
        attempt: null,
        date: sheet?.Test_Dt ?? normDate(def?.utdate),
        maxMarks: num(def?.marks) ?? num(sheet?.Marks),
      });
    }
  }

  if (want.has('FINAL_EXAM')) {
    const withAttempt = await hasFinalExamAttemptColumn(pool);
    const [sittings] = await pool.query(
      `SELECT fem.Take_Id, fem.Test_No, DATE_FORMAT(fem.Test_Dt, '%Y-%m-%d') AS Test_Dt,
              ${withAttempt ? 'fem.Attempt_No' : 'NULL AS Attempt_No'},
              (SELECT MAX(COALESCE(bfe.Max_Marks, 0)) FROM batch_final_exam bfe WHERE bfe.Exam_Id = fem.Test_Id) AS Def_Max,
              fem.Marks AS Sitting_Max,
              (SELECT MAX(bfe.Subject) FROM batch_final_exam bfe WHERE bfe.Exam_Id = fem.Test_Id) AS Subject
       FROM final_exam_master fem
       WHERE fem.Batch_Id = ? AND (fem.IsDelete = 0 OR fem.IsDelete IS NULL)
       ORDER BY fem.Test_Dt, fem.Take_Id`,
      [batchId]
    );
    const takeIds = (sittings as any[]).map((s) => s.Take_Id);
    const rows = takeIds.length
      ? (await pool.query(
          `SELECT ID, Take_Id, Marks_Given, Status FROM exam_taken_child
           WHERE Take_Id IN (?) AND Student_Id IN (?) AND (IsDelete = 0 OR IsDelete IS NULL)
           ORDER BY ID`,
          [takeIds, ids]
        ))[0]
      : [];
    const mine = newestByParent(rows as any[], 'Take_Id');
    for (const s of sittings as any[]) {
      const attempt = recordedAttempt(s.Attempt_No) ?? (isReExamSitting(null, s.Subject) ? 2 : 1);
      const row = mine.get(Number(s.Take_Id)) ?? null;
      const rec = fromRow(row, 'FINAL_EXAM');
      // A re-exam the student didn't sit has no row: not applicable, not "pending".
      if (!row && attempt >= 2) rec.status = 'NOT_APPLICABLE';
      push({
        ...base,
        ...rec,
        sourceModule: 'FINAL_EXAM',
        parentId: Number(s.Take_Id),
        sheetId: Number(s.Take_Id),
        assessmentName: s.Subject || (attempt === 1 ? 'Final Exam' : 'Re-Exam'),
        assessmentNo: num(s.Test_No),
        attempt,
        date: s.Test_Dt ?? null,
        maxMarks: num(s.Sitting_Max) ?? num(s.Def_Max),
      });
    }
  }

  if (want.has('VIVA_MOC')) {
    const [sheets] = await pool.query(
      `SELECT id, vivamocname, marks, date FROM awt_vivamoctaken
       WHERE batchcode = ? AND (deleted = 0 OR deleted IS NULL)
       ORDER BY id`,
      [String(batchId)]
    );
    const vivaIds = (sheets as any[]).map((s) => s.id);
    const rows = vivaIds.length
      ? (await pool.query(
          `SELECT id, viva_id, Marks, Discipline_Marks, Status FROM viva_moc_child
           WHERE viva_id IN (?) AND (Student_Id = ? OR Admission_Id IN (?)) AND (IsDelete = 0 OR IsDelete IS NULL)
           ORDER BY id`,
          [vivaIds, ctx.studentId, ctx.batchAdmissionIds.length ? ctx.batchAdmissionIds : [0]]
        ))[0]
      : [];
    const mine = newestByParent(rows as any[], 'viva_id');
    for (const s of sheets as any[]) {
      const row = mine.get(Number(s.id)) ?? null;
      push({
        ...base,
        ...fromRow(row, 'VIVA_MOC'),
        sourceModule: 'VIVA_MOC',
        parentId: Number(s.id),
        sheetId: Number(s.id),
        assessmentName: s.vivamocname || 'Viva / MOC',
        assessmentNo: null,
        attempt: null,
        date: s.date ? String(s.date).slice(0, 10) : null,
        maxMarks: num(s.marks),
        disciplineDeduction: row ? num(row.Discipline_Marks) : null,
      });
    }
  }

  return records;
}
