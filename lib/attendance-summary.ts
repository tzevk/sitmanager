/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Pool } from 'mysql2/promise';

export interface AttendanceSummary {
  totalLectures: number;
  /** keyed by Student_Id (number) */
  students: Record<number, {
    presentCount: number;      // raw present
    lateCount: number;
    lateDeductions: number;    // floor(lateCount / 3)
    effectivePresent: number;  // presentCount - lateDeductions
    percentage: number;        // effectivePresent / totalLectures * 100
  }>;
}

/**
 * Calculate attendance summary for a batch using the canonical rules:
 *  - Deduplicate lectures: keep MAX(Take_Id) per (Take_Dt, Lecture_Start)
 *  - Late rule: every 3 late marks = 1 absent deduction
 */
export async function getAttendanceSummary(
  pool: Pool,
  batchId: number
): Promise<AttendanceSummary> {
  // 1. Deduplicated Take_Ids
  const [dedupRows] = await pool.query(
    `SELECT lt.Take_Id
     FROM lecture_taken_master lt
     INNER JOIN (
       SELECT MAX(Take_Id) AS Take_Id
       FROM lecture_taken_master
       WHERE Batch_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       GROUP BY Take_Dt, Lecture_Start
     ) dedup ON lt.Take_Id = dedup.Take_Id`,
    [batchId]
  );
  const takeIds = (dedupRows as any[]).map((r: any) => r.Take_Id);
  const totalLectures = takeIds.length;

  if (totalLectures === 0) {
    return { totalLectures: 0, students: {} };
  }

  // 2. Attendance rows for those Take_Ids
  const [attRows] = await pool.query(
    `SELECT ltc.Student_Id, ltc.Student_Atten, ltc.Late
     FROM lecture_taken_child ltc
     WHERE ltc.Take_Id IN (${takeIds.map(() => '?').join(',')})
       AND (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)`,
    takeIds
  );

  const acc: Record<number, { presentCount: number; lateCount: number }> = {};
  for (const a of attRows as any[]) {
    const sid = Number(a.Student_Id);
    if (!acc[sid]) acc[sid] = { presentCount: 0, lateCount: 0 };
    if ((a.Student_Atten || '').trim() === 'Present') acc[sid].presentCount++;
    if ((a.Late || '').trim() === 'Yes') acc[sid].lateCount++;
  }

  const students: AttendanceSummary['students'] = {};
  for (const [sidStr, ss] of Object.entries(acc)) {
    const sid = Number(sidStr);
    const lateDeductions = Math.floor(ss.lateCount / 3);
    const effectivePresent = Math.max(0, ss.presentCount - lateDeductions);
    students[sid] = {
      presentCount: ss.presentCount,
      lateCount: ss.lateCount,
      lateDeductions,
      effectivePresent,
      percentage: (effectivePresent / totalLectures) * 100,
    };
  }

  return { totalLectures, students };
}
