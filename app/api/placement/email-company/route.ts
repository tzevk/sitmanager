/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// POST — save email draft (email sending not implemented yet)
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'placement.create');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const body = await req.json();

    const { Company_Email, Company_Name, Subject, Body, Job_Submission_Link } = body;

    if (!Company_Email || !Subject) {
      return NextResponse.json({ error: 'Company email and subject are required' }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO placement_emails
         (Company_Email, Company_Name, Subject, Body, Job_Submission_Link, Status, Created_By)
       VALUES (?, ?, ?, ?, ?, 'Draft', ?)`,
      [
        Company_Email,
        Company_Name || null,
        Subject,
        Body || null,
        Job_Submission_Link || null,
        (auth as any).userId || null,
      ]
    );

    return NextResponse.json({ success: true, Email_Id: (result as any).insertId });
  } catch (err: unknown) {
    console.error('Email company POST error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

// GET — list email drafts
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'placement.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const [rows] = await pool.query<any[]>(
      `SELECT * FROM placement_emails ORDER BY Created_Date DESC LIMIT 50`
    );

    return NextResponse.json({ emails: rows });
  } catch (err: unknown) {
    console.error('Email company GET error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
