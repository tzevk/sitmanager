/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { getAttendanceSummary } from '@/lib/attendance-summary';

/* ─── Schema discovery ─────────────────────────────────────────────── */

/** Returns the set of column names that actually exist in the given table. */
async function getTableColumns(pool: any, table: string): Promise<Set<string>> {
  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table]
    );
    return new Set((rows as any[]).map((r: any) => String(r.COLUMN_NAME)));
  } catch {
    return new Set();
  }
}

/** Check whether a table exists at all. */
async function tableExists(pool: any, table: string): Promise<boolean> {
  const cols = await getTableColumns(pool, table);
  return cols.size > 0;
}

/**
 * Find the first column whose lower-case name contains any of the candidates.
 * Returns the ORIGINAL-cased column name from the schema.
 */
function pickCol(cols: Set<string>, candidates: string[]): string | null {
  for (const c of candidates) {
    for (const col of cols) {
      if (col.toLowerCase().includes(c)) return col;
    }
  }
  return null;
}

/**
 * Parse class boundaries from Passing_Criteria field in batch_mst.
 * Handles multiple formats:
 * - JSON: { "A+": 90, "A": 80, "B+": 70, "B": 60, "C": 50 }
 * - CSV with colon: A+:90,A:80,B+:70,B:60,C:50
 * - CSV with spaces: A+ 90, A 80, B+ 70, B 60, C 50
 * Returns class boundaries or default values if parsing fails.
 */
interface ClassBoundaries {
  [key: string]: number;
}

function parseClassBoundaries(passingCriteria: string | null): ClassBoundaries {
  const defaults: ClassBoundaries = {
    'A+': 90,
    'A': 80,
    'B+': 70,
    'B': 60,
    'C': 50,
  };

  if (!passingCriteria || !passingCriteria.trim()) {
    console.log('[Final Exam] No Passing_Criteria found, using defaults');
    return defaults;
  }

  const criteria = passingCriteria.trim();

  // Try JSON format first
  if (criteria.startsWith('{') && criteria.endsWith('}')) {
    try {
      const parsed = JSON.parse(criteria);
      if (typeof parsed === 'object' && parsed !== null) {
        const classes = Object.entries(parsed);
        if (classes.length > 0 && classes.every(([, val]) => typeof val === 'number')) {
          console.log('[Final Exam] Parsed JSON Passing_Criteria:', parsed);
          return parsed as ClassBoundaries;
        }
      }
    } catch (e) {
      console.log('[Final Exam] Failed to parse JSON:', e);
    }
  }

  // Try CSV format: "A+:90,A:80,B+:70,B:60,C:50" or "A+ 90, A 80, B+ 70, B 60, C 50"
  try {
    const result: ClassBoundaries = {};
    const pairs = criteria.split(/[,;]/); // Split by comma or semicolon

    for (const pair of pairs) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      
      // Match patterns like "A+:90" or "A+ 90" or "A+=90"
      const match = trimmed.match(/^([ABC]\+?)\s*[:=\s]+\s*(\d+(?:\.\d+)?)$/);
      if (match) {
        const className = match[1].trim();
        const threshold = parseFloat(match[2]);
        if (!isNaN(threshold)) {
          result[className] = threshold;
          console.log(`[Final Exam] Parsed ${className} threshold: ${threshold}`);
        }
      } else {
        console.log(`[Final Exam] Could not parse pair: "${trimmed}"`);
      }
    }

    if (Object.keys(result).length > 0) {
      console.log('[Final Exam] Final parsed boundaries:', result);
      return result;
    }
  } catch (e) {
    console.log('[Final Exam] Failed to parse CSV format:', e);
  }

  console.log('[Final Exam] Falling back to default boundaries');
  return defaults;
}

/**
 * Determine class based on percentage and class boundaries.
 * Boundaries should be sorted in descending order.
 */
function getClassFromBoundaries(pct: number, boundaries: ClassBoundaries): string {
  // Sort boundaries by percentage in descending order
  const sorted = Object.entries(boundaries)
    .sort((a, b) => b[1] - a[1]);

  for (const [className, threshold] of sorted) {
    if (pct >= threshold) return className;
  }

  return 'NO CERT';
}

/* ─── Route handler ────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'report_final_exam.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const url = req.nextUrl;
    const options = url.searchParams.get('options');

    /* ---------- Dropdown: courses ---------- */
    if (options === 'courses') {
      const [courses] = await pool.query(
        `SELECT Course_Id AS id, Course_Name AS name
         FROM course_mst
         WHERE (IsDelete = 0 OR IsDelete IS NULL) AND IsActive = 1
         ORDER BY Course_Name`
      );
      return NextResponse.json({ courses });
    }

    /* ---------- Dropdown: batches ---------- */
    if (options === 'batches') {
      const courseId = url.searchParams.get('courseId');
      if (!courseId) return NextResponse.json({ batches: [] });
      const [batches] = await pool.query(
        `SELECT Batch_Id AS id, Batch_code AS name, Category AS category
         FROM batch_mst
         WHERE Course_Id = ? AND IsActive = 1
           AND (IsDelete = 0 OR IsDelete IS NULL)
           AND (Cancel = 0 OR Cancel IS NULL)
         ORDER BY Batch_Id DESC`,
        [parseInt(courseId)]
      );
      return NextResponse.json({ batches });
    }

    /* ---------- Dropdown: students in batch ---------- */
    if (options === 'students') {
      const batchId = url.searchParams.get('batchId');
      if (!batchId) return NextResponse.json({ students: [] });
      const [students] = await pool.query(
        `SELECT a.Admission_Id, s.Student_Id, s.Student_Name,
                COALESCE(a.Roll_No, '') AS Roll_No
         FROM admission_master a
         JOIN student_master s ON a.Student_Id = s.Student_Id
         WHERE a.Batch_Id = ?
           AND (a.IsDelete = 0 OR a.IsDelete IS NULL)
           AND (a.Cancel = 0 OR a.Cancel IS NULL)
         ORDER BY CAST(COALESCE(a.Roll_No, '9999') AS UNSIGNED), s.Student_Name`,
        [parseInt(batchId)]
      );
      return NextResponse.json({ students });
    }

    /* ---------- Report data ---------- */
    const batchIdRaw = url.searchParams.get('batchId');
    const studentIdRaw = url.searchParams.get('studentId');

    if (!batchIdRaw) {
      return NextResponse.json({ error: 'batchId is required' }, { status: 400 });
    }
    const batchId = parseInt(batchIdRaw);
    const studentId = studentIdRaw ? parseInt(studentIdRaw) : null;

    /* ── 1. Batch info ── */
    const [batchRows] = await pool.query(
      `SELECT b.Batch_Id, b.Batch_code, b.Category, b.Timings,
              b.No_of_Lectures,
              IFNULL(b.UnitTestWtg, 0) AS UnitTestWtg,
              IFNULL(b.AssignWtg, 0)   AS AssignWtg,
              IFNULL(b.ExamWtg, 0)     AS ExamWtg,
              IFNULL(b.AttendWtg, 0)   AS AttendWtg,
              c.Course_Name, c.Course_Id,
              b.SDate, b.EDate,
              b.Passing_Criteria
       FROM batch_mst b
       LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
       WHERE b.Batch_Id = ?`,
      [batchId]
    );
    const batch = (batchRows as any[])[0];
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    /* Parse class boundaries from Passing_Criteria */
    const classBoundaries = parseClassBoundaries(batch.Passing_Criteria);

    /* ── 2. Students ── */
    const studentCondition = studentId ? 'AND s.Student_Id = ?' : '';
    const studentParams: any[] = studentId ? [batchId, studentId] : [batchId];
    const [studentRows] = await pool.query(
      `SELECT a.Admission_Id, s.Student_Id, s.Student_Name,
              COALESCE(a.Roll_No, '') AS Roll_No, a.Student_Code
       FROM admission_master a
       JOIN student_master s ON a.Student_Id = s.Student_Id
       WHERE a.Batch_Id = ?
         AND (a.IsDelete = 0 OR a.IsDelete IS NULL)
         AND (a.Cancel = 0 OR a.Cancel IS NULL)
         ${studentCondition}
       ORDER BY CAST(COALESCE(a.Roll_No, '9999') AS UNSIGNED), s.Student_Name`,
      studentParams
    );
    const students = studentRows as any[];

    /* Build Admission_Id → Student_Id resolution map (child tables may store either) */
    const admToStudentId: Record<number, number> = {};
    for (const s of students) {
      if (s.Admission_Id && s.Student_Id) admToStudentId[Number(s.Admission_Id)] = Number(s.Student_Id);
    }
    function resolveStudentId(rawId: number): number {
      return admToStudentId[rawId] ?? rawId;
    }

    /* ── 3. Discover test_taken_child schema ── */
    const ttcCols = await getTableColumns(pool, 'test_taken_child');
    // Find student-id column: Try_Id, Student_Id, Admission_Id, student_id
    const ttcStudentCol = pickCol(ttcCols, ['student_id', 'admission_id', 'studentid']) ?? 'Student_Id';
    // Find marks column: Marks, Mark, Score, Obtained, marks_obtained
    const ttcMarksCol   = pickCol(ttcCols, ['mark', 'score', 'obtain']) ?? 'Marks';
    const ttcHasDelete  = ttcCols.has('IsDelete') || ttcCols.has('isdelete');
    const ttcDeleteClause = ttcHasDelete ? "AND (ttc.IsDelete = 0 OR ttc.IsDelete IS NULL)" : '';

    /* ── 4. Unit tests for this batch ── */
    const [utRows] = await pool.query(
      `SELECT ttm.Take_Id,
              IFNULL(ttm.Test_No, 0)                       AS Test_No,
              COALESCE(ut.marks, ttm.Marks, 0)             AS Max_Marks,
              COALESCE(ut.subject, ttm.Test_No, '')        AS Test_Name,
              ttm.Test_Dt
       FROM test_taken_master ttm
       LEFT JOIN awt_unittesttaken ut ON ttm.Test_Id = ut.id
       WHERE ttm.Batch_Id = ?
         AND (ttm.IsDelete = 0 OR ttm.IsDelete IS NULL)
       ORDER BY ttm.Test_No, ttm.Take_Id`,
      [batchId]
    );
    const unitTests = utRows as any[];

    /* ── 5. Per-student unit test marks (schema-aware) ── */
    const utMarksMap: Record<number, Record<number, number>> = {};
    if (unitTests.length > 0 && ttcCols.size > 0) {
      try {
        const utTakeIds = unitTests.map((u: any) => u.Take_Id);
        const [utChildRows] = await pool.query(
          `SELECT ttc.Take_Id,
                  ttc.\`${ttcStudentCol}\` AS Student_Id,
                  IFNULL(ttc.\`${ttcMarksCol}\`, 0) AS Marks_Obtained
           FROM test_taken_child ttc
           WHERE ttc.Take_Id IN (${utTakeIds.map(() => '?').join(',')})
             ${ttcDeleteClause}`,
          utTakeIds
        );
        for (const r of utChildRows as any[]) {
          const sid = resolveStudentId(Number(r.Student_Id));
          if (!utMarksMap[sid]) utMarksMap[sid] = {};
          utMarksMap[sid][r.Take_Id] = Number(r.Marks_Obtained) || 0;
        }
      } catch (e) {
        console.warn('test_taken_child query failed:', (e as any).message);
      }
    }

    /* ── 6. Assignments for this batch ── */
    const [assignRows] = await pool.query(
      `SELECT at.Given_Id,
              IFNULL(at.Assign_No, 0)                AS Assign_No,
              COALESCE(am.marks, at.Marks, 0)        AS Max_Marks,
              at.Assign_Dt,
              am.assignmentname                      AS Assignment_Name
       FROM assignment_taken at
       LEFT JOIN assignmentstaken am ON at.Assignment_Id = am.id
       WHERE at.Batch_Id = ?
         AND (at.IsDelete = 0 OR at.IsDelete IS NULL)
       ORDER BY at.Assign_No, at.Given_Id`,
      [batchId]
    );
    const assignments = assignRows as any[];

    /* ── 7. Per-student assignment marks ── */
    const assignMarksMap: Record<number, Record<number, number>> = {};
    if (assignments.length > 0) {
      try {
        const givenIds = assignments.map((a: any) => a.Given_Id);
        const [assignChildRows] = await pool.query(
          `SELECT agc.Given_Id,
                  agc.Student_Id,
                  IFNULL(agc.Marks_Given, 0) AS Marks_Obtained
           FROM assignment_given_child agc
           WHERE agc.Given_Id IN (${givenIds.map(() => '?').join(',')})
             AND (agc.IsDelete = 0 OR agc.IsDelete IS NULL)`,
          givenIds
        );
        for (const r of assignChildRows as any[]) {
          const sid = resolveStudentId(Number(r.Student_Id));
          if (!assignMarksMap[sid]) assignMarksMap[sid] = {};
          assignMarksMap[sid][r.Given_Id] = Number(r.Marks_Obtained) || 0;
        }
      } catch (e) {
        console.warn('assignment_given_child query failed:', (e as any).message);
      }
    }

    /* ── 8. Final exams for this batch ── */
    const [feRows] = await pool.query(
      `SELECT fem.Take_Id,
              IFNULL(fem.Test_No, 0)                    AS Test_No,
              COALESCE(bfe.max_marks, fem.Marks, 0)     AS Max_Marks,
              fem.Test_Dt,
              bfe.Subject                               AS Exam_Subject
       FROM final_exam_master fem
       LEFT JOIN batch_final_exam bfe ON fem.Test_Id = bfe.Exam_Id
       WHERE fem.Batch_Id = ?
         AND (fem.IsDelete = 0 OR fem.IsDelete IS NULL)
       ORDER BY fem.Test_No, fem.Take_Id`,
      [batchId]
    );
    const finalExams = feRows as any[];

    /* ── 9. Discover final exam child table (may be named differently) ── */
    const feMarksMap: Record<number, Record<number, number>> = {};
    if (finalExams.length > 0) {
      // Try known table names in order
      const candidateTables = ['final_exam_child', 'final_exam_taken_child', 's_exam_taken_child', 'exam_taken_child'];
      let feChildTable: string | null = null;
      for (const t of candidateTables) {
        if (await tableExists(pool, t)) { feChildTable = t; break; }
      }

      if (feChildTable) {
        try {
          const feCols = await getTableColumns(pool, feChildTable);
          const feStudentCol = pickCol(feCols, ['student_id', 'admission_id', 'studentid']) ?? 'Student_Id';
          const feMarksCol   = pickCol(feCols, ['mark', 'score', 'obtain']) ?? 'Marks';
          const feHasDelete  = feCols.has('IsDelete') || feCols.has('isdelete');
          const feDeleteClause = feHasDelete ? `AND (fec.IsDelete = 0 OR fec.IsDelete IS NULL)` : '';

          const feTakeIds = finalExams.map((f: any) => f.Take_Id);
          const [feChildRows] = await pool.query(
            `SELECT fec.Take_Id,
                    fec.\`${feStudentCol}\` AS Student_Id,
                    IFNULL(fec.\`${feMarksCol}\`, 0) AS Marks_Obtained
             FROM \`${feChildTable}\` fec
             WHERE fec.Take_Id IN (${feTakeIds.map(() => '?').join(',')})
               ${feDeleteClause}`,
            feTakeIds
          );
          for (const r of feChildRows as any[]) {
            const sid = resolveStudentId(Number(r.Student_Id));
            if (!feMarksMap[sid]) feMarksMap[sid] = {};
            feMarksMap[sid][r.Take_Id] = Number(r.Marks_Obtained) || 0;
          }
        } catch (e) {
          console.warn(`${feChildTable} query failed:`, (e as any).message);
        }
      }
    }

    /* ── 10 & 11. Attendance via shared helper (dedup + 3-late = 1-absent rule) ── */
    const attSummary = await getAttendanceSummary(pool, batchId);
    const totalLectures = attSummary.totalLectures;

    /* ── 12. Build per-student result rows ── */
    const utTotalMax = unitTests.reduce((s: number, u: any) => s + Number(u.Max_Marks), 0);
    const asTotalMax = assignments.reduce((s: number, a: any) => s + Number(a.Max_Marks), 0);
    const feTotalMax = finalExams.reduce((s: number, f: any) => s + Number(f.Max_Marks), 0);

    const utWtg = Number(batch.UnitTestWtg) || 35;
    const asWtg = Number(batch.AssignWtg)   || 15;
    const feWtg = Number(batch.ExamWtg)     || 50;

    const hasExamMarks = finalExams.length > 0 &&
      students.some((s: any) => {
        const m = feMarksMap[s.Student_Id] || {};
        return Object.values(m).some((v: any) => Number(v) > 0);
      });

    const resultStudents = students.map((s: any, idx: number) => {
      const sid = s.Student_Id;

      /* unit test
       * Formula: (sum_of_obtained / utTotalMax) × UnitTestWtg
       */
      const utMarks: Record<number, number> = utMarksMap[sid] || {};
      const utObtained = unitTests.reduce((sum: number, ut: any) => sum + (utMarks[ut.Take_Id] || 0), 0);
      const utAvg = utTotalMax > 0 ? roundH((utObtained / utTotalMax) * utWtg) : 0;

      /* assignment — denominator is the actual sum of assignment max marks */
      const asMarks: Record<number, number> = assignMarksMap[sid] || {};
      const asObtained = assignments.reduce((sum: number, a: any) => sum + (asMarks[a.Given_Id] || 0), 0);
      const asAvg = asTotalMax > 0 ? roundH((asObtained / asTotalMax) * asWtg) : 0;

      /* final exam — denominator is the actual sum of final exam max marks */
      const feMarks: Record<number, number> = feMarksMap[sid] || {};
      const feObtained = finalExams.reduce((sum: number, f: any) => sum + (feMarks[f.Take_Id] || 0), 0);
      const feAvg = feTotalMax > 0 ? roundH((feObtained / feTotalMax) * feWtg) : 0;

      /* attendance — from shared helper (dedup + 3-late = 1-absent rule) */
      const attData      = attSummary.students[sid] || { effectivePresent: 0, presentCount: 0, lateCount: 0, lateDeductions: 0, percentage: 0 };
      const baseLectures = totalLectures;
      const presentCount = attData.effectivePresent;
      const absentDays   = Math.max(0, baseLectures - presentCount);
      const attendPct    = baseLectures > 0 ? roundH((presentCount / baseLectures) * 100) : 0;
      const absentPct    = baseLectures > 0 ? roundH((absentDays  / baseLectures) * 100) : 0;

      /* Final Total % = UT weighted + AS weighted + FE weighted */
      const totalScore = roundH(utAvg + asAvg + feAvg);

      return {
        srNo:         idx + 1,
        Student_Id:   sid,
        Student_Code: s.Student_Code || '',
        Student_Name: s.Student_Name,
        Roll_No:      s.Roll_No || '',
        unitTestMarks:   utMarks,
        assignmentMarks: asMarks,
        finalExamMarks:  feMarks,
        utObtained, utTotalMax, utAvg,
        asObtained, asTotalMax, asAvg,
        feObtained, feTotalMax, feAvg,
        totalLectures: baseLectures,
        presentCount,
        absentDays,
        attendPct,
        absentPct,
        disciplineScore: 0,
        totalScore,
        classObtained: hasExamMarks ? getClassFromBoundaries(totalScore, classBoundaries) : 'NA',
      };
    });

    return NextResponse.json({
      batch,
      unitTests,
      assignments,
      finalExams,
      students: resultStudents,
      totalLectures,
    });
  } catch (error: any) {
    console.error('Final exam report GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch final exam report', details: error.message },
      { status: 500 }
    );
  }
}

function roundH(n: number): number {
  return Math.round(n * 100) / 100;
}
