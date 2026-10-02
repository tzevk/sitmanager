/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getStudentSession } from '@/app/api/student-portal/auth/session/route';
import { isReExamSitting, recordedAttempt } from '@/lib/final-exam-attempt';
import { hasFinalExamAttemptColumn } from '@/lib/final-exam-attempt-schema';
import { getStudentPortalContext } from '@/lib/student-portal/context';
import { getAcademicAttendance } from '@/lib/student-portal/academic-attendance';
import { getStudentAcademicRecords } from '@/lib/student-portal/academic-records';

// Read-only endpoint: it no longer creates tables or columns. Academic
// attendance comes from lecture_taken_child (lib/student-portal/academic-
// attendance.ts) — student_attendance is daily/biometric attendance and is not
// part of these figures.
export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const ctx = await getStudentPortalContext(pool, Number(session.studentId));
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const batchId = ctx.batchId;

    // 1b. Trainer schedule snapshot (prefer today's/next schedule; fallback to latest)
    let trainerSchedule: {
      trainer_name: string | null;
      trainer_time_from: string | null;
      trainer_time_to: string | null;
      trainer_link: string | null;
      trainer_date: string | null;
    } = {
      trainer_name: null,
      trainer_time_from: null,
      trainer_time_to: null,
      trainer_link: null,
      trainer_date: null,
    };

    if (batchId) {
      const [trainerRows] = await pool.query<any[]>(
        `SELECT s.faculty_name, s.starttime, s.endtime, s.class_room, s.date
         FROM batch_slecture_master s
         LEFT JOIN lecture_taken_master lt
           ON lt.Lecture_Id = s.id AND lt.Batch_Id = s.batch_id AND (lt.IsDelete = 0 OR lt.IsDelete IS NULL)
         WHERE s.batch_id = ?
           AND (s.deleted = '0' OR s.deleted IS NULL)
           AND (s.publish = 'Yes' OR lt.Take_Id IS NOT NULL)
         ORDER BY
           CASE
             WHEN s.date = CURDATE() THEN 0
             WHEN s.date > CURDATE() THEN 1
             ELSE 2
           END,
           CASE WHEN s.date >= CURDATE() THEN s.date END ASC,
           CASE WHEN s.date < CURDATE() THEN s.date END DESC,
           s.id DESC
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
          trainer_date: trainer.date ? String(trainer.date) : null,
        };
      }
    }

    // 2. Academic attendance (lecture_taken_child, same rules as the reports)
    const academicAttendance = await getAcademicAttendance(pool, ctx);
    const { total_lectures, attended, absent, percentage } = academicAttendance.summary;
    const attendanceSummary = { total_lectures, attended, absent, percentage };
    const recentLectures = academicAttendance.lectures.slice(0, 10);
    const allLectures = academicAttendance.lectures.slice(0, 100);

    // 3. Upcoming lectures from batch_slecture_master — the table staff actually
    // maintain via the Batch Master "Lecture Plan" tab (batch_lecture_master is a
    // stale legacy table with heavy duplicate junk data, no longer edited there).
    let upcomingLectures: any[] = [];
    if (batchId) {
      const [upcoming] = await pool.query<any[]>(
        `SELECT s.id, s.lecture_no, s.subject_topic, s.subject, s.faculty_name, s.date,
                s.starttime, s.endtime, s.class_room, s.assignment, s.unit_test, u.utdate AS unit_test_date,
                s.session
         FROM batch_slecture_master s
         LEFT JOIN lecture_taken_master lt
           ON lt.Lecture_Id = s.id AND lt.Batch_Id = s.batch_id AND (lt.IsDelete = 0 OR lt.IsDelete IS NULL)
         LEFT JOIN awt_unittesttaken u ON u.id = CAST(s.unit_test AS UNSIGNED)
         WHERE s.batch_id = ? AND (s.deleted = '0' OR s.deleted IS NULL)
           AND (s.publish = 'Yes' OR lt.Take_Id IS NOT NULL)
           AND (s.date IS NULL OR s.date >= CURDATE())
         ORDER BY s.lecture_no ASC
         LIMIT 5`,
        [batchId]
      );
      upcomingLectures = upcoming;
    }

    // 4. Final exam sittings for the batch — schedule only, NO scores.
    // final_exam_master.Marks is the paper's MAXIMUM marks; obtained marks are
    // not shown until marks publishing exists.
    let finalExams: any[] = [];
    if (batchId) {
      const withAttempt = await hasFinalExamAttemptColumn(pool);
      const [exams] = await pool.query<any[]>(
        `SELECT fem.Take_Id,
                DATE_FORMAT(fem.Test_Dt, '%Y-%m-%d') AS Test_Dt,
                fem.Marks AS Max_Marks,
                ${withAttempt ? 'fem.Attempt_No' : 'NULL AS Attempt_No'},
                (fem.Test_Dt > CURDATE()) AS upcoming,
                (SELECT MAX(bfe.Subject) FROM batch_final_exam bfe WHERE bfe.Exam_Id = fem.Test_Id) AS Subject
         FROM final_exam_master fem
         WHERE fem.Batch_Id = ? AND (fem.IsDelete = 0 OR fem.IsDelete IS NULL)
         ORDER BY fem.Test_Dt DESC
         LIMIT 5`,
        [batchId]
      );
      finalExams = (exams as any[]).map((e) => {
        const attempt = recordedAttempt(e.Attempt_No) ?? (isReExamSitting(null, e.Subject) ? 2 : 1);
        return {
          take_id: e.Take_Id,
          date: e.Test_Dt,
          attempt,
          label: attempt === 1 ? 'Final Exam' : attempt === 2 ? 'Re-Exam (2nd attempt)' : 'Re-Exam (3rd attempt)',
          max_marks: e.Max_Marks != null ? Number(e.Max_Marks) : null,
          status: Number(e.upcoming) === 1 ? 'upcoming' : 'held',
        };
      });
    }

    // 5. Assignment summary — from the Assignments module (assignment_taken /
    // assignment_given_child), the records staff actually keep. The old source,
    // lecture_taken_master.Assign_Given, is never set, so it always showed 0.
    // "Done" = a mark is recorded for the student; no marks are exposed here.
    const assignmentRecords = await getStudentAcademicRecords(pool, ctx, ['ASSIGNMENT']);
    const totalGiven = assignmentRecords.length;
    const received = assignmentRecords.filter((r) => r.status === 'EVALUATED').length;
    const assignmentsSummary = {
      total_given: totalGiven,
      received,
      pending: totalGiven - received,
      percentage: totalGiven > 0 ? Math.round((received / totalGiven) * 100) : 0,
    };
    const recentAssignments = [...assignmentRecords]
      .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
      .slice(0, 5)
      .map((r) => ({
        Take_Id: r.parentId,
        Take_Dt: r.date,
        Topic: r.assessmentName,
        Faculty_Name: '',
        received: r.status === 'EVALUATED' ? 1 : 0,
      }));

    // 7. Fees summary — ledger based: debit = charged, credit = paid, pending = balance.
    //    Mirrors the admin per-student fee page (debit - credit). Student_Id is indexed.
    let feesSummary = { total: 0, paid: 0, pending: 0 };
    let feeLedger: any[] = [];
    try {
      const [feeRows] = await pool.query<any[]>(
        `SELECT
           SUM(CASE WHEN TypeR = 'D' THEN COALESCE(Total_Amt, Amount, 0) ELSE 0 END) AS debit,
           SUM(CASE WHEN TypeR = 'C' THEN COALESCE(Total_Amt, Amount, 0) ELSE 0 END) AS credit
         FROM s_fees_mst
         WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
        [ctx.studentId]
      );
      const debit = Number(feeRows[0]?.debit || 0);
      const credit = Number(feeRows[0]?.credit || 0);
      feesSummary = { total: Math.round(debit), paid: Math.round(credit), pending: Math.round(debit - credit) };

      const [ledgerRows] = await pool.query<any[]>(
        `SELECT Fees_Id, Fees_Code, RDate, Date_Added, Payment_Type, TypeR,
                COALESCE(Total_Amt, Amount, 0) AS Amount, Notes
         FROM s_fees_mst
         WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY COALESCE(RDate, Date_Added) DESC, Fees_Id DESC
         LIMIT 10`,
        [ctx.studentId]
      );
      feeLedger = ledgerRows.map((r: any) => ({
        fees_id: r.Fees_Id,
        receipt_code: r.Fees_Code,
        date: r.RDate ?? r.Date_Added,
        payment_type: r.Payment_Type,
        type: r.TypeR === 'C' ? 'paid' : 'charged',
        amount: Math.round(Number(r.Amount || 0)),
        notes: r.Notes,
      }));
    } catch { /* fees optional — never block the dashboard */ }

    return NextResponse.json({
      fees: feesSummary,
      fee_ledger: feeLedger,
      student: {
        student_id: ctx.studentId,
        student_name: ctx.studentName,
        email: ctx.email,
        mobile: ctx.mobile,
        roll_no: ctx.rollNo,
        course_name: ctx.courseName ?? 'N/A',
        batch_code: ctx.batchCode ?? 'N/A',
        batch_timings: ctx.batchTimings ?? '',
        batch_start: ctx.batchStart ?? '',
        batch_end: ctx.batchEnd ?? '',
        percentage: ctx.percentage ?? '',
        trainer_name: trainerSchedule.trainer_name,
        trainer_time_from: trainerSchedule.trainer_time_from,
        trainer_time_to: trainerSchedule.trainer_time_to,
        trainer_link: trainerSchedule.trainer_link,
        trainer_date: trainerSchedule.trainer_date,
      },
      attendance: attendanceSummary,
      assignments: assignmentsSummary,
      recent_assignments: recentAssignments,
      recent_lectures: recentLectures,
      all_lectures: allLectures,
      upcoming_lectures: upcomingLectures,
      final_exams: finalExams,
      weights: {
        attend: ctx.weights.attend,
        assign: ctx.weights.assign,
        exam: ctx.weights.exam,
        unit_test: ctx.weights.unitTest,
      },
    });
  } catch (err: unknown) {
    console.error('Academics API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
