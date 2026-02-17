/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getPool, cached } from '@/lib/db';

// Cache TTLs (ms)
const CACHE_TTL = 5 * 60 * 1000;           // 5 min — main dashboard
const CACHE_TTL_STATS = 10 * 60 * 1000;    // 10 min — slow-moving counts

// ── helper: safe query that never throws ──
async function safeQuery<T>(pool: ReturnType<typeof getPool>, sql: string, fallback: T): Promise<T> {
  try {
    const [rows] = await pool.query(sql);
    return rows as T;
  } catch {
    return fallback;
  }
}

export async function GET() {
  try {
    const result = await cached('dashboard', CACHE_TTL, fetchDashboardData);

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
      },
    });
  } catch (error: unknown) {
    console.error('Dashboard data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

async function fetchDashboardData() {
  const pool = getPool();

  // ── Run ALL independent queries in parallel ──────────────────────
  const [
    annualTargets,
    batchTargets,
    sparklineData,
    upcomingBatches,
    enquirySummaryRows,
    recentEnquiries,
    corporateTotalRows,
    recentCorporate,
    placementBatchData,
    placementStudentAgg,
    placementInterviewCount,
    activeReqRows,
    companyRequirementsList,
    notices,
    // Quick stats (cached separately with longer TTL)
    totalStudentsRows,
    activeCoursesRows,
    activeBatchesRows,
    totalFacultyRows,
  ] = await Promise.all([

    // 1a. awt_annual
    safeQuery(pool, `
      SELECT id, selectcourse, batchcode, category, coursename,
        planned, admission, duration, coordinator, actualdate, timings, created_date
      FROM awt_annual WHERE deleted = 0 OR deleted IS NULL
      ORDER BY created_date DESC LIMIT 10
    `, []),

    // 1b. Comprehensive batch targets per course
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

    // 1c. Sparkline data
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

    // 2. Upcoming batches
    safeQuery(pool, `
      SELECT b.Batch_Id, b.Batch_code, b.SDate, b.EDate,
        b.Category, b.Duration, b.Timings,
        b.Training_Coordinator, b.INR_Basic,
        b.Admission_Date, b.Max_Students,
        c.Course_Name AS CourseName
      FROM batch_mst b
      LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
      WHERE b.SDate >= CURDATE()
        AND (b.IsDelete IS NULL OR b.IsDelete = 0)
        AND (b.Cancel IS NULL OR b.Cancel = 0)
      ORDER BY b.SDate ASC LIMIT 10
    `, []),

    // 3a. Enquiry summary
    safeQuery(pool, `
      SELECT COUNT(*) as total_enquiries,
        SUM(CASE WHEN inquiry_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as last_30_days,
        SUM(CASE WHEN inquiry_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as last_7_days
      FROM student_inquiry WHERE (IsDelete = 0 OR IsDelete IS NULL)
    `, [{ total_enquiries: 0, last_30_days: 0, last_7_days: 0 }]),

    // 3b. Recent student enquiries
    safeQuery(pool, `
      SELECT id, student_name, email, phone, course_id, inquiry_date, status
      FROM student_inquiry WHERE (IsDelete = 0 OR IsDelete IS NULL)
      ORDER BY id DESC LIMIT 10
    `, []),

    // 3c. Corporate total
    safeQuery(pool, `
      SELECT COUNT(*) as total FROM corporate_inquiry WHERE (IsDelete = 0 OR IsDelete IS NULL)
    `, [{ total: 0 }]),

    // 3d. Recent corporate
    safeQuery(pool, `
      SELECT Id, FullName, CompanyName, Designation, Mobile, Email, Course_Id, Idate
      FROM corporate_inquiry WHERE (IsDelete = 0 OR IsDelete IS NULL)
      ORDER BY Id DESC LIMIT 10
    `, []),

    // 4a. Placement batch data (per-batch rows for placement table)
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

    // 4b. Student aggregates per batch (CV, self-placement)
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

    // 4c. Interview count per batch (from cv_shortlisted)
    safeQuery(pool, `
      SELECT Batch_Id, COUNT(*) AS interview_count
      FROM cv_shortlisted
      WHERE (IsDelete IS NULL OR IsDelete = 0)
      GROUP BY Batch_Id
    `, []),

    // 4d. Active requirements count
    safeQuery(pool, `
      SELECT COUNT(*) as active_requirements
      FROM company_requirements_apk
      WHERE (IsDelete IS NULL OR IsDelete = 0) AND IsActive = 1
    `, [{ active_requirements: 0 }]),

    // 4e. Company requirements list
    safeQuery(pool, `
      SELECT CompReqId, Profile, Location, Eligibility, PostedDate, CompanyName
      FROM company_requirements_apk
      WHERE (IsDelete IS NULL OR IsDelete = 0) AND IsActive = 1
      ORDER BY CompReqId DESC LIMIT 5
    `, []),

    // 6. Notices
    safeQuery(pool, `
      SELECT id, startdate, enddate, specification, created_date
      FROM awt_noticeboard
      WHERE (deleted = 0 OR deleted IS NULL) AND specification IS NOT NULL AND specification != ''
      ORDER BY id DESC LIMIT 5
    `, []),

    // 5. Quick stats (4 count queries)
    cached('qs:students', CACHE_TTL_STATS, () =>
      safeQuery(pool, "SELECT COUNT(*) as cnt FROM student_master WHERE (IsDelete IS NULL OR IsDelete = 0)", [{ cnt: 0 }])
    ),
    cached('qs:courses', CACHE_TTL_STATS, () =>
      safeQuery(pool, "SELECT COUNT(*) as cnt FROM course_mst WHERE IsActive = 1 AND (IsDelete IS NULL OR IsDelete = 0)", [{ cnt: 0 }])
    ),
    cached('qs:batches', CACHE_TTL_STATS, () =>
      safeQuery(pool, "SELECT COUNT(*) as cnt FROM batch_mst WHERE (IsDelete IS NULL OR IsDelete = 0) AND (Cancel IS NULL OR Cancel = 0) AND SDate <= CURDATE() AND EDate >= CURDATE()", [{ cnt: 0 }])
    ),
    cached('qs:faculty', CACHE_TTL_STATS, () =>
      safeQuery(pool, "SELECT COUNT(*) as cnt FROM faculty_master WHERE (IsDelete IS NULL OR IsDelete = 0)", [{ cnt: 0 }])
    ),
  ]);

  // ── Shape the response ──────────────────────────────────────────
  const esRow = (enquirySummaryRows as Record<string, number>[])[0] ?? {};

  // Merge placement data: batch rows + student aggregates + interview counts
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

  return {
    annualTargets: {
      targets: annualTargets,
      batchTargets: batchTargets,
      sparklineData: sparklineData,
    },
    upcomingBatches,
    enquiryReport: {
      summary: {
        total_enquiries: esRow.total_enquiries || 0,
        last_30_days: esRow.last_30_days || 0,
        last_7_days: esRow.last_7_days || 0,
      },
      recentEnquiries,
      corporateTotal: (corporateTotalRows as Record<string, number>[])[0]?.total || 0,
      recentCorporate,
    },
    placementReport: {
      rows: placementRows,
      activeRequirements: (activeReqRows as Record<string, number>[])[0]?.active_requirements || 0,
      companyRequirements: companyRequirementsList,
    },
    quickStats: {
      totalStudents: (totalStudentsRows as Record<string, number>[])[0]?.cnt || 0,
      activeCourses: (activeCoursesRows as Record<string, number>[])[0]?.cnt || 0,
      activeBatches: (activeBatchesRows as Record<string, number>[])[0]?.cnt || 0,
      totalFaculty: (totalFacultyRows as Record<string, number>[])[0]?.cnt || 0,
    },
    notices,
  };
}
