/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// GET - fetch all statuses with pagination and search
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'status.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';

    // Build WHERE clause
    const conditions: string[] = [
      '(IsDelete = 0 OR IsDelete IS NULL)',
    ];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`(Status LIKE ? OR Description LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.join(' AND ');

    // Count
    const countSql = `SELECT COUNT(*) AS total FROM status_master WHERE ${where}`;
    const [countRows] = await pool.query<any[]>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    // Data
    const dataSql = `
      SELECT Id, Status, Description, IsActive, PreDefined, SetBy
      FROM status_master 
      WHERE ${where}
      ORDER BY Id ASC
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
    console.error('Status API error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - add new status
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'status.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { status, description } = body;

    if (!status?.trim()) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO status_master (Status, Description, IsActive, IsDelete, SetBy) VALUES (?, ?, 1, 0, 'User')`,
      [status.trim(), description?.trim() || null]
    );

    return NextResponse.json({ 
      success: true, 
      insertId: (result as any).insertId 
    });
  } catch (err: unknown) {
    console.error('Status POST error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - update status
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'status.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { id, status, description } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    if (!status?.trim()) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    await pool.query(
      `UPDATE status_master SET Status = ?, Description = ? WHERE Id = ?`,
      [status.trim(), description?.trim() || null, id]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Status PUT error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete status
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'status.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query(`UPDATE status_master SET IsDelete = 1 WHERE Id = ?`, [id]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Status DELETE error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
