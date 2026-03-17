/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getStudentSession } from '@/app/api/student-portal/auth/session/route';

// GET — student's applications list
export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();

    const [rows] = await pool.query<any[]>(
      `SELECT a.*, j.Job_Title, j.Company_Name, j.Location, j.Package, j.Status AS Job_Status
       FROM placement_applications a
       JOIN placement_jobs j ON a.Job_Id = j.Job_Id
       WHERE a.Student_Id = ? AND a.IsDelete = 0
       ORDER BY a.Applied_Date DESC`,
      [session.studentId]
    );

    return NextResponse.json({ applications: rows });
  } catch (err: unknown) {
    console.error('Student applications GET error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

// POST — apply to a job
export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const body = await req.json();
    const { Job_Id, CV_Id, Cover_Letter } = body;

    if (!Job_Id) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Verify job exists and is open
    const [jobRows] = await pool.query<any[]>(
      `SELECT * FROM placement_jobs WHERE Job_Id = ? AND IsDelete = 0 AND Status = 'Open'`,
      [Job_Id]
    );
    if (!jobRows.length) {
      return NextResponse.json({ error: 'Job is not available' }, { status: 400 });
    }

    const job = jobRows[0];

    // Check deadline
    if (job.Application_Deadline && new Date(job.Application_Deadline) < new Date()) {
      return NextResponse.json({ error: 'Application deadline has passed' }, { status: 400 });
    }

    // Check if already applied
    const [existing] = await pool.query<any[]>(
      `SELECT Application_Id FROM placement_applications WHERE Job_Id = ? AND Student_Id = ? AND IsDelete = 0`,
      [Job_Id, session.studentId]
    );
    if (existing.length) {
      return NextResponse.json({ error: 'You have already applied to this job' }, { status: 400 });
    }

    // Eligibility check
    const [studentRows] = await pool.query<any[]>(
      `SELECT s.*, am.Batch_Id
       FROM student_master s
       LEFT JOIN admission_master am ON s.Student_Id = am.Student_Id AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
       WHERE s.Student_Id = ?`,
      [session.studentId]
    );
    const student = studentRows[0];

    if (job.Min_Percentage > 0 && student.Percentage != null) {
      if (parseFloat(student.Percentage) < parseFloat(job.Min_Percentage)) {
        return NextResponse.json({ error: `Minimum ${job.Min_Percentage}% required` }, { status: 400 });
      }
    }
    if (job.Eligible_Courses) {
      const courseIds = job.Eligible_Courses.split(',').map((c: string) => c.trim());
      if (student.Course_Id && !courseIds.includes(String(student.Course_Id))) {
        return NextResponse.json({ error: 'Your course is not eligible' }, { status: 400 });
      }
    }

    // Get CV path
    let cvPath: string | null = null;
    if (CV_Id) {
      const [cvRows] = await pool.query<any[]>(
        `SELECT CV_Path FROM student_cvs WHERE CV_Id = ? AND Student_Id = ? AND IsDelete = 0`,
        [CV_Id, session.studentId]
      );
      cvPath = cvRows[0]?.CV_Path || null;
    }

    await pool.query(
      `INSERT INTO placement_applications (Job_Id, Student_Id, CV_Path, Cover_Letter, Status)
       VALUES (?, ?, ?, ?, 'Applied')`,
      [Job_Id, session.studentId, cvPath, Cover_Letter || null]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Student applications POST error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
