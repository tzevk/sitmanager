/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// GET — list applicants for a job with screening info
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const auth = await requirePermission(req, 'placement.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { jobId } = await params;

    // Get job details + eligibility criteria
    const [jobRows] = await pool.query<any[]>(
      `SELECT * FROM placement_jobs WHERE Job_Id = ? AND IsDelete = 0`,
      [jobId]
    );
    if (!jobRows.length) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    const job = jobRows[0];

    const statusFilter = req.nextUrl.searchParams.get('status') || '';

    const conditions = ['a.Job_Id = ?', 'a.IsDelete = 0'];
    const qParams: any[] = [jobId];

    if (statusFilter) {
      conditions.push('a.Status = ?');
      qParams.push(statusFilter);
    }

    const [applicants] = await pool.query<any[]>(
      `SELECT
         a.Application_Id, a.Status AS App_Status, a.Applied_Date, a.CV_Path,
         a.Cover_Letter, a.Remarks, a.Screened_By, a.Screened_Date,
         s.Student_Id, s.Student_Name, s.Email, s.Present_Mobile, s.Percentage,
         s.Qualification, s.Course_Id, s.Discipline,
         c.Course_Name, b.Batch_code
       FROM placement_applications a
       LEFT JOIN student_master s ON a.Student_Id = s.Student_Id
       LEFT JOIN course_mst c ON s.Course_Id = c.Course_Id
       LEFT JOIN admission_master am ON s.Student_Id = am.Student_Id AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
       LEFT JOIN batch_mst b ON am.Batch_Id = b.Batch_Id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.Applied_Date DESC`,
      qParams
    );

    return NextResponse.json({ job, applicants });
  } catch (err: unknown) {
    console.error('Screening GET error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

// PUT — bulk update application statuses (screening action)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const auth = await requirePermission(req, 'placement.update');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { jobId } = await params;
    const body = await req.json();

    // body.applications = [{ Application_Id, Status, Remarks }]
    const { applications } = body;
    if (!Array.isArray(applications) || !applications.length) {
      return NextResponse.json({ error: 'No applications provided' }, { status: 400 });
    }

    const userId = (auth as any).userId || null;

    for (const app of applications) {
      await pool.query(
        `UPDATE placement_applications SET
           Status = ?, Remarks = ?, Screened_By = ?, Screened_Date = NOW()
         WHERE Application_Id = ? AND Job_Id = ? AND IsDelete = 0`,
        [app.Status, app.Remarks || null, userId, app.Application_Id, jobId]
      );
    }

    return NextResponse.json({ success: true, updated: applications.length });
  } catch (err: unknown) {
    console.error('Screening PUT error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
