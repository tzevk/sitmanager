/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { getSession } from '@/lib/session';

// GET - list follow-ups for a consultancy
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const constId = searchParams.get('constId');
    const search = searchParams.get('search')?.trim() || '';

    if (!constId) return NextResponse.json({ error: 'constId is required' }, { status: 400 });

    // Ensure table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS consultant_followup (
        Followup_Id INT AUTO_INCREMENT PRIMARY KEY,
        Const_Id INT NOT NULL,
        Followup_Date DATE,
        Contact_Person VARCHAR(255),
        Designation VARCHAR(255),
        Mobile VARCHAR(50),
        email VARCHAR(255),
        Purpose VARCHAR(255),
        Course VARCHAR(255),
        Direct_Line VARCHAR(100),
        Remarks TEXT,
        Added_By INT,
        IsDelete TINYINT DEFAULT 0,
        Date_Added DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_const_id (Const_Id)
      )
    `);

    let where = 'f.Const_Id = ? AND (f.IsDelete = 0 OR f.IsDelete IS NULL)';
    const params: any[] = [constId];

    if (search) {
      where += ` AND (f.Contact_Person LIKE ? OR f.Purpose LIKE ? OR f.Remarks LIKE ? OR f.Course LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.query<any[]>(
      `SELECT f.Followup_Id, f.Const_Id, f.Followup_Date, f.Contact_Person, f.Designation,
              f.Mobile, f.email, f.Purpose, f.Course, f.Direct_Line, f.Remarks, f.Added_By,
              COALESCE(u.firstname, '') as added_by_name
       FROM consultant_followup f
       LEFT JOIN awt_adminuser u ON f.Added_By = u.id
       WHERE ${where}
       ORDER BY f.Followup_Id DESC`,
      params
    );

    return NextResponse.json({ rows });
  } catch (err: unknown) {
    console.error('Consultancy followups GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - add follow-up
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.create');
    if (auth instanceof NextResponse) return auth;
    const session = await getSession(req);
    const pool = getPool();
    const body = await req.json();

    const { constId, Followup_Date, Contact_Person, Designation, Mobile, email, Purpose, Course, Direct_Line, Remarks } = body;
    if (!constId) return NextResponse.json({ error: 'constId is required' }, { status: 400 });

    // Ensure table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS consultant_followup (
        Followup_Id INT AUTO_INCREMENT PRIMARY KEY,
        Const_Id INT NOT NULL,
        Followup_Date DATE,
        Contact_Person VARCHAR(255),
        Designation VARCHAR(255),
        Mobile VARCHAR(50),
        email VARCHAR(255),
        Purpose VARCHAR(255),
        Course VARCHAR(255),
        Direct_Line VARCHAR(100),
        Remarks TEXT,
        Added_By INT,
        IsDelete TINYINT DEFAULT 0,
        Date_Added DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_const_id (Const_Id)
      )
    `);

    await pool.query(
      `INSERT INTO consultant_followup (Const_Id, Followup_Date, Contact_Person, Designation, Mobile, email, Purpose, Course, Direct_Line, Remarks, Added_By)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [constId, Followup_Date || null, Contact_Person || null, Designation || null,
       Mobile || null, email || null, Purpose || null, Course || null, Direct_Line || null,
       Remarks || null, session?.userId || null]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Consultancy followups POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete follow-up
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    await pool.query(`UPDATE consultant_followup SET IsDelete = 1 WHERE Followup_Id = ?`, [id]);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Consultancy followups DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
