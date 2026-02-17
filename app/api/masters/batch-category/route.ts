/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'batch_category.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;

    const search = searchParams.get('search')?.trim() || '';

    /* ---- Build WHERE ---- */
    const conditions: string[] = [
      'IsActive = 1',
      '(IsDelete = 0 OR IsDelete IS NULL)',
      'Category IS NOT NULL',
      "Category != ''"
    ];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`Category LIKE ?`);
      params.push(`%${search}%`);
    }

    const where = conditions.join(' AND ');

    /* ---- Count distinct categories ---- */
    const countSql = `SELECT COUNT(DISTINCT Category) AS total FROM batch_mst WHERE ${where}`;
    const [countRows] = await pool.query<any[]>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    /* ---- Data - get distinct categories with row numbers ---- */
    const dataSql = `
      SELECT 
        (@row_number := @row_number + 1) AS id,
        Category AS batch
      FROM (
        SELECT DISTINCT Category 
        FROM batch_mst 
        WHERE ${where}
        ORDER BY Category
        LIMIT ? OFFSET ?
      ) AS categories, (SELECT @row_number := ? + 0) AS rn
    `;
    const [rows] = await pool.query<any[]>(dataSql, [...params, limit, offset, offset]);

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
    console.error('Batch Category API error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'batch_category.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();
    const { batch, batchtype, prefix, description } = body;

    if (!batch?.trim()) {
      return NextResponse.json({ error: 'Batch Category is required' }, { status: 400 });
    }
    if (!description?.trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const sql = `
      INSERT INTO awt_batch_category (batch, batchtype, prefix, description, deleted)
      VALUES (?, ?, ?, ?, 0)
    `;
    const [result] = await pool.query<any>(sql, [
      batch.trim(),
      batchtype?.trim() || null,
      prefix?.trim() || null,
      description.trim(),
    ]);

    return NextResponse.json({
      success: true,
      id: result.insertId,
      message: 'Batch Category created successfully',
    });
  } catch (err: unknown) {
    console.error('Batch Category POST error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'batch_category.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();
    const { batch, originalBatch } = body;

    if (!originalBatch?.trim()) {
      return NextResponse.json({ error: 'Original category is required' }, { status: 400 });
    }
    if (!batch?.trim()) {
      return NextResponse.json({ error: 'Batch Category is required' }, { status: 400 });
    }

    // Update Category in batch_mst for all records with the original category name
    const sql = `
      UPDATE batch_mst
      SET Category = ?
      WHERE Category = ?
    `;
    const [result] = await pool.query<any>(sql, [
      batch.trim(),
      originalBatch.trim(),
    ]);

    return NextResponse.json({
      success: true,
      message: `Batch Category updated successfully (${result.affectedRows} batches updated)`,
    });
  } catch (err: unknown) {
    console.error('Batch Category PUT error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'batch_category.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Batch Category ID is required' }, { status: 400 });
    }

    const sql = `UPDATE awt_batch_category SET deleted = 1 WHERE id = ?`;
    await pool.query(sql, [id]);

    return NextResponse.json({
      success: true,
      message: 'Batch Category deleted successfully',
    });
  } catch (err: unknown) {
    console.error('Batch Category DELETE error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
