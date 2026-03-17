/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getStudentSession } from '@/app/api/student-portal/auth/session/route';

// GET — list open jobs visible to the logged-in student (with eligibility check)
export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();

    // Get student details for eligibility check
    const [studentRows] = await pool.query<any[]>(
      `SELECT s.Student_Id, s.Course_Id, s.Percentage, s.Qualification,
              am.Batch_Id
       FROM student_master s
       LEFT JOIN admission_master am ON s.Student_Id = am.Student_Id AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
       WHERE s.Student_Id = ? AND (s.IsDelete = 0 OR s.IsDelete IS NULL)`,
      [session.studentId]
    );

    if (!studentRows.length) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const student = studentRows[0];

    // Get all open jobs
    const [jobs] = await pool.query<any[]>(
      `SELECT j.*,
              (SELECT COUNT(*) FROM placement_applications a WHERE a.Job_Id = j.Job_Id AND a.IsDelete = 0) AS total_applicants
       FROM placement_jobs j
       WHERE j.IsDelete = 0 AND j.IsActive = 1 AND j.Status = 'Open'
         AND (j.Application_Deadline IS NULL OR j.Application_Deadline >= CURDATE())
       ORDER BY j.Created_Date DESC`
    );

    // Check if student already applied
    const [existingApps] = await pool.query<any[]>(
      `SELECT Job_Id, Status FROM placement_applications
       WHERE Student_Id = ? AND IsDelete = 0`,
      [session.studentId]
    );
    const appliedMap: Record<number, string> = {};
    existingApps.forEach((a: any) => { appliedMap[a.Job_Id] = a.Status; });

    // Compute eligibility for each job
    const enriched = jobs.map((job: any) => {
      const eligibility: { eligible: boolean; reasons: string[] } = { eligible: true, reasons: [] };

      // Check minimum percentage
      if (job.Min_Percentage > 0 && student.Percentage != null) {
        if (parseFloat(student.Percentage) < parseFloat(job.Min_Percentage)) {
          eligibility.eligible = false;
          eligibility.reasons.push(`Minimum ${job.Min_Percentage}% required (you have ${student.Percentage}%)`);
        }
      }

      // Check eligible courses
      if (job.Eligible_Courses) {
        const courseIds = job.Eligible_Courses.split(',').map((c: string) => c.trim());
        if (student.Course_Id && !courseIds.includes(String(student.Course_Id))) {
          eligibility.eligible = false;
          eligibility.reasons.push('Your course is not eligible for this position');
        }
      }

      // Check eligible batches
      if (job.Eligible_Batches) {
        const batchIds = job.Eligible_Batches.split(',').map((b: string) => b.trim());
        if (student.Batch_Id && !batchIds.includes(String(student.Batch_Id))) {
          eligibility.eligible = false;
          eligibility.reasons.push('Your batch is not eligible for this position');
        }
      }

      return {
        ...job,
        eligibility,
        applied: appliedMap[job.Job_Id] || null,
      };
    });

    return NextResponse.json({ jobs: enriched, student });
  } catch (err: unknown) {
    console.error('Student jobs GET error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
