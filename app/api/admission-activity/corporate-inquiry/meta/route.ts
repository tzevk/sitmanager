/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, [
      'corporate_inquiry.view',
      'corporate_inquiry.create',
      'corporate_inquiry.update',
    ]);
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();

    const [courses] = await pool.query<any[]>(`
      SELECT Course_Id, Course_Name
      FROM course_mst
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
      ORDER BY Course_Name
    `);

    const [consultancies] = await pool.query<any[]>(`
      SELECT Const_Id, Comp_Name, Contact_Person, Designation, Mobile, EMail
      FROM consultant_mst
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
      ORDER BY Comp_Name ASC
      LIMIT 500
    `);

    return NextResponse.json({ courses, consultancies });
  } catch (err: unknown) {
    console.error('Corporate Inquiry meta GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
