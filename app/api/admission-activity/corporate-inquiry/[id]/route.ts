/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

// GET - fetch single corporate inquiry by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool = getPool();

    const [rows] = await pool.query<any[]>(
      `SELECT Id, Fname, Lname, MName, FullName, CompanyName, Designation,
              Address, City, State, Country, Pin, Phone, Mobile, Email,
              Course_Id, Place, business, Remark, Idate, IsActive
       FROM corporate_inquiry 
       WHERE Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    // Get courses for dropdown
    const [courses] = await pool.query<any[]>(`
      SELECT Course_Id, Course_Name FROM course_mst 
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
      ORDER BY Course_Name
    `);

    return NextResponse.json({ inquiry: rows[0], courses });
  } catch (err: unknown) {
    console.error('Corporate Inquiry GET by ID error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
