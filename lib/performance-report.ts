/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildFinalExamReport, parseClassBoundaries } from '@/lib/final-exam-report';
import { isReExamSitting, MAX_FINAL_EXAM_ATTEMPT, recordedAttempt } from '@/lib/final-exam-attempt';
import { parseMark } from '@/lib/student-portal/academic-status';

/**
 * Performance Report (form F/TD/08/02) for one batch.
 *
 * Every score, percentage and grade comes unchanged from buildFinalExamReport —
 * the same live calculation as the Final Exam and Student Interview reports.
 * This module only adds how each individual mark is DISPLAYED:
 *
 *  Assignments — attendance never overrides a recorded mark (institute
 *  decision): a recorded mark, including 0, is always shown. When the student
 *  was marked Absent in EVERY lecture session on the assignment date, the cell
 *  is flagged absentOnLectureDate (printed as a "†" marker) so the combination
 *  is visible and can be questioned. There is no direct assignment → lecture
 *  link (lecture_taken_master.Assignment_Id/_No are not filled in), so the
 *  correlation is by date. Precedence per cell:
 *    no record for the student         → "-"
 *    Status 'Absent' and 0 marks       → "Not Submitted"
 *    otherwise                         → the mark, including a genuine 0
 *  Duplicate rows per sheet+student (staff saves insert instead of update):
 *  the newest row wins.
 *
 *  Unit tests / final exam — their own Status column is the authority:
 *  'Absent' with 0 marks → "Absent", otherwise the mark.
 *
 *  Final exam attempts — up to three (regular + two re-exams). A sitting's
 *  recorded Attempt_No decides its attempt; older re-exam sittings without one
 *  (recognised by subject name) take the next free attempt in date order. All
 *  papers of the same attempt are shown together as "obtained / max". Students
 *  who didn't sit a re-exam have no row for it and show "-".
 *
 * Display only: overriding a cell to "Absent" never changes totals or grade,
 * and stored marks are never modified.
 */

export type CellStatus = 'marks' | 'absent' | 'not_submitted' | 'not_recorded';

export interface PerformanceCell {
  no: number;
  status: CellStatus;
  marks: number | null;
  max: number;
  display: string;
  /** Assignments: marked Absent in every lecture that day. Never changes the mark. */
  absentOnLectureDate?: boolean;
}

export interface PerformanceAttempt {
  label: string;
  status: CellStatus;
  obtained: number | null;
  max: number;
  display: string;
}

export interface PerformanceStudent {
  Student_Id: number;
  Student_Name: string;
  Roll_No: string;
  Student_Code: string;
  assignments: { total: number; submitted: number; cells: PerformanceCell[]; obtained: number; max: number; weighted: number; weightage: number };
  unitTests: { total: number; attended: number; cells: PerformanceCell[]; obtained: number; max: number; weighted: number; weightage: number };
  finalExam: { attempts: PerformanceAttempt[]; weighted: number; weightage: number };
  attendance: { attended: number; total: number; absentDays: number; percentage: number };
  discipline: number;
  totalScore: number;
  grade: string;
}

export interface PerformanceReport {
  batch: any;
  passingCriteria: { grade: string; from: number; to: number | null }[];
  students: PerformanceStudent[];
}

const ATTEMPT_LABELS = ['First Attempt', 'Second Attempt', 'Third Attempt', 'Fourth Attempt', 'Fifth Attempt'];

function cellFor(
  row: { marks: number | null; status: string } | undefined,
  max: number,
  no: number,
  opts: { absentAllDay?: boolean; zeroAbsentLabel: 'absent' | 'not_submitted' }
): PerformanceCell {
  if (!row) return { no, status: 'not_recorded', marks: null, max, display: '-' };
  const flag = opts.absentAllDay ? { absentOnLectureDate: true } : {};
  if (row.status === 'Absent' && (row.marks === 0 || row.marks === null)) {
    return opts.zeroAbsentLabel === 'absent'
      ? { no, status: 'absent', marks: 0, max, display: 'Absent', ...flag }
      : { no, status: 'not_submitted', marks: 0, max, display: 'Not Submitted', ...flag };
  }
  if (row.marks === null) return { no, status: 'not_recorded', marks: null, max, display: '-', ...flag };
  return { no, status: 'marks', marks: row.marks, max, display: String(row.marks), ...flag };
}

export async function buildPerformanceReport(pool: any, batchId: number): Promise<PerformanceReport | null> {
  const report: any = await buildFinalExamReport(pool, batchId);
  if (!report) return null;
  const { batch, unitTests, assignments, finalExams } = report;

  // Child tables may store Admission_Id instead of Student_Id — same resolution
  // as buildFinalExamReport.
  const [admRows] = await pool.query(
    `SELECT Admission_Id, Student_Id FROM admission_master
     WHERE Batch_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
    [batchId]
  );
  const admToStudent = new Map<number, number>((admRows as any[]).map((r) => [Number(r.Admission_Id), Number(r.Student_Id)]));
  const sidOf = (raw: unknown) => admToStudent.get(Number(raw)) ?? Number(raw);
  const key = (a: unknown, b: unknown) => `${a}:${b}`;

  const givenIds = assignments.map((a: any) => a.Given_Id);
  const testTakeIds = unitTests.map((t: any) => t.Take_Id);
  const examTakeIds = finalExams.map((f: any) => f.Take_Id);
  const inList = (ids: unknown[]) => ids.map(() => '?').join(',');

  const [asgRows, testRows, examRows, asgDates, lectureRows] = await Promise.all([
    givenIds.length
      ? pool.query(
          `SELECT Given_Id, Student_Id, Marks_Given AS Marks, Status FROM assignment_given_child
           WHERE Given_Id IN (${inList(givenIds)}) AND (IsDelete = 0 OR IsDelete IS NULL)
           ORDER BY ID`,
          givenIds
        ).then(([r]: any) => r)
      : [],
    testTakeIds.length
      ? pool.query(
          `SELECT Take_Id, Student_Id, Marks_Given AS Marks, Status FROM test_taken_child
           WHERE Take_Id IN (${inList(testTakeIds)}) AND (IsDelete = 0 OR IsDelete IS NULL)
           ORDER BY ID`,
          testTakeIds
        ).then(([r]: any) => r)
      : [],
    examTakeIds.length
      ? pool.query(
          `SELECT Take_Id, Student_Id, Marks_Given AS Marks, Status FROM exam_taken_child
           WHERE Take_Id IN (${inList(examTakeIds)}) AND (IsDelete = 0 OR IsDelete IS NULL)
           ORDER BY ID`,
          examTakeIds
        ).then(([r]: any) => r)
      : [],
    givenIds.length
      ? pool.query(
          `SELECT Given_Id, DATE_FORMAT(Assign_Dt, '%Y-%m-%d') AS Dt FROM assignment_taken WHERE Given_Id IN (${inList(givenIds)})`,
          givenIds
        ).then(([r]: any) => r)
      : [],
    // Same de-duplicated lecture set as the attendance summary (one Take_Id per
    // date + start time), so "absent that day" agrees with the attendance count.
    pool.query(
      `SELECT DATE_FORMAT(lt.Take_Dt, '%Y-%m-%d') AS Dt, ltc.Student_Id, ltc.Student_Atten
       FROM lecture_taken_master lt
       INNER JOIN (
         SELECT MAX(Take_Id) AS Take_Id FROM lecture_taken_master
         WHERE Batch_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
         GROUP BY Take_Dt, Lecture_Start
       ) dedup ON lt.Take_Id = dedup.Take_Id
       INNER JOIN lecture_taken_child ltc ON ltc.Take_Id = lt.Take_Id AND (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)`,
      [batchId]
    ).then(([r]: any) => r),
  ]);

  const toMap = (rows: any[], idCol: string) =>
    new Map<string, { marks: number | null; status: string }>(
      // A blank mark stays null ("-"), never 0 — 0 is a real mark.
      rows.map((r) => [key(r[idCol], sidOf(r.Student_Id)), { marks: parseMark(r.Marks), status: String(r.Status || '').trim() }])
    );
  const asgMap = toMap(asgRows, 'Given_Id');
  const testMap = toMap(testRows, 'Take_Id');
  const examMap = toMap(examRows, 'Take_Id');
  const asgDateById = new Map<number, string>((asgDates as any[]).map((r) => [Number(r.Given_Id), String(r.Dt || '')]));

  // date:student → every session's attendance that day
  const dayAttendance = new Map<string, string[]>();
  for (const r of lectureRows as any[]) {
    const k = key(r.Dt, sidOf(r.Student_Id));
    const list = dayAttendance.get(k) ?? [];
    list.push(String(r.Student_Atten || '').trim());
    dayAttendance.set(k, list);
  }
  const absentAllDay = (date: string | undefined, sid: number) => {
    if (!date) return false;
    const list = dayAttendance.get(key(date, sid));
    return !!list && list.length > 0 && list.every((a) => a === 'Absent');
  };

  // Group the batch's exam papers by attempt (same regular / re-exam split as
  // buildFinalExamReport). If nothing is marked regular, everything counts as
  // the first attempt, as the score calculation does.
  const isRe = (f: any) => isReExamSitting(f.Attempt_No, f.Exam_Subject);
  const regular = finalExams.filter((f: any) => !isRe(f));
  const attemptGroups = new Map<number, any[]>([[1, regular.length > 0 ? regular : finalExams]]);
  if (regular.length > 0) {
    const reExams = finalExams.filter(isRe)
      .sort((a: any, b: any) => String(a.Test_Dt || '').localeCompare(String(b.Test_Dt || '')) || a.Take_Id - b.Take_Id);
    for (const f of reExams) {
      const n = recordedAttempt(f.Attempt_No);
      if (n !== null) attemptGroups.set(n, [...(attemptGroups.get(n) ?? []), f]);
    }
    let next = 2;
    for (const f of reExams.filter((r: any) => recordedAttempt(r.Attempt_No) === null)) {
      while (attemptGroups.has(next)) next++;
      attemptGroups.set(next, [f]);
    }
  }
  // Always show every attempt column (First/Second/Third), like the printed form.
  const attemptNos = [...new Set([...Array.from({ length: MAX_FINAL_EXAM_ATTEMPT }, (_, i) => i + 1), ...attemptGroups.keys()])]
    .sort((a, b) => a - b);

  const utWtg = Number(batch.UnitTestWtg) || 35;
  const asWtg = Number(batch.AssignWtg) || 15;
  const feWtg = Number(batch.ExamWtg) || 50;

  // Admissions with nothing recorded at all (no lecture attendance, no assignment,
  // test or exam rows) — e.g. never joined the batch — would only print a blank
  // "No certificate" page, so they're left out of the report.
  const hasAnyRecord = (sid: number) =>
    [...dayAttendance.keys()].some((k) => k.endsWith(`:${sid}`))
    || givenIds.some((id: unknown) => asgMap.has(key(id, sid)))
    || testTakeIds.some((id: unknown) => testMap.has(key(id, sid)))
    || examTakeIds.some((id: unknown) => examMap.has(key(id, sid)));

  const students: PerformanceStudent[] = report.students.filter((s: any) => hasAnyRecord(Number(s.Student_Id))).map((s: any) => {
    const sid = Number(s.Student_Id);

    const asgCells = assignments.map((a: any, i: number) =>
      cellFor(asgMap.get(key(a.Given_Id, sid)), Number(a.Max_Marks) || 0, Number(a.Assign_No) || i + 1, {
        absentAllDay: absentAllDay(asgDateById.get(Number(a.Given_Id)), sid),
        zeroAbsentLabel: 'not_submitted',
      })
    );
    const testCells = unitTests.map((t: any, i: number) =>
      cellFor(testMap.get(key(t.Take_Id, sid)), Number(t.Max_Marks) || 0, Number(t.Test_No) || i + 1, { zeroAbsentLabel: 'absent' })
    );

    // Each attempt = all of its papers together; absent only if absent from every one.
    const attempts: PerformanceAttempt[] = attemptNos.map((n) => {
      const label = ATTEMPT_LABELS[n - 1] ?? `Attempt ${n}`;
      const papers = attemptGroups.get(n) ?? [];
      const max = papers.reduce((sum: number, f: any) => sum + (Number(f.Max_Marks) || 0), 0);
      const recorded = papers.map((f: any) => examMap.get(key(f.Take_Id, sid))).filter(Boolean) as { marks: number | null; status: string }[];
      if (recorded.length === 0) return { label, status: 'not_recorded', obtained: null, max, display: '-' };
      if (recorded.every((r) => r.status === 'Absent' && (r.marks === 0 || r.marks === null))) return { label, status: 'absent', obtained: 0, max, display: 'Absent' };
      if (recorded.every((r) => r.marks === null)) return { label, status: 'not_recorded', obtained: null, max, display: '-' };
      const obtained = recorded.reduce((sum, r) => sum + (r.marks ?? 0), 0);
      return { label, status: 'marks', obtained, max, display: `${obtained} / ${max}` };
    });

    return {
      Student_Id: sid,
      Student_Name: s.Student_Name,
      Roll_No: s.Roll_No || '',
      Student_Code: s.Student_Code || '',
      assignments: {
        total: assignments.length,
        submitted: asgCells.filter((c: PerformanceCell) => c.status === 'marks').length,
        cells: asgCells,
        obtained: s.asObtained, max: s.asTotalMax, weighted: s.asAvg, weightage: asWtg,
      },
      unitTests: {
        total: unitTests.length,
        attended: testCells.filter((c: PerformanceCell) => c.status === 'marks').length,
        cells: testCells,
        obtained: s.utObtained, max: s.utTotalMax, weighted: s.utAvg, weightage: utWtg,
      },
      finalExam: { attempts, weighted: s.feAvg, weightage: feWtg },
      attendance: { attended: s.presentCount, total: s.totalLectures, absentDays: s.absentDays, percentage: s.attendPct },
      discipline: s.disciplineObtained,
      totalScore: s.totalScore,
      grade: s.classObtained,
    };
  });

  const boundaries = Object.entries(parseClassBoundaries(batch.Passing_Criteria)).sort((a, b) => b[1] - a[1]);
  const passingCriteria = boundaries.map(([grade, from], i) => ({ grade, from, to: i === 0 ? 100 : boundaries[i - 1][1] - 0.01 }));
  if (boundaries.length) passingCriteria.push({ grade: 'No certificate', from: 0, to: boundaries[boundaries.length - 1][1] - 0.01 });

  return { batch, passingCriteria, students };
}
