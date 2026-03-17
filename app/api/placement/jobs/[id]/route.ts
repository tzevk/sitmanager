/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// GET — single job with applicants summary
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'placement.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { id } = await params;

    const [rows] = await pool.query<any[]>(
      `SELECT * FROM placement_jobs WHERE Job_Id = ? AND IsDelete = 0`,
      [id]
    );
    if (!rows.length) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Application counts by status
    const [stats] = await pool.query<any[]>(
      `SELECT Status, COUNT(*) as cnt
       FROM placement_applications
       WHERE Job_Id = ? AND IsDelete = 0
       GROUP BY Status`,
      [id]
    );

    // Courses / batches for filter dropdowns
    const [courses] = await pool.query<any[]>(
      `SELECT Course_Id, Course_Name FROM course_mst WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Course_Name`
    );
    const [batches] = await pool.query<any[]>(
      `SELECT Batch_Id, Batch_code, Course_Id FROM batch_mst WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Batch_code DESC`
    );

    return NextResponse.json({ job: rows[0], stats, courses, batches });
  } catch (err: unknown) {
    console.error('Placement job GET error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

// PUT — update job
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'placement.update');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { id } = await params;
    const body = await req.json();

    await pool.query(
      `UPDATE placement_jobs SET
         Company_Name = ?, Company_Email = ?, Job_Title = ?, Job_Description = ?,
         Requirements = ?, Location = ?, Package = ?, Min_Percentage = ?,
         Eligible_Courses = ?, Eligible_Batches = ?, Max_Backlogs = ?,
         Application_Deadline = ?, Status = ?
       WHERE Job_Id = ? AND IsDelete = 0`,
      [
        body.Company_Name || null,
        body.Company_Email || null,
        body.Job_Title || null,
        body.Job_Description || null,
        body.Requirements || null,
        body.Location || null,
        body.Package || null,
        body.Min_Percentage ? parseFloat(body.Min_Percentage) : 0,
        body.Eligible_Courses || null,
        body.Eligible_Batches || null,
        body.Max_Backlogs ? parseInt(body.Max_Backlogs) : 0,
        body.Application_Deadline || null,
        body.Status || 'Open',
        id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Placement job PUT error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

// DELETE — soft delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'placement.delete');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { id } = await params;

    await pool.query(`UPDATE placement_jobs SET IsDelete = 1 WHERE Job_Id = ?`, [id]);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Placement job DELETE error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
