/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool, cached } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

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

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Dashboard data requires authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(request.url);
    const dept = searchParams.get('dept') || 'unknown';
    const result = await cached(`dashboard:${dept}`, CACHE_TTL, () => fetchDashboardData(dept));

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

async function fetchDashboardData(dept?: string) {
  const pool = getPool();

  const isCbd = dept === 'cbd';
  const isTd = dept === 'training_and_development';
  const isAdmin = dept === 'administration';
  const isGeneral = !isCbd && !isTd && !isAdmin;

  const needsAnnualTargets = isGeneral || isCbd;
  const needsUpcomingBatches = isGeneral || isCbd;
  const needsEnquiries = isGeneral || isCbd || isAdmin;
  const needsPlacement = isGeneral || isAdmin;
  const needsNotices = isGeneral;
  const needsLeadFunnel = isCbd || isAdmin;
  const needsSeminars = isCbd;
  const needsExhibitions = isCbd;
  const needsFollowups = isCbd || isAdmin;
  const needsDailyActivity = isCbd;
  const needsPendingFees = isCbd;
  const needsAlumni = isCbd;
  
  const needsTdDashboard = isTd;
  const needsTdConvocations = isTd || isAdmin;
  const needsTdExams = isTd || isAdmin;
  const needsTdSiteVisits = isTd || isAdmin;
  const needsTdLectures = isTd || isAdmin;
  
  const needsAdminWidgets = isAdmin;
  const needsQuickStats = isGeneral || isAdmin;

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
    sourcePerformanceRows,
    leadFunnelRows,
    seminarTargetsRows,
    seminarTargetsFallbackRows,
    exhibitionTargetsRows,
    pendingFollowupsRows,
    dailyActivityRows,
    pendingFeesRows,
    alumniProgressRows,
    tdOngoingBatchesRows,
    tdLowAttendanceRows,
    tdLowPerformanceRows,
    tdUpcomingExamsRows,
    tdUpcomingExamsFallbackRows,
    tdFinishedExamsRows,
    tdTodaysLecturesRows,
    tdGoogleReviewsPendingRows,
    tdUpcomingConvocationsRows,
    tdSiteVisitsRows,
    tdAdmissionCancelledRows,
    adminMeetingsRows,
    adminWeeklyReportRows,
    // Quick stats (cached separately with longer TTL)
    totalStudentsRows,
    activeCoursesRows,
    activeBatchesRows,
    totalFacultyRows,
  ] = await Promise.all([

    // 1a. awt_annual
    needsAnnualTargets ? safeQuery(pool, `
      SELECT id, selectcourse, batchcode, category, coursename,
        planned, admission, duration, coordinator, actualdate, timings, created_date
      FROM awt_annual WHERE deleted = 0 OR deleted IS NULL
      ORDER BY created_date DESC LIMIT 10
    `, []) : Promise.resolve([]),

    // 1b. Comprehensive batch targets per course
    needsAnnualTargets ? safeQuery(pool, `
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
      WHERE (c.IsDelete IS NULL OR c.IsDelete = 0)
        AND COALESCE(NULLIF(TRIM(c.Course_Name), ''), '') <> ''
      GROUP BY c.Course_Id, c.Course_Name
      ORDER BY COUNT(DISTINCT b.Batch_Id) DESC, c.Course_Name ASC
      LIMIT 15
    `, []) : Promise.resolve([]),

    // 1c. Sparkline data
    needsAnnualTargets ? safeQuery(pool, `
      SELECT c.Course_Id, DATE_FORMAT(b.SDate, '%Y-%m') AS month,
        COUNT(*) AS batch_count, COALESCE(SUM(b.NoStudent), 0) AS students
      FROM batch_mst b
      LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
      WHERE (b.IsDelete IS NULL OR b.IsDelete = 0)
        AND (b.Cancel IS NULL OR b.Cancel = 0)
        AND b.SDate >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY c.Course_Id, DATE_FORMAT(b.SDate, '%Y-%m')
      ORDER BY c.Course_Id, month
    `, []) : Promise.resolve([]),

    // 2. Upcoming batches
    needsUpcomingBatches ? safeQuery(pool, `
      SELECT b.Batch_Id, b.Batch_code, b.SDate, b.EDate,
        b.Category, b.Duration, b.Timings,
        b.Training_Coordinator, b.INR_Basic,
        b.Admission_Date, b.Max_Students,
        b.NoStudent,
        c.Course_Name AS CourseName
        ,(
          SELECT COUNT(*)
          FROM student_inquiry si
          WHERE si.Batch_Code = b.Batch_code
            AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
        ) AS Enquiries_Received
        ,(
          SELECT COUNT(*)
          FROM student_inquiry si
          WHERE si.Batch_Code = b.Batch_code
            AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
            AND TRIM(IFNULL(si.Discussion, '')) <> ''
        ) AS Enquiries_Contacted
        ,(
          SELECT COUNT(*)
          FROM student_inquiry si
          WHERE si.Batch_Code = b.Batch_code
            AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
            AND (
              LOWER(IFNULL(si.Inquiry, '')) IN ('yes', 'y', 'interested')
              OR LOWER(IFNULL(si.JobRequired, '')) IN ('yes', 'y')
              OR LOWER(IFNULL(si.Discussion, '')) LIKE '%interested%'
            )
        ) AS Interested_Students
        ,(
          SELECT COUNT(*)
          FROM student_inquiry si
          WHERE si.Batch_Code = b.Batch_code
            AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
            AND (
              LOWER(IFNULL(si.Admission, '')) IN ('yes', 'y', '1', 'true')
              OR IFNULL(si.admission_done, 0) = 1
            )
        ) AS Confirmed_Admissions
      FROM batch_mst b
      LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
      WHERE b.SDate >= CURDATE()
        AND (b.IsDelete IS NULL OR b.IsDelete = 0)
        AND (b.Cancel IS NULL OR b.Cancel = 0)
      ORDER BY b.SDate ASC LIMIT 20
    `, []) : Promise.resolve([]),

    // 3a. Enquiry summary
    needsEnquiries ? safeQuery(pool, `
      SELECT COUNT(*) as total_enquiries,
        SUM(CASE WHEN inquiry_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as last_30_days,
        SUM(CASE WHEN inquiry_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as last_7_days
      FROM student_inquiry WHERE (IsDelete = 0 OR IsDelete IS NULL)
    `, [{ total_enquiries: 0, last_30_days: 0, last_7_days: 0 }]) : Promise.resolve([{ total_enquiries: 0, last_30_days: 0, last_7_days: 0 }]),

    // 3b. Recent student enquiries
    needsEnquiries ? safeQuery(pool, `
      SELECT id, student_name, email, phone, course_id, inquiry_date, status
      FROM student_inquiry WHERE (IsDelete = 0 OR IsDelete IS NULL)
      ORDER BY id DESC LIMIT 10
    `, []) : Promise.resolve([]),

    // 3c. Corporate total
    needsEnquiries ? safeQuery(pool, `
      SELECT COUNT(*) as total FROM corporate_inquiry WHERE (IsDelete = 0 OR IsDelete IS NULL)
    `, [{ total: 0 }]) : Promise.resolve([{total: 0}]),

    // 3d. Recent corporate
    needsEnquiries ? safeQuery(pool, `
      SELECT Id, FullName, CompanyName, Designation, Mobile, Email, Course_Id, Idate
      FROM corporate_inquiry WHERE (IsDelete = 0 OR IsDelete IS NULL)
      ORDER BY Id DESC LIMIT 10
    `, []) : Promise.resolve([]),

    // 4a. Placement batch data (per-batch rows for placement table)
    needsPlacement ? safeQuery(pool, `
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
    `, []) : Promise.resolve([]),

    // 4b. Student aggregates per batch (CV, self-placement)
    needsPlacement ? safeQuery(pool, `
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
    `, []) : Promise.resolve([]),

    // 4c. Interview count per batch (from cv_shortlisted)
    needsPlacement ? safeQuery(pool, `
      SELECT Batch_Id, COUNT(*) AS interview_count
      FROM cv_shortlisted
      WHERE (IsDelete IS NULL OR IsDelete = 0)
      GROUP BY Batch_Id
    `, []) : Promise.resolve([]),

    // 4d. Active requirements count
    needsPlacement ? safeQuery(pool, `
      SELECT COUNT(*) as active_requirements
      FROM company_requirements_apk
      WHERE (IsDelete IS NULL OR IsDelete = 0) AND IsActive = 1
    `, [{ active_requirements: 0 }]) : Promise.resolve([{ active_requirements: 0 }]),

    // 4e. Company requirements list
    needsPlacement ? safeQuery(pool, `
      SELECT CompReqId, Profile, Location, Eligibility, PostedDate, CompanyName
      FROM company_requirements_apk
      WHERE (IsDelete IS NULL OR IsDelete = 0) AND IsActive = 1
      ORDER BY CompReqId DESC LIMIT 5
    `, []) : Promise.resolve([]),

    // 6. Notices
    needsNotices ? safeQuery(pool, `
      SELECT id, startdate, enddate, specification, created_date
      FROM awt_noticeboard
      WHERE (deleted = 0 OR deleted IS NULL) AND specification IS NOT NULL AND specification != ''
      ORDER BY id DESC LIMIT 5
    `, []) : Promise.resolve([]),

    // 7. Source wise performance (from student enquiry source funnel)
    needsLeadFunnel ? safeQuery(pool, `
      SELECT
        COALESCE(NULLIF(TRIM(Inquiry_From), ''), 'Unknown') AS source,
        COUNT(*) AS leads,
        SUM(CASE
          WHEN LOWER(IFNULL(Admission, '')) IN ('yes', 'y', '1', 'true')
            OR IFNULL(admission_done, 0) = 1
          THEN 1 ELSE 0 END) AS admissions
      FROM student_inquiry
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
      GROUP BY COALESCE(NULLIF(TRIM(Inquiry_From), ''), 'Unknown')
      ORDER BY leads DESC
      LIMIT 12
    `, []) : Promise.resolve([]),

    // 8. Lead funnel summary
    needsLeadFunnel ? safeQuery(pool, `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN TRIM(IFNULL(Discussion, '')) <> '' THEN 1 ELSE 0 END) AS contacted,
        SUM(CASE
          WHEN LOWER(IFNULL(Inquiry, '')) IN ('yes', 'y', 'interested')
            OR LOWER(IFNULL(JobRequired, '')) IN ('yes', 'y')
            OR LOWER(IFNULL(Discussion, '')) LIKE '%interested%'
          THEN 1 ELSE 0 END) AS interested,
        SUM(CASE
          WHEN LOWER(IFNULL(Admission, '')) IN ('yes', 'y', '1', 'true')
            OR IFNULL(admission_done, 0) = 1
          THEN 1 ELSE 0 END) AS converted
      FROM student_inquiry
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
    `, [{ total: 0, contacted: 0, interested: 0, converted: 0 }]) : Promise.resolve([{ total: 0, contacted: 0, interested: 0, converted: 0 }]),

    // 2. Seminar targets (scrollable) from annual planner items containing seminar signals
    needsSeminars ? safeQuery(pool, `
      SELECT
        DATE_FORMAT(IFNULL(actualdate, created_date), '%b %Y') AS month,
        COALESCE(NULLIF(TRIM(description), ''), NULLIF(TRIM(training), ''), NULLIF(TRIM(coursename), ''), 'Seminar') AS college_name,
        DATE_FORMAT(IFNULL(actualdate, created_date), '%d-%m-%Y') AS date,
        CASE WHEN IFNULL(planned, 0) > 0 THEN ROUND((IFNULL(admission, 0) / planned) * 100, 1) ELSE 0 END AS annual_percentage
      FROM awt_annual
      WHERE (deleted = 0 OR deleted IS NULL)
        AND (
          LOWER(IFNULL(category, '')) LIKE '%semin%'
          OR LOWER(IFNULL(description, '')) LIKE '%semin%'
          OR LOWER(IFNULL(training, '')) LIKE '%semin%'
        )
      ORDER BY IFNULL(actualdate, created_date) DESC
      LIMIT 30
    `, []) : Promise.resolve([]),

    // Seminar fallback (fast path from followups when annual planner has no seminar rows)
    needsSeminars ? safeQuery(pool, `
      SELECT
        '' AS month,
        COALESCE(NULLIF(TRIM(CName), ''), 'Seminar') AS college_name,
        COALESCE(NULLIF(TRIM(nextdate), ''), NULLIF(TRIM(Tdate), ''), '-') AS date,
        0 AS annual_percentage
      FROM college_follow_new
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
        AND LOWER(IFNULL(Purpose, '')) LIKE '%semin%'
      ORDER BY Follow_id DESC
      LIMIT 30
    `, []) : Promise.resolve([]),

    // 3. Exhibition targets summary from annual planner items containing exhibition signals
    needsExhibitions ? safeQuery(pool, `
      SELECT
        COALESCE(SUM(IFNULL(planned, 0)), 0) AS planned,
        COALESCE(SUM(IFNULL(admission, 0)), 0) AS completed,
        CASE WHEN COALESCE(SUM(IFNULL(planned, 0)), 0) > 0
          THEN ROUND((COALESCE(SUM(IFNULL(admission, 0)), 0) / COALESCE(SUM(IFNULL(planned, 0)), 0)) * 100, 1)
          ELSE 0 END AS achievement_pct
      FROM awt_annual
      WHERE (deleted = 0 OR deleted IS NULL)
        AND (
          LOWER(IFNULL(category, '')) LIKE '%exhib%'
          OR LOWER(IFNULL(description, '')) LIKE '%exhib%'
          OR LOWER(IFNULL(training, '')) LIKE '%exhib%'
        )
    `, [{ planned: 0, completed: 0, achievement_pct: 0 }]) : Promise.resolve([{ planned: 0, completed: 0, achievement_pct: 0 }]),

    // 5. Pending followups (college follow records with next date due)
    needsFollowups ? safeQuery(pool, `
      SELECT
        Follow_id AS id,
        CName AS name,
        COALESCE(NULLIF(TRIM(nextdate), ''), NULLIF(TRIM(Tdate), ''), '-') AS next_followup_date,
        Purpose AS purpose,
        College_id
      FROM college_follow_new
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
        AND (
          NULLIF(TRIM(IFNULL(nextdate, '')), '') IS NOT NULL
          OR NULLIF(TRIM(IFNULL(Tdate, '')), '') IS NOT NULL
        )
      ORDER BY Follow_id DESC
      LIMIT 30
    `, []) : Promise.resolve([]),

    // 6. Daily activity tracker (last 7 days)
    needsDailyActivity ? safeQuery(pool, `
      SELECT label, value FROM (
        SELECT 'New Enquiries (7d)' AS label, COUNT(*) AS value
        FROM student_inquiry
        WHERE (IsDelete = 0 OR IsDelete IS NULL)
          AND DATE(IFNULL(Date_Added, Inquiry_Dt)) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)

        UNION ALL

        SELECT 'Admissions Done (7d)' AS label, COUNT(*) AS value
        FROM admission_master
        WHERE (IsDelete = 0 OR IsDelete IS NULL)
          AND DATE(Admission_Date) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)

        UNION ALL

        SELECT 'Followups Logged (7d)' AS label, COUNT(*) AS value
        FROM college_follow_new
        WHERE (IsDelete = 0 OR IsDelete IS NULL)
          AND DATE(IFNULL(Tdate, CURDATE())) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      ) x
    `, []) : Promise.resolve([]),

    // 9. Pending fees
    needsPendingFees ? safeQuery(pool, `
      SELECT
        am.Admission_Id AS id,
        sm.Student_Name AS student_name,
        GREATEST(IFNULL(am.Fees, 0) - IFNULL(paid.total_paid, 0), 0) AS amount
      FROM admission_master am
      LEFT JOIN student_master sm ON sm.Student_Id = am.Student_Id
      LEFT JOIN (
        SELECT Admission_Id, SUM(IFNULL(Total_Amt, 0)) AS total_paid
        FROM s_fees_mst
        WHERE (IsDelete IS NULL OR IsDelete = 0)
        GROUP BY Admission_Id
      ) paid ON paid.Admission_Id = am.Admission_Id
      WHERE (am.IsDelete = 0 OR am.IsDelete IS NULL)
        AND IFNULL(am.Fees, 0) > IFNULL(paid.total_paid, 0)
      ORDER BY amount DESC
      LIMIT 30
    `, []) : Promise.resolve([]),

    // 10. Alumni registration progress approximated by contact completeness per batch
    needsAlumni ? safeQuery(pool, `
      SELECT
        b.Batch_code AS batch_no,
        COALESCE(c.Course_Name, b.CourseName, 'N/A') AS training_program,
        ROUND(
          100 * SUM(CASE
            WHEN TRIM(IFNULL(sm.Email, '')) <> '' OR TRIM(IFNULL(sm.Present_Mobile, '')) <> ''
            THEN 1 ELSE 0 END) / NULLIF(COUNT(sm.Student_Id), 0),
          1
        ) AS registered_pct
      FROM batch_mst b
      LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id
      LEFT JOIN student_master sm ON sm.Batch_Code = b.Batch_code
        AND (sm.IsDelete IS NULL OR sm.IsDelete = 0)
      WHERE (b.IsDelete IS NULL OR b.IsDelete = 0)
        AND b.Batch_code IS NOT NULL AND b.Batch_code <> ''
      GROUP BY b.Batch_code, COALESCE(c.Course_Name, b.CourseName, 'N/A')
      HAVING COUNT(sm.Student_Id) > 0
      ORDER BY registered_pct ASC, b.Batch_code DESC
      LIMIT 25
    `, []) : Promise.resolve([]),

    // T&D-1 Ongoing batches metrics
    needsTdDashboard ? safeQuery(pool, `
      SELECT
        b.Batch_Id,
        b.Batch_code AS batch_no,
        COALESCE(c.Course_Name, b.CourseName, 'N/A') AS training_program,
        CASE
          WHEN b.SDate IS NULL OR b.EDate IS NULL OR DATEDIFF(b.EDate, b.SDate) <= 0 THEN 0
          ELSE ROUND(
            LEAST(100, GREATEST(0, (DATEDIFF(CURDATE(), b.SDate) / DATEDIFF(b.EDate, b.SDate)) * 100)),
            1
          )
        END AS percentage_complete,
        COALESCE(NULLIF(b.NoStudent, ''), 0) AS total_students,
        ROUND(AVG(CASE
          WHEN TRIM(IFNULL(am.Stud_Attend, '')) REGEXP '^[0-9]+(\\.[0-9]+)?$'
          THEN CAST(am.Stud_Attend AS DECIMAL(10,2))
          ELSE NULL END), 1) AS avg_attendance_pct,
        ROUND(AVG(CASE
          WHEN TRIM(IFNULL(sm.Percentage, '')) REGEXP '^[0-9]+(\\.[0-9]+)?$'
          THEN CAST(sm.Percentage AS DECIMAL(10,2))
          ELSE NULL END), 1) AS avg_marks_pct,
        SUM(CASE
          WHEN TRIM(IFNULL(sm.Percentage, '')) REGEXP '^[0-9]+(\\.[0-9]+)?$'
            AND CAST(sm.Percentage AS DECIMAL(10,2)) < 40
          THEN 1 ELSE 0 END) AS low_performing_students
      FROM batch_mst b
      LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id
      LEFT JOIN admission_master am ON am.Batch_Id = b.Batch_Id AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
      LEFT JOIN student_master sm ON sm.Student_Id = am.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
      WHERE (b.IsDelete = 0 OR b.IsDelete IS NULL)
        AND (b.Cancel IS NULL OR b.Cancel = 0)
        AND b.SDate <= CURDATE() AND b.EDate >= CURDATE()
      GROUP BY b.Batch_Id, b.Batch_code, COALESCE(c.Course_Name, b.CourseName, 'N/A'), b.SDate, b.EDate, b.NoStudent
      ORDER BY b.SDate ASC
      LIMIT 30
    `, []) : Promise.resolve([]),

    // T&D-2 Low attendance students
    needsTdDashboard ? safeQuery(pool, `
      SELECT
        sm.Student_Name AS name,
        b.Batch_code AS batch_no,
        COALESCE(c.Course_Name, b.CourseName, 'N/A') AS training_program,
        ROUND(CAST(am.Stud_Attend AS DECIMAL(10,2)), 1) AS attendance_pct
      FROM admission_master am
      INNER JOIN student_master sm ON sm.Student_Id = am.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
      LEFT JOIN batch_mst b ON b.Batch_Id = am.Batch_Id
      LEFT JOIN course_mst c ON c.Course_Id = am.Course_Id
      WHERE (am.IsDelete = 0 OR am.IsDelete IS NULL)
        AND TRIM(IFNULL(am.Stud_Attend, '')) REGEXP '^[0-9]+(\\.[0-9]+)?$'
        AND CAST(am.Stud_Attend AS DECIMAL(10,2)) < 75
      ORDER BY CAST(am.Stud_Attend AS DECIMAL(10,2)) ASC
      LIMIT 50
    `, []) : Promise.resolve([]),

    // T&D-3 Low performing students
    needsTdDashboard ? safeQuery(pool, `
      SELECT
        sm.Student_Name AS name,
        sm.Batch_Code AS batch_no,
        COALESCE(c.Course_Name, 'N/A') AS training_program,
        ROUND(CAST(sm.Percentage AS DECIMAL(10,2)), 1) AS marks_pct
      FROM student_master sm
      LEFT JOIN batch_mst b ON b.Batch_code = sm.Batch_Code
      LEFT JOIN course_mst c ON c.Course_Id = COALESCE(sm.Course_Id, b.Course_Id)
      WHERE (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
        AND TRIM(IFNULL(sm.Percentage, '')) REGEXP '^[0-9]+(\\.[0-9]+)?$'
        AND CAST(sm.Percentage AS DECIMAL(10,2)) < 40
      ORDER BY CAST(sm.Percentage AS DECIMAL(10,2)) ASC
      LIMIT 50
    `, []) : Promise.resolve([]),

    // T&D-4 Upcoming exams
    needsTdExams ? safeQuery(pool, `
      SELECT
        b.Batch_code AS batch_no,
        COALESCE(c.Course_Name, b.CourseName, 'N/A') AS training_program,
        e.Exam_Date AS exam_date,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM s_exam_taken_master sem
            WHERE sem.Exam_Id = e.Exam_Id
              AND (sem.IsDelete = 0 OR sem.IsDelete IS NULL)
          ) THEN 'Paper Prepared'
          ELSE 'Paper Pending'
        END AS paper_status
      FROM batch_final_exam e
      LEFT JOIN batch_mst b ON b.Batch_Id = e.Batch_Id
      LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id
      WHERE (e.IsDelete = 0 OR e.IsDelete IS NULL)
        AND DATE(e.Exam_Date) >= CURDATE()
      ORDER BY DATE(e.Exam_Date) ASC
      LIMIT 40
    `, []) : Promise.resolve([]),

    // T&D-4b Fallback exam schedule when no future exams exist
    needsTdExams ? safeQuery(pool, `
      SELECT
        b.Batch_code AS batch_no,
        COALESCE(c.Course_Name, b.CourseName, 'N/A') AS training_program,
        e.Exam_Date AS exam_date,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM s_exam_taken_master sem
            WHERE sem.Exam_Id = e.Exam_Id
              AND (sem.IsDelete = 0 OR sem.IsDelete IS NULL)
          ) THEN 'Paper Prepared'
          ELSE 'Paper Pending'
        END AS paper_status
      FROM batch_final_exam e
      LEFT JOIN batch_mst b ON b.Batch_Id = e.Batch_Id
      LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id
      WHERE (e.IsDelete = 0 OR e.IsDelete IS NULL)
      ORDER BY DATE(e.Exam_Date) DESC
      LIMIT 40
    `, []) : Promise.resolve([]),

    // T&D-5 Finished exams
    needsTdDashboard ? safeQuery(pool, `
      SELECT
        b.Batch_code AS batch_no,
        COALESCE(c.Course_Name, b.CourseName, 'N/A') AS training_program,
        e.Exam_Date AS exam_date,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM s_exam_taken_master sem
            WHERE sem.Exam_Id = e.Exam_Id
              AND (sem.IsDelete = 0 OR sem.IsDelete IS NULL)
          ) THEN 'Paper Taken'
          ELSE 'Completed'
        END AS paper_status,
        ROUND(AVG(CASE
          WHEN TRIM(IFNULL(sm.Percentage, '')) REGEXP '^[0-9]+(\\.[0-9]+)?$'
          THEN CAST(sm.Percentage AS DECIMAL(10,2))
          ELSE NULL END), 1) AS average_marks_pct
      FROM batch_final_exam e
      LEFT JOIN batch_mst b ON b.Batch_Id = e.Batch_Id
      LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id
      LEFT JOIN student_master sm ON sm.Batch_Code = b.Batch_code AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
      WHERE (e.IsDelete = 0 OR e.IsDelete IS NULL)
        AND DATE(e.Exam_Date) < CURDATE()
      GROUP BY b.Batch_code, COALESCE(c.Course_Name, b.CourseName, 'N/A'), e.Exam_Date, e.Exam_Id
      ORDER BY DATE(e.Exam_Date) DESC
      LIMIT 40
    `, []) : Promise.resolve([]),

    // T&D-6 Today's lectures
    needsTdLectures ? safeQuery(pool, `
      SELECT
        b.Batch_code AS batch_no,
        COALESCE(c.Course_Name, b.CourseName, 'N/A') AS training_program,
        ltm.Topic AS lecture_topic,
        ltm.ClassRoom AS room_no,
        fm.Faculty_Name AS trainer
      FROM lecture_taken_master ltm
      LEFT JOIN batch_mst b ON b.Batch_Id = ltm.Batch_Id
      LEFT JOIN course_mst c ON c.Course_Id = ltm.Course_Id
      LEFT JOIN faculty_master fm ON fm.Faculty_Id = ltm.Faculty_Id
      WHERE (ltm.IsDelete = 0 OR ltm.IsDelete IS NULL)
        AND DATE(ltm.Take_Dt) = CURDATE()
      ORDER BY ltm.Lecture_Start ASC, ltm.Take_Id DESC
      LIMIT 50
    `, []) : Promise.resolve([]),

    // T&D-7 Google reviews pending (proxy using missing SIT performance feedback)
    needsTdDashboard ? safeQuery(pool, `
      SELECT COUNT(*) AS pending_count
      FROM student_master sm
      WHERE (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
        AND (LOWER(IFNULL(sm.Admission, '')) IN ('yes', 'y', '1', 'true') OR IFNULL(sm.admission_done, 0) = 1)
        AND TRIM(IFNULL(sm.SitPerformance, '')) = ''
    `, [{ pending_count: 0 }]) : Promise.resolve([{ pending_count: 0 }]),

    // T&D-8 Upcoming convocations
    needsTdConvocations ? safeQuery(pool, `
      SELECT
        Id AS id,
        Batch_List AS batch_list,
        Convocation_Date AS convocation_date
      FROM convocation_mst
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
        AND DATE(Convocation_Date) >= CURDATE()
      ORDER BY DATE(Convocation_Date) ASC
      LIMIT 30
    `, []) : Promise.resolve([]),

    // T&D-9 Site visits
    needsTdSiteVisits ? safeQuery(pool, `
      SELECT
        Visit_Id AS id,
        Batch_Code AS batch_no,
        Course_Name AS training_program,
        Region AS region,
        Location AS location,
        Visit_Date AS visit_date,
        ConfirmDAte AS confirm_date,
        Total_Student AS total_student
      FROM site_visit_master
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
      ORDER BY DATE(IFNULL(Visit_Date, ConfirmDAte)) DESC
      LIMIT 40
    `, []) : Promise.resolve([]),

    // T&D-10 Admission cancelled
    needsTdDashboard ? safeQuery(pool, `
      SELECT
        bc.Cancel_Id AS id,
        sm.Student_Name AS student_name,
        b.Batch_code AS batch_no,
        COALESCE(c.Course_Name, b.CourseName, 'N/A') AS training_program,
        bc.Cancel_Amt AS cancel_amount,
        bc.Date_Added AS cancel_date
      FROM batch_cancel bc
      LEFT JOIN student_master sm ON sm.Student_Id = bc.Student_Id
      LEFT JOIN batch_mst b ON b.Batch_Id = bc.Batch_Id
      LEFT JOIN course_mst c ON c.Course_Id = COALESCE(bc.Course_Id, b.Course_Id)
      WHERE (bc.IsDelete = 0 OR bc.IsDelete IS NULL)
      ORDER BY DATE(bc.Date_Added) DESC
      LIMIT 50
    `, []) : Promise.resolve([]),

    // Admin - meetings (today and recent) from followups marked as meetings
    needsAdminWidgets ? safeQuery(pool, `
      SELECT
        Follow_id AS id,
        COALESCE(NULLIF(TRIM(CName), ''), 'Meeting') AS title,
        Purpose AS purpose,
        COALESCE(NULLIF(TRIM(nextdate), ''), NULLIF(TRIM(Tdate), ''), '-') AS meeting_date
      FROM college_follow_new
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
        AND LOWER(IFNULL(Purpose, '')) LIKE '%meeting%'
      ORDER BY Follow_id DESC
      LIMIT 20
    `, []) : Promise.resolve([]),

    // Admin - weekly report summary
    needsAdminWidgets ? safeQuery(pool, `
      SELECT metric, value FROM (
        SELECT 'New Enquiries (7d)' AS metric, COUNT(*) AS value
        FROM student_inquiry
        WHERE (IsDelete = 0 OR IsDelete IS NULL)
          AND DATE(IFNULL(Date_Added, Inquiry_Dt)) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)

        UNION ALL

        SELECT 'Admissions Done (7d)' AS metric, COUNT(*) AS value
        FROM admission_master
        WHERE (IsDelete = 0 OR IsDelete IS NULL)
          AND DATE(Admission_Date) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)

        UNION ALL

        SELECT 'Followups Logged (7d)' AS metric, COUNT(*) AS value
        FROM college_follow_new
        WHERE (IsDelete = 0 OR IsDelete IS NULL)
          AND DATE(
            COALESCE(
              STR_TO_DATE(Tdate, '%Y-%m-%d'),
              STR_TO_DATE(Tdate, '%d-%m-%Y'),
              STR_TO_DATE(Tdate, '%d/%m/%Y'),
              CURDATE()
            )
          ) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)

        UNION ALL

        SELECT 'Lectures Taken (7d)' AS metric, COUNT(*) AS value
        FROM lecture_taken_master
        WHERE (IsDelete = 0 OR IsDelete IS NULL)
          AND DATE(Take_Dt) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      ) x
    `, []) : Promise.resolve([]),

    // 5. Quick stats (4 count queries)
    needsQuickStats ? cached('qs:students', CACHE_TTL_STATS, () =>
      safeQuery(pool, "SELECT COUNT(*) as cnt FROM student_master WHERE (IsDelete IS NULL OR IsDelete = 0)", [{ cnt: 0 }])
    ) : Promise.resolve([{cnt: 0}]),
    needsQuickStats ? cached('qs:courses', CACHE_TTL_STATS, () =>
      safeQuery(pool, "SELECT COUNT(*) as cnt FROM course_mst WHERE IsActive = 1 AND (IsDelete IS NULL OR IsDelete = 0)", [{ cnt: 0 }])
    ) : Promise.resolve([{cnt: 0}]),
    needsQuickStats ? cached('qs:batches', CACHE_TTL_STATS, () =>
      safeQuery(pool, "SELECT COUNT(*) as cnt FROM batch_mst WHERE (IsDelete IS NULL OR IsDelete = 0) AND (Cancel IS NULL OR Cancel = 0) AND SDate <= CURDATE() AND EDate >= CURDATE()", [{ cnt: 0 }])
    ) : Promise.resolve([{cnt: 0}]),
    needsQuickStats ? cached('qs:faculty', CACHE_TTL_STATS, () =>
      safeQuery(pool, "SELECT COUNT(*) as cnt FROM faculty_master WHERE (IsDelete IS NULL OR IsDelete = 0)", [{ cnt: 0 }])
    ) : Promise.resolve([{cnt: 0}]),
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

  const sourcePerformance = (sourcePerformanceRows as any[]).map((r: any) => {
    const leads = Number(r.leads) || 0;
    const admissions = Number(r.admissions) || 0;
    return {
      source: r.source || 'Unknown',
      leads,
      admissions,
      conversion_pct: leads > 0 ? Math.round((admissions / leads) * 1000) / 10 : 0,
    };
  });

  const leadFunnel = {
    total: Number((leadFunnelRows as any[])[0]?.total || 0),
    contacted: Number((leadFunnelRows as any[])[0]?.contacted || 0),
    interested: Number((leadFunnelRows as any[])[0]?.interested || 0),
    converted: Number((leadFunnelRows as any[])[0]?.converted || 0),
  };

  const trainingDevelopment = {
    ongoingBatches: tdOngoingBatchesRows,
    lowAttendanceStudents: tdLowAttendanceRows,
    lowPerformingStudents: tdLowPerformanceRows,
    upcomingExams: (tdUpcomingExamsRows as any[]).length > 0 ? tdUpcomingExamsRows : tdUpcomingExamsFallbackRows,
    finishedExams: tdFinishedExamsRows,
    todaysLectures: tdTodaysLecturesRows,
    googleReviewsPending: Number((tdGoogleReviewsPendingRows as any[])[0]?.pending_count || 0),
    upcomingConvocations: tdUpcomingConvocationsRows,
    siteVisits: tdSiteVisitsRows,
    admissionCancelled: tdAdmissionCancelledRows,
  };

  const adminDashboard = {
    meetings: adminMeetingsRows,
    weeklyReport: adminWeeklyReportRows,
  };

  return {
    annualTargets: {
      targets: annualTargets,
      batchTargets: batchTargets,
      sparklineData: sparklineData,
    },
    upcomingBatches,
    sourcePerformance,
    leadFunnel,
    seminarTargets: (seminarTargetsRows as any[]).length > 0 ? seminarTargetsRows : seminarTargetsFallbackRows,
    exhibitionTargets: (exhibitionTargetsRows as any[])[0] || { planned: 0, completed: 0, achievement_pct: 0 },
    pendingFollowups: pendingFollowupsRows,
    dailyActivity: dailyActivityRows,
    pendingFees: pendingFeesRows,
    alumniRegistration: alumniProgressRows,
    trainingDevelopment,
    adminDashboard,
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
