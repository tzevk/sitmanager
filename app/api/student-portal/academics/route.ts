/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getStudentSession } from '@/app/api/student-portal/auth/session/route';

let attendanceTableReady = false;
async function ensureStudentAttendanceTable(pool: any) {
  if (attendanceTableReady) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_attendance (
        Attendance_Id INT AUTO_INCREMENT PRIMARY KEY,
        Batch_Id      INT      NOT NULL,
        Student_Id    INT      NOT NULL,
        Admission_Id  INT      NOT NULL,
        Attendance_Date DATE   NOT NULL,
        Session       ENUM('first_half','second_half') NOT NULL DEFAULT 'first_half',
        Status        CHAR(1)  NOT NULL DEFAULT 'P',
        Remarks       VARCHAR(255) NULL,
        Created_At    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        Updated_At    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        IsDelete      TINYINT(1) DEFAULT 0,
        UNIQUE KEY uq_attendance (Batch_Id, Student_Id, Attendance_Date, Session)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    attendanceTableReady = true;
  } catch {
    attendanceTableReady = true;
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    await ensureStudentAttendanceTable(pool);
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

    // 1b. Trainer schedule snapshot (prefer today's/next schedule; fallback to latest)
    let trainerSchedule: {
      trainer_name: string | null;
      trainer_time_from: string | null;
      trainer_time_to: string | null;
      trainer_link: string | null;
    } = {
      trainer_name: null,
      trainer_time_from: null,
      trainer_time_to: null,
      trainer_link: null,
    };

    if (batchId) {
      const [trainerRows] = await pool.query<any[]>(
        `SELECT faculty_name, starttime, endtime, class_room, date
         FROM batch_lecture_master
         WHERE batch_id = ?
           AND (deleted = '0' OR deleted IS NULL)
         ORDER BY
           CASE
             WHEN date = CURDATE() THEN 0
             WHEN date > CURDATE() THEN 1
             ELSE 2
           END,
           CASE WHEN date >= CURDATE() THEN date END ASC,
           CASE WHEN date < CURDATE() THEN date END DESC,
           id DESC
         LIMIT 1`,
        [batchId]
      );

      const trainer = trainerRows[0] || null;
      if (trainer) {
        trainerSchedule = {
          trainer_name: trainer.faculty_name ? String(trainer.faculty_name) : null,
          trainer_time_from: trainer.starttime ? String(trainer.starttime) : null,
          trainer_time_to: trainer.endtime ? String(trainer.endtime) : null,
          trainer_link: trainer.class_room ? String(trainer.class_room).trim() : null,
        };
      }
    }

    // 2. Attendance summary: based on daily attendance marks (first/second half)
    let attendanceSummary = { total_lectures: 0, attended: 0, absent: 0, percentage: 0 };
    let recentLectures: any[] = [];

    if (batchId) {
      const [attendanceRows] = await pool.query<any[]>(
        `SELECT Attendance_Id, Attendance_Date, Session, Status
         FROM student_attendance
         WHERE Batch_Id = ? AND Student_Id = ?
           AND (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY Attendance_Date DESC,
           CASE WHEN Session = 'second_half' THEN 1 ELSE 0 END DESC,
           Attendance_Id DESC`,
        [batchId, studentId]
      );

      const totalSessions = attendanceRows.length;
      const attended = attendanceRows.filter((r: any) => r.Status === 'P').length;
      const absent = attendanceRows.filter((r: any) => r.Status === 'A').length;
      const percentage = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;
      attendanceSummary = { total_lectures: totalSessions, attended, absent, percentage };

      recentLectures = attendanceRows.slice(0, 10).map((r: any) => ({
        Take_Id: r.Attendance_Id,
        Take_Dt: r.Attendance_Date,
        Topic: r.Session === 'second_half' ? 'Second Half' : 'First Half',
        Faculty_Name: '',
        present: r.Status === 'P' ? 1 : 0,
        Late: 0,
        session: r.Session,
      }));
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

    // 6. All attendance records list (for full attendance view) - limited to 100
    let allLectures: any[] = [];
    if (batchId) {
      const [allRows] = await pool.query<any[]>(
        `SELECT Attendance_Id, Attendance_Date, Session, Status
         FROM student_attendance
         WHERE Batch_Id = ? AND Student_Id = ?
           AND (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY Attendance_Date DESC,
           CASE WHEN Session = 'second_half' THEN 1 ELSE 0 END DESC,
           Attendance_Id DESC
         LIMIT 100`,
        [batchId, studentId]
      );
      allLectures = (allRows as any[]).map((r: any) => ({
        Take_Id: r.Attendance_Id,
        Take_Dt: r.Attendance_Date,
        Topic: r.Session === 'second_half' ? 'Second Half' : 'First Half',
        Faculty_Name: '',
        present: r.Status === 'P' ? 1 : 0,
        Late: 0,
        session: r.Session,
      }));
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
        trainer_name: trainerSchedule.trainer_name,
        trainer_time_from: trainerSchedule.trainer_time_from,
        trainer_time_to: trainerSchedule.trainer_time_to,
        trainer_link: trainerSchedule.trainer_link,
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
