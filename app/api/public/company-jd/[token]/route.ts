/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

// Public route — no auth required.
// Company uses a unique token link to submit a JD.

// GET — verify token + return basic info
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const pool = getPool();
    const { token } = await params;

    const [rows] = await pool.query<any[]>(
      `SELECT Job_Id, Company_Name, Company_Email, Status
       FROM placement_jobs
       WHERE Token = ? AND IsDelete = 0`,
      [token]
    );

    if (!rows.length) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    const job = rows[0];
    // If job already has content, company already submitted
    const alreadySubmitted = !!job.Status && job.Status !== 'Open';

    return NextResponse.json({
      valid: true,
      alreadySubmitted: job.Job_Id ? false : alreadySubmitted, // always allow updates
      Company_Name: job.Company_Name,
      Company_Email: job.Company_Email,
    });
  } catch (err: unknown) {
    console.error('Company JD GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST — company submits JD
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const pool = getPool();
    const { token } = await params;
    const body = await req.json();

    // Verify token
    const [rows] = await pool.query<any[]>(
      `SELECT Job_Id FROM placement_jobs WHERE Token = ? AND IsDelete = 0`,
      [token]
    );
    if (!rows.length) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    const jobId = rows[0].Job_Id;

    await pool.query(
      `UPDATE placement_jobs SET
         Job_Title = ?, Job_Description = ?, Requirements = ?,
         Location = ?, Package = ?, Min_Percentage = ?,
         Max_Backlogs = ?, Application_Deadline = ?
       WHERE Job_Id = ?`,
      [
        body.Job_Title || null,
        body.Job_Description || null,
        body.Requirements || null,
        body.Location || null,
        body.Package || null,
        body.Min_Percentage ? parseFloat(body.Min_Percentage) : 0,
        body.Max_Backlogs ? parseInt(body.Max_Backlogs) : 0,
        body.Application_Deadline || null,
        jobId,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Company JD POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
