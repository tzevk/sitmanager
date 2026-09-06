/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

const TABLE_NAME = 'awt_noticeboard';

// awt_noticeboard predates this CRUD utility (it already held 23 legacy rows,
// written by some earlier/removed feature) and has no Title column — add one
// lazily rather than migrating existing rows.
async function ensureTitleColumn(pool: any) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'title'`,
    [TABLE_NAME]
  );
  if (Number((rows as any[])?.[0]?.cnt ?? 0) > 0) return;
  await pool.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN title VARCHAR(255) NULL AFTER id`);
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'notice_board.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureTitleColumn(pool);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';

    const conditions: string[] = ['deleted = 0'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`(title LIKE ? OR specification LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.join(' AND ');

    const [countRows] = await pool.query<any[]>(`SELECT COUNT(*) AS total FROM ${TABLE_NAME} WHERE ${where}`, params);
    const total = countRows[0]?.total ?? 0;

    const [rows] = await pool.query<any[]>(
      `SELECT id, title, specification, startdate, enddate, created_date
       FROM ${TABLE_NAME}
       WHERE ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: unknown) {
    console.error('Notice board GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'notice_board.create');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureTitleColumn(pool);

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title ?? '').trim();
    const specification = String(body?.specification ?? '').trim();
    const startdate = String(body?.startdate ?? '').trim() || null;
    const enddate = String(body?.enddate ?? '').trim() || null;

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!specification) return NextResponse.json({ error: 'Specification is required' }, { status: 400 });

    const [result] = await pool.query(
      `INSERT INTO ${TABLE_NAME} (title, specification, startdate, enddate, created_by, deleted)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [title, specification, startdate, enddate, auth.session.userId]
    );

    return NextResponse.json({ success: true, insertId: (result as any).insertId });
  } catch (err: unknown) {
    console.error('Notice board POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'notice_board.update');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureTitleColumn(pool);

    const body = await req.json().catch(() => ({}));
    const id = Number(body?.id);
    const title = String(body?.title ?? '').trim();
    const specification = String(body?.specification ?? '').trim();
    const startdate = String(body?.startdate ?? '').trim() || null;
    const enddate = String(body?.enddate ?? '').trim() || null;

    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!specification) return NextResponse.json({ error: 'Specification is required' }, { status: 400 });

    await pool.query(
      `UPDATE ${TABLE_NAME}
       SET title = ?, specification = ?, startdate = ?, enddate = ?, updated_by = ?
       WHERE id = ?`,
      [title, specification, startdate, enddate, auth.session.userId, id]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Notice board PUT error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'notice_board.delete');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id'));

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query(`UPDATE ${TABLE_NAME} SET deleted = 1, updated_by = ? WHERE id = ?`, [auth.session.userId, id]);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Notice board DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
