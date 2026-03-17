/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getStudentSession } from '@/app/api/student-portal/auth/session/route';

export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const studentId = session.studentId;

    // 1. Student info + batch + course
    const [studentRows] = await pool.query<any[]>(
      `SELECT s.Student_Id, s.Student_Name, s.Email, s.Present_Mobile,
              s.Batch_Code, s.Course_Id, s.Percentage, s.Status_id,
              c.Course_Name,
              b.Batch_Id, b.Batch_code, b.Category, b.Timings, b.SDate, b.EDate,
              b.No_of_Lectures, b.AttendWtg, b.AssignWtg, b.ExamWtg, b.UnitTestWtg
       FROM student_master s
       LEFT JOIN course_mst c ON s.Course_Id = c.Course_Id
       LEFT JOIN batch_mst b ON b.Batch_code = s.Batch_Code AND b.Course_Id = s.Course_Id
       WHERE s.Student_Id = ?`,
      [studentId]
    );
    const student = studentRows[0] || null;
    const batchId = student?.Batch_Id ?? null;

    // 2. Attendance summary: total lectures in batch vs attended
    let attendanceSummary = { total_lectures: 0, attended: 0, absent: 0, percentage: 0 };
    let recentLectures: any[] = [];

    if (batchId) {
      // Total lectures taken for this batch
      const [totalRows] = await pool.query<any[]>(
        `SELECT COUNT(*) as total FROM lecture_taken_master
         WHERE Batch_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
        [batchId]
      );
      const totalLectures = totalRows[0]?.total ?? 0;

      // Lectures this student attended
      const [attendedRows] = await pool.query<any[]>(
        `SELECT COUNT(*) as attended FROM lecture_taken_child ltc
         INNER JOIN lecture_taken_master ltm ON ltc.Take_Id = ltm.Take_Id
         WHERE ltm.Batch_Id = ? AND ltc.Student_Id = ?
           AND ltc.Student_Atten = 1
           AND (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)`,
        [batchId, studentId]
      );
      const attended = attendedRows[0]?.attended ?? 0;
      const absent = totalLectures - attended;
      const percentage = totalLectures > 0 ? Math.round((attended / totalLectures) * 100) : 0;
      attendanceSummary = { total_lectures: totalLectures, attended, absent, percentage };

      // Recent 10 lectures with attendance status
      const [recentRows] = await pool.query<any[]>(
        `SELECT ltm.Take_Id, ltm.Take_Dt, ltm.Topic, ltm.Faculty_Id,
                f.Faculty_Name,
                COALESCE(ltc.Student_Atten, 0) as present,
                ltc.Student_Reaction, ltc.Late
         FROM lecture_taken_master ltm
         LEFT JOIN lecture_taken_child ltc ON ltm.Take_Id = ltc.Take_Id AND ltc.Student_Id = ?
         LEFT JOIN faculty_master f ON ltm.Faculty_Id = f.Faculty_Id
         WHERE ltm.Batch_Id = ? AND (ltm.IsDelete = 0 OR ltm.IsDelete IS NULL)
         ORDER BY ltm.Take_Dt DESC, ltm.Take_Id DESC
         LIMIT 10`,
        [studentId, batchId]
      );
      recentLectures = recentRows;
    }

    // 3. Upcoming lectures from batch_lecture_master
    let upcomingLectures: any[] = [];
    if (batchId) {
      const [upcoming] = await pool.query<any[]>(
        `SELECT id, lecture_no, subject_topic, subject, faculty_name, date,
                starttime, endtime, duration, class_room, assignment, unit_test
         FROM batch_lecture_master
         WHERE batch_id = ? AND (deleted = '0' OR deleted IS NULL)
           AND (date IS NULL OR date >= CURDATE())
         ORDER BY lecture_no ASC
         LIMIT 5`,
        [batchId]
      );
      upcomingLectures = upcoming;
    }

    // 4. Final exam / results
    let examResults: any[] = [];
    if (batchId) {
      const [exams] = await pool.query<any[]>(
        `SELECT Take_Id, Test_Dt, Test_No, Marks
         FROM final_exam_master
         WHERE Batch_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY Test_Dt DESC
         LIMIT 5`,
        [batchId]
      );
      examResults = exams;
    }

    // 5. Assignment summary
    let assignmentsSummary = { total_given: 0, received: 0, pending: 0, percentage: 0 };
    let recentAssignments: any[] = [];
    if (batchId) {
      // Total assignments given in the batch
      const [assignGivenRows] = await pool.query<any[]>(
        `SELECT COUNT(*) as total FROM lecture_taken_master
         WHERE Batch_Id = ? AND Assign_Given = 1
           AND (IsDelete = 0 OR IsDelete IS NULL)`,
        [batchId]
      );
      const totalGiven = assignGivenRows[0]?.total ?? 0;

      // Assignments received by this student
      const [assignReceivedRows] = await pool.query<any[]>(
        `SELECT COUNT(*) as received FROM lecture_taken_child ltc
         INNER JOIN lecture_taken_master ltm ON ltc.Take_Id = ltm.Take_Id
         WHERE ltm.Batch_Id = ? AND ltc.Student_Id = ?
           AND ltm.Assign_Given = 1 AND ltc.AssignmentReceived = 1
           AND (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)
           AND (ltm.IsDelete = 0 OR ltm.IsDelete IS NULL)`,
        [batchId, studentId]
      );
      const received = assignReceivedRows[0]?.received ?? 0;
      const pending = totalGiven - received;
      const pct = totalGiven > 0 ? Math.round((received / totalGiven) * 100) : 0;
      assignmentsSummary = { total_given: totalGiven, received, pending, percentage: pct };

      // Recent 5 assignments with status
      const [recentAssign] = await pool.query<any[]>(
        `SELECT ltm.Take_Id, ltm.Take_Dt, ltm.Topic, f.Faculty_Name,
                COALESCE(ltc.AssignmentReceived, 0) as received
         FROM lecture_taken_master ltm
         LEFT JOIN lecture_taken_child ltc ON ltm.Take_Id = ltc.Take_Id AND ltc.Student_Id = ?
         LEFT JOIN faculty_master f ON ltm.Faculty_Id = f.Faculty_Id
         WHERE ltm.Batch_Id = ? AND ltm.Assign_Given = 1
           AND (ltm.IsDelete = 0 OR ltm.IsDelete IS NULL)
         ORDER BY ltm.Take_Dt DESC
         LIMIT 5`,
        [studentId, batchId]
      );
      recentAssignments = recentAssign;
    }

    // 6. All lectures list (for full attendance view) - limited to 50
    let allLectures: any[] = [];
    if (batchId) {
      const [allRows] = await pool.query<any[]>(
        `SELECT ltm.Take_Id, ltm.Take_Dt, ltm.Topic, f.Faculty_Name,
                COALESCE(ltc.Student_Atten, 0) as present,
                ltc.Late
         FROM lecture_taken_master ltm
         LEFT JOIN lecture_taken_child ltc ON ltm.Take_Id = ltc.Take_Id AND ltc.Student_Id = ?
         LEFT JOIN faculty_master f ON ltm.Faculty_Id = f.Faculty_Id
         WHERE ltm.Batch_Id = ? AND (ltm.IsDelete = 0 OR ltm.IsDelete IS NULL)
         ORDER BY ltm.Take_Dt DESC, ltm.Take_Id DESC
         LIMIT 50`,
        [studentId, batchId]
      );
      allLectures = allRows;
    }

    return NextResponse.json({
      student: {
        student_id: student?.Student_Id,
        student_name: student?.Student_Name,
        email: student?.Email,
        mobile: student?.Present_Mobile,
        course_name: student?.Course_Name ?? 'N/A',
        batch_code: student?.Batch_Code ?? 'N/A',
        batch_timings: student?.Timings ?? '',
        batch_start: student?.SDate ?? '',
        batch_end: student?.EDate ?? '',
        percentage: student?.Percentage ?? '',
      },
      attendance: attendanceSummary,
      assignments: assignmentsSummary,
      recent_assignments: recentAssignments,
      recent_lectures: recentLectures,
      all_lectures: allLectures,
      upcoming_lectures: upcomingLectures,
      exam_results: examResults,
      weights: {
        attend: student?.AttendWtg ?? 0,
        assign: student?.AssignWtg ?? 0,
        exam: student?.ExamWtg ?? 0,
        unit_test: student?.UnitTestWtg ?? 0,
      },
    });
  } catch (err: unknown) {
    console.error('Academics API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
