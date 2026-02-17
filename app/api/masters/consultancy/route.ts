import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT 
        Const_Id,
        Comp_Name,
        Contact_Person,
        Designation,
        Address,
        City,
        State,
        Pin,
        Tel
      FROM consultant_mst
      WHERE IsDelete = 0 AND IsActive = 1
      ORDER BY Comp_Name ASC
    `);
    return NextResponse.json({ rows });
  } catch (error) {
    console.error('Error fetching consultancy companies:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
}
