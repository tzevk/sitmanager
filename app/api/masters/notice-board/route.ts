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

// Audience targeting: comma-separated id lists. NULL/empty = everyone.
// A notice with batch_ids goes only to those batches; with only course_ids it
// goes to every student of those training programmes.
let targetColsReady = false;
async function ensureTargetColumns(pool: any) {
  if (targetColsReady) return;
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME IN ('course_ids','batch_ids')`,
    [TABLE_NAME]
  );
  const have = new Set((rows as any[]).map((r) => r.COLUMN_NAME));
  if (!have.has('course_ids')) await pool.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN course_ids VARCHAR(1000) NULL`);
  if (!have.has('batch_ids')) await pool.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN batch_ids VARCHAR(2000) NULL`);
  targetColsReady = true;
}

function idList(v: unknown): string | null {
  const arr = Array.isArray(v) ? v : [];
  const ids = [...new Set(arr.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  return ids.length ? ids.join(',') : null;
}

// Current batches = running today: started, not yet ended (inverse of the
// Closed Batches cut-off), not deleted/cancelled.
async function getOptions(pool: any) {
  const [batches] = await pool.query(
    `SELECT b.Batch_Id, b.Batch_code, b.Course_Id, b.SDate, b.EDate, c.Course_Name
     FROM batch_mst b
     LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id
     WHERE (b.IsDelete = 0 OR b.IsDelete IS NULL)
       AND (b.Cancel IS NULL OR b.Cancel NOT IN ('Yes','yes','1','Y','y'))
       AND b.SDate IS NOT NULL AND b.SDate <> '' AND DATE(b.SDate) <= CURDATE()
       AND (b.EDate IS NULL OR b.EDate = '' OR DATE(b.EDate) >= CURDATE())
     ORDER BY c.Course_Name, b.Batch_code`
  );
  const courseMap = new Map<number, string>();
  for (const b of batches as any[]) if (b.Course_Id) courseMap.set(Number(b.Course_Id), b.Course_Name || `Course ${b.Course_Id}`);
  const courses = [...courseMap].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  return { courses, batches };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'notice_board.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureTitleColumn(pool);
    await ensureTargetColumns(pool);

    const { searchParams } = new URL(req.url);
    if (searchParams.get('options') === '1') return NextResponse.json(await getOptions(pool));
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

    const [countRows] = await pool.query<any[]>(`SELECT COUNT(*) AS total FROM ${TABLE_NAME} n WHERE ${where}`, params);
    const total = countRows[0]?.total ?? 0;

    const [rows] = await pool.query<any[]>(
      `SELECT n.id, n.title, n.specification, n.startdate, n.enddate, n.created_date, n.course_ids, n.batch_ids,
              (SELECT GROUP_CONCAT(c.Course_Name ORDER BY c.Course_Name SEPARATOR ', ') FROM course_mst c
                WHERE n.course_ids IS NOT NULL AND FIND_IN_SET(c.Course_Id, n.course_ids)) AS course_names,
              (SELECT GROUP_CONCAT(b.Batch_code ORDER BY b.Batch_code SEPARATOR ', ') FROM batch_mst b
                WHERE n.batch_ids IS NOT NULL AND FIND_IN_SET(b.Batch_Id, n.batch_ids)) AS batch_codes
       FROM ${TABLE_NAME} n
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
    await ensureTargetColumns(pool);

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title ?? '').trim();
    const specification = String(body?.specification ?? '').trim();
    const startdate = String(body?.startdate ?? '').trim() || null;
    const enddate = String(body?.enddate ?? '').trim() || null;
    const course_ids = idList(body?.course_ids);
    const batch_ids = idList(body?.batch_ids);

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!specification) return NextResponse.json({ error: 'Specification is required' }, { status: 400 });

    const [result] = await pool.query(
      `INSERT INTO ${TABLE_NAME} (title, specification, startdate, enddate, course_ids, batch_ids, created_by, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [title, specification, startdate, enddate, course_ids, batch_ids, auth.session.userId]
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
    await ensureTargetColumns(pool);

    const body = await req.json().catch(() => ({}));
    const id = Number(body?.id);
    const title = String(body?.title ?? '').trim();
    const specification = String(body?.specification ?? '').trim();
    const startdate = String(body?.startdate ?? '').trim() || null;
    const enddate = String(body?.enddate ?? '').trim() || null;
    const course_ids = idList(body?.course_ids);
    const batch_ids = idList(body?.batch_ids);

    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!specification) return NextResponse.json({ error: 'Specification is required' }, { status: 400 });

    await pool.query(
      `UPDATE ${TABLE_NAME}
       SET title = ?, specification = ?, startdate = ?, enddate = ?, course_ids = ?, batch_ids = ?, updated_by = ?
       WHERE id = ?`,
      [title, specification, startdate, enddate, course_ids, batch_ids, auth.session.userId, id]
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
