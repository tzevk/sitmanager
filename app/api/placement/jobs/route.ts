/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import crypto from 'crypto';

// GET — list placement jobs
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'placement.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const url = req.nextUrl;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || '';

    const conditions: string[] = ['j.IsDelete = 0'];
    const params: any[] = [];

    if (search) {
      conditions.push('(j.Company_Name LIKE ? OR j.Job_Title LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status) {
      conditions.push('j.Status = ?');
      params.push(status);
    }

    const where = conditions.join(' AND ');

    const [countRows] = await pool.query<any[]>(
      `SELECT COUNT(*) AS total FROM placement_jobs j WHERE ${where}`,
      params
    );
    const total = countRows[0]?.total ?? 0;

    const [rows] = await pool.query<any[]>(
      `SELECT j.*, 
              (SELECT COUNT(*) FROM placement_applications a WHERE a.Job_Id = j.Job_Id AND a.IsDelete = 0) AS application_count
       FROM placement_jobs j
       WHERE ${where}
       ORDER BY j.Created_Date DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({ rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err: unknown) {
    console.error('Placement jobs GET error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

// POST — create new job posting
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'placement.create');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const body = await req.json();

    const token = crypto.randomBytes(32).toString('hex');

    const [result] = await pool.query(
      `INSERT INTO placement_jobs
         (Company_Name, Company_Email, Job_Title, Job_Description, Requirements,
          Location, Package, Min_Percentage, Eligible_Courses, Eligible_Batches,
          Max_Backlogs, Application_Deadline, Status, Token, Created_By)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?)`,
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
        token,
        (auth as any).userId || null,
      ]
    );

    const jobId = (result as any).insertId;

    return NextResponse.json({ success: true, Job_Id: jobId, token });
  } catch (err: unknown) {
    console.error('Placement jobs POST error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
