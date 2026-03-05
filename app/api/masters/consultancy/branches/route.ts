/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// GET - list branches for a consultancy
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const constId = searchParams.get('constId');
    const search = searchParams.get('search')?.trim() || '';

    if (!constId) return NextResponse.json({ error: 'constId is required' }, { status: 400 });

    let where = 'Const_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)';
    const params: any[] = [constId];

    if (search) {
      where += ` AND (Contact_Person LIKE ? OR Branch_Address LIKE ? OR City LIKE ? OR email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Try to create table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS consultant_branch (
        Branch_Id INT AUTO_INCREMENT PRIMARY KEY,
        Const_Id INT NOT NULL,
        Contact_Person VARCHAR(255),
        Designation VARCHAR(255),
        Branch_Address TEXT,
        City VARCHAR(100),
        Telephone VARCHAR(50),
        Mobile VARCHAR(50),
        email VARCHAR(255),
        IsDelete TINYINT DEFAULT 0,
        Date_Added DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_const_id (Const_Id)
      )
    `);

    const [rows] = await pool.query<any[]>(
      `SELECT Branch_Id, Const_Id, Contact_Person, Designation, Branch_Address, City, Telephone, Mobile, email
       FROM consultant_branch WHERE ${where} ORDER BY Branch_Id DESC`,
      params
    );

    return NextResponse.json({ rows });
  } catch (err: unknown) {
    console.error('Consultancy branches GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - add branch(es)
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();
    const { constId, branches } = body;

    if (!constId || !Array.isArray(branches) || branches.length === 0) {
      return NextResponse.json({ error: 'constId and branches array are required' }, { status: 400 });
    }

    // Ensure table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS consultant_branch (
        Branch_Id INT AUTO_INCREMENT PRIMARY KEY,
        Const_Id INT NOT NULL,
        Contact_Person VARCHAR(255),
        Designation VARCHAR(255),
        Branch_Address TEXT,
        City VARCHAR(100),
        Telephone VARCHAR(50),
        Mobile VARCHAR(50),
        email VARCHAR(255),
        IsDelete TINYINT DEFAULT 0,
        Date_Added DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_const_id (Const_Id)
      )
    `);

    for (const b of branches) {
      await pool.query(
        `INSERT INTO consultant_branch (Const_Id, Contact_Person, Designation, Branch_Address, City, Telephone, Mobile, email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [constId, b.Contact_Person || null, b.Designation || null, b.Branch_Address || null,
         b.City || null, b.Telephone || null, b.Mobile || null, b.email || null]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Consultancy branches POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete a branch
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    await pool.query(`UPDATE consultant_branch SET IsDelete = 1 WHERE Branch_Id = ?`, [id]);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Consultancy branches DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
