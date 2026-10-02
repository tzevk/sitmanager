/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The one authoritative "who is this student, which admission / batch / course"
 * lookup for the Student Portal. Every portal API resolves the student through
 * this instead of its own query.
 *
 * Current admission = the student's newest admission_master row that is not
 * deleted and not cancelled. admission_master.Cancel holds NULL, '0', 'No',
 * 'Yes' and '1'; only 'Yes' / '1' mean cancelled. (The common
 * `Cancel = 0` check is wrong: MySQL casts 'Yes' to 0, so cancelled admissions
 * pass it.) Falls back to student_master.Batch_Code only when the student has
 * no usable admission at all (legacy records).
 *
 * The batch code returned is the resolved batch's own code — student_master's
 * Batch_Code goes stale after a transfer.
 */

/** SQL predicate: admission row `alias` is live (not deleted, not cancelled). */
export function liveAdmissionSql(alias: string): string {
  return `(${alias}.IsDelete = 0 OR ${alias}.IsDelete IS NULL)
    AND UPPER(TRIM(COALESCE(${alias}.Cancel, ''))) NOT IN ('YES', '1')`;
}

export interface StudentPortalContext {
  studentId: number;
  studentName: string | null;
  email: string | null;
  mobile: string | null;
  /** Student-facing identifier (decision: roll number). Never used for authorization. */
  rollNo: string | null;
  studentCode: string | null;
  /** Current admission, or null when resolved through the legacy fallback. */
  admissionId: number | null;
  /** Every admission id of this student in the current batch — child mark tables
   * sometimes store Admission_Id in their Student_Id column. */
  batchAdmissionIds: number[];
  batchId: number | null;
  batchCode: string | null;
  courseId: number | null;
  courseName: string | null;
  batchTimings: string | null;
  batchStart: string | null;
  batchEnd: string | null;
  weights: { attend: number; assign: number; exam: number; unitTest: number };
  /** Kept for existing consumers (placement eligibility uses it). */
  percentage: string | null;
}

export async function getStudentPortalContext(pool: any, studentId: number): Promise<StudentPortalContext | null> {
  const [studentRows] = await pool.query(
    `SELECT s.Student_Id, s.Student_Name, s.Email, s.Present_Mobile, s.Batch_Code, s.Course_Id, s.Percentage
     FROM student_master s
     WHERE s.Student_Id = ? AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
     LIMIT 1`,
    [studentId]
  );
  const s = (studentRows as any[])[0];
  if (!s) return null;

  const [admRows] = await pool.query(
    `SELECT a.Admission_Id, a.Batch_Id, a.Course_Id, a.Roll_No, a.Student_Code
     FROM admission_master a
     WHERE a.Student_Id = ? AND ${liveAdmissionSql('a')}
     ORDER BY a.Admission_Id DESC
     LIMIT 1`,
    [studentId]
  );
  const adm = (admRows as any[])[0] ?? null;

  let batchId: number | null = adm?.Batch_Id ? Number(adm.Batch_Id) : null;
  if (!batchId && s.Batch_Code) {
    const [legacy] = await pool.query(
      `SELECT Batch_Id FROM batch_mst
       WHERE Batch_code = ? AND (Course_Id = ? OR ? IS NULL) AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Batch_Id DESC LIMIT 1`,
      [s.Batch_Code, s.Course_Id, s.Course_Id]
    );
    batchId = (legacy as any[])[0]?.Batch_Id ? Number((legacy as any[])[0].Batch_Id) : null;
  }

  let batch: any = null;
  let batchAdmissionIds: number[] = [];
  if (batchId) {
    const [[b]]: any = await pool.query(
      `SELECT b.Batch_Id, b.Batch_code, b.Timings, b.SDate, b.EDate, b.Course_Id,
              b.AttendWtg, b.AssignWtg, b.ExamWtg, b.UnitTestWtg, c.Course_Name
       FROM batch_mst b
       LEFT JOIN course_mst c ON c.Course_Id = COALESCE(b.Course_Id, ?)
       WHERE b.Batch_Id = ? LIMIT 1`,
      [adm?.Course_Id ?? s.Course_Id ?? null, batchId]
    );
    batch = b ?? null;
    const [ids] = await pool.query(
      `SELECT a.Admission_Id FROM admission_master a WHERE a.Student_Id = ? AND a.Batch_Id = ? AND ${liveAdmissionSql('a')}`,
      [studentId, batchId]
    );
    batchAdmissionIds = (ids as any[]).map((r) => Number(r.Admission_Id));
  }

  return {
    studentId: Number(s.Student_Id),
    studentName: s.Student_Name ?? null,
    email: s.Email ?? null,
    mobile: s.Present_Mobile ?? null,
    rollNo: adm?.Roll_No ? String(adm.Roll_No).trim() || null : null,
    studentCode: adm?.Student_Code ? String(adm.Student_Code) : null,
    admissionId: adm?.Admission_Id ? Number(adm.Admission_Id) : null,
    batchAdmissionIds,
    batchId: batch ? Number(batch.Batch_Id) : null,
    batchCode: batch?.Batch_code ?? null,
    courseId: batch?.Course_Id ?? adm?.Course_Id ?? s.Course_Id ?? null,
    courseName: batch?.Course_Name ?? null,
    batchTimings: batch?.Timings ?? null,
    batchStart: batch?.SDate ?? null,
    batchEnd: batch?.EDate ?? null,
    weights: {
      attend: Number(batch?.AttendWtg) || 0,
      assign: Number(batch?.AssignWtg) || 0,
      exam: Number(batch?.ExamWtg) || 0,
      unitTest: Number(batch?.UnitTestWtg) || 0,
    },
    percentage: s.Percentage ?? null,
  };
}
