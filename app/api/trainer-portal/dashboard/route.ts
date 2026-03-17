/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getTrainerSession } from '@/app/api/trainer-portal/auth/session/route';

/* GET — Dashboard overview for the trainer */
export async function GET(req: NextRequest) {
  try {
    const session = await getTrainerSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const facultyId = session.facultyId;

    // Faculty info
    const [fRows] = await pool.query<any[]>(
      `SELECT Faculty_Id, Faculty_Name, EMail, Mobile, Specialization, Faculty_Type
       FROM faculty_master WHERE Faculty_Id = ?`,
      [facultyId]
    );
    const faculty = fRows[0] || null;

    // Current batches assigned to this faculty (from lecture_taken_master)
    const [batchRows] = await pool.query<any[]>(
      `SELECT DISTINCT ltm.Batch_Id, b.Batch_code, c.Course_Name, b.Category,
              b.SDate, b.EDate, b.No_of_Lectures
       FROM lecture_taken_master ltm
       JOIN batch_mst b ON ltm.Batch_Id = b.Batch_Id
       LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
       WHERE ltm.Faculty_Id = ? AND (ltm.IsDelete = 0 OR ltm.IsDelete IS NULL)
         AND (b.Cancel = 0 OR b.Cancel IS NULL)
       ORDER BY b.Batch_Id DESC
       LIMIT 10`,
      [facultyId]
    );

    // Total lectures taken
    const [lectureCountRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as total FROM lecture_taken_master
       WHERE Faculty_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [facultyId]
    );
    const totalLectures = lectureCountRows[0]?.total ?? 0;

    // Recent 5 lectures
    const [recentLectures] = await pool.query<any[]>(
      `SELECT ltm.Take_Id, ltm.Take_Dt, ltm.Topic, ltm.Lecture_Name, ltm.Duration,
              ltm.ClassRoom, ltm.Faculty_Start, ltm.Faculty_End,
              b.Batch_code, c.Course_Name,
              (SELECT COUNT(*) FROM lecture_taken_child ltc
               WHERE ltc.Take_Id = ltm.Take_Id AND ltc.Student_Atten = 1
               AND (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)) as students_present
       FROM lecture_taken_master ltm
       LEFT JOIN batch_mst b ON ltm.Batch_Id = b.Batch_Id
       LEFT JOIN course_mst c ON ltm.Course_Id = c.Course_Id
       WHERE ltm.Faculty_Id = ? AND (ltm.IsDelete = 0 OR ltm.IsDelete IS NULL)
       ORDER BY ltm.Take_Dt DESC, ltm.Take_Id DESC
       LIMIT 5`,
      [facultyId]
    );

    // Attendance this month
    const [attendanceRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as total FROM trainer_attendance
       WHERE Faculty_Id = ? AND MONTH(Attend_Date) = MONTH(CURDATE()) AND YEAR(Attend_Date) = YEAR(CURDATE())`,
      [facultyId]
    );
    const thisMonthAttendance = attendanceRows[0]?.total ?? 0;

    // Today's attendance status
    const [todayAtt] = await pool.query<any[]>(
      `SELECT * FROM trainer_attendance WHERE Faculty_Id = ? AND Attend_Date = CURDATE()`,
      [facultyId]
    );

    return NextResponse.json({
      faculty: {
        id: faculty?.Faculty_Id,
        name: faculty?.Faculty_Name,
        email: faculty?.EMail,
        mobile: faculty?.Mobile,
        specialization: faculty?.Specialization,
        type: faculty?.Faculty_Type,
      },
      batches: batchRows,
      total_lectures: totalLectures,
      recent_lectures: recentLectures,
      this_month_attendance: thisMonthAttendance,
      today_attendance: todayAtt.length > 0 ? todayAtt[0] : null,
    });
  } catch (err: unknown) {
    console.error('Trainer dashboard error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
