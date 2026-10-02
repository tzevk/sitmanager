/* eslint-disable @typescript-eslint/no-explicit-any */
import { getAttendanceSummary } from '@/lib/attendance-summary';
import type { StudentPortalContext } from '@/lib/student-portal/context';

/**
 * ACADEMIC attendance for the Student Portal — lecture_taken_master /
 * lecture_taken_child, through the same helper (de-duplicated lectures,
 * 3 lates = 1 absence) as the Final Exam report and Performance Report, so the
 * portal and the reports show the same figures.
 *
 * This is deliberately NOT student_attendance: that table is daily / biometric
 * (administrative) attendance and stays a separate concept. The two are never
 * mixed into one percentage.
 */

export interface AcademicAttendanceLecture {
  Take_Id: number;
  Take_Dt: string | null;
  Topic: string;
  Faculty_Name: string;
  present: 0 | 1;
  Late: 0 | 1;
  session: string | null;
}

export interface AcademicAttendance {
  summary: {
    total_lectures: number;
    attended: number;
    absent: number;
    late: number;
    late_deductions: number;
    percentage: number;
  };
  /** Newest first. */
  lectures: AcademicAttendanceLecture[];
}

const EMPTY: AcademicAttendance = {
  summary: { total_lectures: 0, attended: 0, absent: 0, late: 0, late_deductions: 0, percentage: 0 },
  lectures: [],
};

export async function getAcademicAttendance(pool: any, ctx: StudentPortalContext): Promise<AcademicAttendance> {
  if (!ctx.batchId) return EMPTY;
  const ids = [ctx.studentId, ...ctx.batchAdmissionIds];

  const att = await getAttendanceSummary(pool, ctx.batchId);
  const s = ids.map((id) => att.students[id]).find(Boolean)
    ?? { effectivePresent: 0, presentCount: 0, lateCount: 0, lateDeductions: 0, percentage: 0 };
  const total = att.totalLectures;

  // Same de-duplicated lecture set as getAttendanceSummary (one Take_Id per date + start time).
  const [rows] = await pool.query(
    `SELECT lt.Take_Id, DATE_FORMAT(lt.Take_Dt, '%Y-%m-%d') AS Take_Dt, lt.Session,
            COALESCE(NULLIF(TRIM(lt.Topic), ''), NULLIF(TRIM(lt.Lecture_Name), '')) AS Topic,
            f.Faculty_Name, ltc.Student_Atten, ltc.Late
     FROM lecture_taken_master lt
     INNER JOIN (
       SELECT MAX(Take_Id) AS Take_Id FROM lecture_taken_master
       WHERE Batch_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       GROUP BY Take_Dt, Lecture_Start
     ) dedup ON dedup.Take_Id = lt.Take_Id
     LEFT JOIN lecture_taken_child ltc
       ON ltc.Take_Id = lt.Take_Id AND ltc.Student_Id IN (?) AND (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)
     LEFT JOIN faculty_master f ON f.Faculty_Id = lt.Faculty_Id
     ORDER BY lt.Take_Dt DESC, lt.Take_Id DESC`,
    [ctx.batchId, ids]
  );

  const lectures = (rows as any[]).map((r) => ({
    Take_Id: Number(r.Take_Id),
    Take_Dt: r.Take_Dt ?? null,
    Topic: r.Topic || 'Lecture',
    Faculty_Name: r.Faculty_Name || '',
    present: (String(r.Student_Atten ?? '').trim() === 'Present' ? 1 : 0) as 0 | 1,
    Late: (String(r.Late ?? '').trim() === 'Yes' ? 1 : 0) as 0 | 1,
    session: r.Session ?? null,
  }));

  return {
    summary: {
      total_lectures: total,
      attended: s.effectivePresent,
      absent: Math.max(0, total - s.effectivePresent),
      late: s.lateCount,
      late_deductions: s.lateDeductions,
      percentage: total > 0 ? Math.round((s.effectivePresent / total) * 100) : 0,
    },
    lectures,
  };
}

/**
 * Per date, whether the student was absent in EVERY lecture session that day:
 * true = absent all day, false = present in at least one, missing = no lecture
 * recorded. Used only as a separate "absent on lecture date" indicator — never
 * to change a mark.
 */
export async function getAbsentAllDayByDate(pool: any, ctx: StudentPortalContext): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (!ctx.batchId) return result;
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(lt.Take_Dt, '%Y-%m-%d') AS Dt,
            SUM(TRIM(ltc.Student_Atten) = 'Present') AS present_n,
            SUM(TRIM(ltc.Student_Atten) = 'Absent') AS absent_n,
            COUNT(*) AS n
     FROM lecture_taken_master lt
     INNER JOIN (
       SELECT MAX(Take_Id) AS Take_Id FROM lecture_taken_master
       WHERE Batch_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       GROUP BY Take_Dt, Lecture_Start
     ) dedup ON dedup.Take_Id = lt.Take_Id
     INNER JOIN lecture_taken_child ltc
       ON ltc.Take_Id = lt.Take_Id AND ltc.Student_Id IN (?) AND (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)
     GROUP BY Dt`,
    [ctx.batchId, [ctx.studentId, ...ctx.batchAdmissionIds]]
  );
  for (const r of rows as any[]) {
    if (!r.Dt) continue;
    result.set(String(r.Dt), Number(r.present_n) === 0 && Number(r.absent_n) === Number(r.n) && Number(r.n) > 0);
  }
  return result;
}
