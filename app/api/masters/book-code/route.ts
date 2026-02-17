/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// GET - fetch all book codes with pagination and search
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'book_code.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';

    // Build WHERE clause
    const conditions: string[] = ['(deleted = 0 OR deleted IS NULL)'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`title LIKE ?`);
      params.push(`%${search}%`);
    }

    const where = conditions.join(' AND ');

    // Count
    const countSql = `SELECT COUNT(*) AS total FROM awt_bookcode WHERE ${where}`;
    const [countRows] = await pool.query<any[]>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    // Data
    const dataSql = `
      SELECT id, title, created_date
      FROM awt_bookcode 
      WHERE ${where}
      ORDER BY id ASC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query<any[]>(dataSql, [...params, limit, offset]);

    return NextResponse.json({
      rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: unknown) {
    console.error('Book Code API error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - add new book code
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'book_code.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { title } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Book Code is required' }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO awt_bookcode (title, deleted, created_date) VALUES (?, 0, NOW())`,
      [title.trim()]
    );

    return NextResponse.json({ 
      success: true, 
      insertId: (result as any).insertId 
    });
  } catch (err: unknown) {
    console.error('Book Code POST error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - update book code
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'book_code.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { id, title } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    if (!title?.trim()) {
      return NextResponse.json({ error: 'Book Code is required' }, { status: 400 });
    }

    await pool.query(
      `UPDATE awt_bookcode SET title = ?, updated_date = NOW() WHERE id = ?`,
      [title.trim(), id]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Book Code PUT error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete book code
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'book_code.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query(`UPDATE awt_bookcode SET deleted = 1 WHERE id = ?`, [id]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Book Code DELETE error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
