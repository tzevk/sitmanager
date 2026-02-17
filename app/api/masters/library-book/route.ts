/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// GET - fetch all library books with pagination and search
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'library_book.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';

    // Build WHERE clause
    const conditions: string[] = ['(IsDelete = 0 OR IsDelete IS NULL)'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`(Book_Name LIKE ? OR Book_No LIKE ? OR Book_Course LIKE ? OR Author LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = conditions.join(' AND ');

    // Count
    const countSql = `SELECT COUNT(*) AS total FROM library_book_mst WHERE ${where}`;
    const [countRows] = await pool.query<any[]>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    // Data
    const dataSql = `
      SELECT Book_Id, Book_Name, Book_No, Book_Course, Course_Id, Author, Publisher, 
             Purchase_Dt, Amount, Total_Pages, RackNo, Status, Remark, IsActive
      FROM library_book_mst 
      WHERE ${where}
      ORDER BY Book_Id DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query<any[]>(dataSql, [...params, limit, offset]);

    // Get courses for dropdown
    const [courses] = await pool.query<any[]>(`
      SELECT Course_Id, Course_Name FROM course_mst 
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
      ORDER BY Course_Name
    `);

    return NextResponse.json({
      rows,
      courses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: unknown) {
    console.error('Library Book API error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - add new library book
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'library_book.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const {
      Book_Name, Book_No, Book_Code, Course_Id, Book_Course, Author, Publisher,
      Purchase_Dt, Amount, Total_Pages, RackNo, Status, Remark
    } = body;

    if (!Book_Name?.trim()) {
      return NextResponse.json({ error: 'Book Name is required' }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO library_book_mst (
        Book_Name, Book_No, Book_Code, Course_Id, Book_Course, Author, Publisher,
        Purchase_Dt, Amount, Total_Pages, RackNo, Status, Remark, IsActive, IsDelete, Date_Added
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, CURDATE())`,
      [
        Book_Name.trim(),
        Book_No?.trim() || null,
        Book_Code?.trim() || null,
        Course_Id || null,
        Book_Course?.trim() || null,
        Author?.trim() || null,
        Publisher?.trim() || null,
        Purchase_Dt?.trim() || null,
        Amount || null,
        Total_Pages || null,
        RackNo?.trim() || null,
        Status?.trim() || null,
        Remark?.trim() || null
      ]
    );

    return NextResponse.json({ 
      success: true, 
      insertId: (result as any).insertId 
    });
  } catch (err: unknown) {
    console.error('Library Book POST error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - update library book
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'library_book.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const {
      Book_Id, Book_Name, Book_No, Book_Code, Course_Id, Book_Course, Author, Publisher,
      Purchase_Dt, Amount, Total_Pages, RackNo, Status, Remark
    } = body;

    if (!Book_Id) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 });
    }
    if (!Book_Name?.trim()) {
      return NextResponse.json({ error: 'Book Name is required' }, { status: 400 });
    }

    await pool.query(
      `UPDATE library_book_mst SET 
        Book_Name = ?, Book_No = ?, Book_Code = ?, Course_Id = ?, Book_Course = ?,
        Author = ?, Publisher = ?, Purchase_Dt = ?, Amount = ?, Total_Pages = ?,
        RackNo = ?, Status = ?, Remark = ?
       WHERE Book_Id = ?`,
      [
        Book_Name.trim(),
        Book_No?.trim() || null,
        Book_Code?.trim() || null,
        Course_Id || null,
        Book_Course?.trim() || null,
        Author?.trim() || null,
        Publisher?.trim() || null,
        Purchase_Dt?.trim() || null,
        Amount || null,
        Total_Pages || null,
        RackNo?.trim() || null,
        Status?.trim() || null,
        Remark?.trim() || null,
        Book_Id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Library Book PUT error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete library book
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'library_book.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query(`UPDATE library_book_mst SET IsDelete = 1 WHERE Book_Id = ?`, [id]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Library Book DELETE error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
