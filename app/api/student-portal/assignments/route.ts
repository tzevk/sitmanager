import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getStudentSession } from '@/app/api/student-portal/auth/session/route';
import { getStudentPortalContext } from '@/lib/student-portal/context';
import { getStudentAcademicRecords, toStudentView } from '@/lib/student-portal/academic-records';

/**
 * The student's assignments, from the Assignments module (assignment_taken +
 * assignment_given_child) via the shared academic-records contract.
 *
 * Previously this listed lectures flagged Assign_Given (never set, so always
 * empty), read marks from a column that doesn't exist (agc.Marks — the real
 * column is Marks_Given), and found the batch from student_master.Batch_Code.
 *
 * Marks are only shown once published (not built yet), so `marks` is empty and
 * `records` carries RESULT_PENDING for anything evaluated.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const ctx = await getStudentPortalContext(pool, Number(session.studentId));
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const all = await getStudentAcademicRecords(pool, ctx, ['ASSIGNMENT']);
    const totalGiven = all.length;
    const received = all.filter((r) => r.status === 'EVALUATED').length;

    // Existing page contract (list + "Done/Pending"); no marks in it.
    const assignments = [...all]
      .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
      .map((r) => ({
        Take_Id: r.parentId,
        Take_Dt: r.date,
        Topic: r.assessmentName,
        Lecture_Name: r.assessmentName,
        Duration: null,
        ClassRoom: null,
        Faculty_Name: null,
        received: r.status === 'EVALUATED' ? 1 : 0,
        // Attendance on the assignment date, kept separate from the record's status.
        was_present: r.absentOnLectureDate === null ? null : r.absentOnLectureDate ? 0 : 1,
      }));

    const records = all.map(toStudentView);
    const marks = records
      .filter((r) => r.published && r.marksObtained !== null)
      .map((r) => ({
        Marks: r.marksObtained,
        MaxMarks: r.maxMarks,
        Assign_Dt: r.date,
        assignmentname: r.assessmentName,
        subjects: null,
      }));

    return NextResponse.json({
      summary: {
        total_given: totalGiven,
        received,
        pending: totalGiven - received,
        percentage: totalGiven > 0 ? Math.round((received / totalGiven) * 100) : 0,
      },
      assignments,
      marks,
      records,
    });
  } catch (err: unknown) {
    console.error('Student assignments API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
