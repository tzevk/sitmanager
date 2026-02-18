/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool, cached } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function safeQuery<T>(pool: ReturnType<typeof getPool>, sql: string, fallback: T): Promise<T> {
  try {
    const [rows] = await pool.query(sql);
    return rows as T;
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const result = await cached('dashboard:reports', CACHE_TTL, async () => {
      const pool = getPool();

      const [
        batchTargets,
        sparklineData,
        placementBatchData,
        placementStudentAgg,
        placementInterviewCount,
      ] = await Promise.all([
        // Batch targets per course
        safeQuery(pool, `
          SELECT
            c.Course_Id,
            c.Course_Name AS CourseName,
            (SELECT b2.Duration FROM batch_mst b2 WHERE b2.Course_Id = c.Course_Id AND b2.Duration IS NOT NULL AND b2.Duration != '' ORDER BY b2.Batch_Id DESC LIMIT 1) AS Duration,
            (SELECT b2.INR_Basic FROM batch_mst b2 WHERE b2.Course_Id = c.Course_Id AND b2.INR_Basic > 0 ORDER BY b2.Batch_Id DESC LIMIT 1) AS Fees,
            COUNT(DISTINCT b.Batch_Id) AS frequency_conducted,
            ROUND(
              (SELECT COUNT(*) FROM batch_mst b3 WHERE b3.Course_Id = c.Course_Id AND (b3.IsDelete IS NULL OR b3.IsDelete = 0) AND (b3.Cancel IS NULL OR b3.Cancel = 0))
              / GREATEST(1, TIMESTAMPDIFF(YEAR,
                (SELECT MIN(b4.SDate) FROM batch_mst b4 WHERE b4.Course_Id = c.Course_Id AND (b4.IsDelete IS NULL OR b4.IsDelete = 0)),
                CURDATE()))
            ) AS target_frequency,
            (SELECT b2.Max_Students FROM batch_mst b2 WHERE b2.Course_Id = c.Course_Id AND b2.Max_Students IS NOT NULL AND b2.Max_Students != '' AND b2.Max_Students != '0' ORDER BY b2.Batch_Id DESC LIMIT 1) AS min_students_batch,
            COALESCE(SUM(b.NoStudent), 0) AS students_admitted,
            COALESCE(
              (SELECT SUM(sf.Total_Amt) FROM s_fees_mst sf WHERE sf.Course_Id = c.Course_Id AND (sf.IsDelete IS NULL OR sf.IsDelete = 0) AND sf.Date_Added >= DATE_FORMAT(CURDATE(), '%Y-01-01')),
            0) AS fees_collected
          FROM course_mst c
          LEFT JOIN batch_mst b ON b.Course_Id = c.Course_Id
            AND (b.IsDelete IS NULL OR b.IsDelete = 0)
            AND (b.Cancel IS NULL OR b.Cancel = 0)
            AND b.SDate >= DATE_FORMAT(CURDATE(), '%Y-01-01')
          WHERE c.IsActive = 1 AND (c.IsDelete IS NULL OR c.IsDelete = 0)
          GROUP BY c.Course_Id, c.Course_Name
          ORDER BY COUNT(DISTINCT b.Batch_Id) DESC, c.Course_Name ASC
          LIMIT 15
        `, []),

        // Sparkline data
        safeQuery(pool, `
          SELECT c.Course_Id, DATE_FORMAT(b.SDate, '%Y-%m') AS month,
            COUNT(*) AS batch_count, COALESCE(SUM(b.NoStudent), 0) AS students
          FROM batch_mst b
          LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
          WHERE (b.IsDelete IS NULL OR b.IsDelete = 0)
            AND (b.Cancel IS NULL OR b.Cancel = 0)
            AND b.SDate >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
          GROUP BY c.Course_Id, DATE_FORMAT(b.SDate, '%Y-%m')
          ORDER BY c.Course_Id, month
        `, []),

        // Placement batch data
        safeQuery(pool, `
          SELECT
            b.Batch_Id,
            b.Batch_code,
            c.Course_Name,
            b.ConvocationDate,
            b.StudentPassed1 AS passed_student,
            COALESCE(b.Placement, 0) AS total_placed,
            COALESCE(b.lefted, 0) AS lefted
          FROM batch_mst b
          LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
          WHERE (b.IsDelete IS NULL OR b.IsDelete = 0)
            AND (b.Cancel IS NULL OR b.Cancel = 0)
            AND b.StudentPassed1 > 0
          ORDER BY b.ConvocationDate DESC
          LIMIT 50
        `, []),

        // Student aggregates per batch
        safeQuery(pool, `
          SELECT
            Batch_Code,
            COUNT(*) AS total_students,
            SUM(CASE WHEN CVDate IS NOT NULL AND CVDate != '' THEN 1 ELSE 0 END) AS cv_received,
            SUM(CASE WHEN LOWER(IFNULL(Placement_Type,'')) IN ('permanent','temporary')
                 OR LOWER(IFNULL(Placement_Type,'')) LIKE '%permanent%'
                 OR LOWER(IFNULL(Placement_Type,'')) LIKE '%temporary%' THEN 1 ELSE 0 END) AS self_placement,
            SUM(CASE WHEN Placement_Block = 'Yes' THEN 1 ELSE 0 END) AS placement_blocked
          FROM student_master
          WHERE (IsDelete IS NULL OR IsDelete = 0)
          GROUP BY Batch_Code
        `, []),

        // Interview count per batch
        safeQuery(pool, `
          SELECT Batch_Id, COUNT(*) AS interview_count
          FROM cv_shortlisted
          WHERE (IsDelete IS NULL OR IsDelete = 0)
          GROUP BY Batch_Id
        `, []),
      ]);

      // Merge placement data
      const studentAggMap: Record<string, { cv_received: number; self_placement: number; placement_blocked: number }> = {};
      for (const sa of placementStudentAgg as any[]) {
        studentAggMap[sa.Batch_Code] = {
          cv_received: Number(sa.cv_received) || 0,
          self_placement: Number(sa.self_placement) || 0,
          placement_blocked: Number(sa.placement_blocked) || 0,
        };
      }

      const interviewMap: Record<number, number> = {};
      for (const ic of placementInterviewCount as any[]) {
        interviewMap[ic.Batch_Id] = Number(ic.interview_count) || 0;
      }

      const placementRows = (placementBatchData as any[]).map((b: any) => {
        const sa = studentAggMap[b.Batch_code] ?? { cv_received: 0, self_placement: 0, placement_blocked: 0 };
        const passed = Number(b.passed_student) || 0;
        const totalPlaced = Number(b.total_placed) || 0;
        const cvReceived = sa.cv_received;
        const selfPlacement = sa.self_placement;
        const resumesNotReceived = Math.max(0, passed - cvReceived - selfPlacement);
        const others = Number(b.lefted) || 0;
        const totalInterviewed = interviewMap[b.Batch_Id] ?? 0;
        const placedPct = passed > 0 ? Math.round((totalPlaced / passed) * 1000) / 10 : 0;

        return {
          batchCode: b.Batch_code,
          courseName: b.Course_Name,
          convocationDate: b.ConvocationDate,
          passedStudent: passed,
          totalCvReceived: cvReceived,
          selfPlacement,
          resumesNotReceived,
          others,
          totalInterviewed,
          totalPlaced,
          placedPct,
        };
      });

      // Build sparkline map
      const sparkMap: Record<number, number[]> = {};
      for (const s of sparklineData as any[]) {
        if (!sparkMap[s.Course_Id]) sparkMap[s.Course_Id] = [];
        sparkMap[s.Course_Id].push(Number(s.students) || 0);
      }

      return {
        annualTargets: {
          batchTargets,
          sparklineData,
        },
        placementReport: {
          rows: placementRows,
          sparkMap,
        },
      };
    });

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (error: unknown) {
    console.error('Dashboard reports error:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}
