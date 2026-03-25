/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

const TABLE_NAME = 'Holiday_master';

async function ensureHolidayMaster(pool: any) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      Id INT AUTO_INCREMENT PRIMARY KEY,
      Holiday VARCHAR(255),
      Date_of_Holiday DATE,
      IsActive TINYINT DEFAULT 1,
      IsDelete TINYINT DEFAULT 0,
      Date_Added DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const ensureColumn = async (col: string, ddl: string) => {
    const [cRows] = await pool.query(
      `SELECT COUNT(*) as cnt
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
      [TABLE_NAME, col]
    );
    const cnt = Number((cRows as any)?.[0]?.cnt ?? 0);
    if (cnt > 0) return;
    await pool.query(ddl);
  };

  await ensureColumn('IsDelete', `ALTER TABLE ${TABLE_NAME} ADD COLUMN IsDelete TINYINT DEFAULT 0`);
  await ensureColumn('IsActive', `ALTER TABLE ${TABLE_NAME} ADD COLUMN IsActive TINYINT DEFAULT 1`);
  await ensureColumn('Holiday', `ALTER TABLE ${TABLE_NAME} ADD COLUMN Holiday VARCHAR(255)`);
  await ensureColumn('Date_of_Holiday', `ALTER TABLE ${TABLE_NAME} ADD COLUMN Date_of_Holiday DATE`);
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'holiday.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureHolidayMaster(pool);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';

    const conditions: string[] = ['(IsDelete = 0 OR IsDelete IS NULL)'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`(Holiday LIKE ? OR DATE_FORMAT(Date_of_Holiday, '%Y-%m-%d') LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.join(' AND ');

    const [countRows] = await pool.query<any[]>(`SELECT COUNT(*) AS total FROM ${TABLE_NAME} WHERE ${where}`, params);
    const total = countRows[0]?.total ?? 0;

    const [rows] = await pool.query<any[]>(
      `SELECT
         Id,
         Holiday,
         DATE_FORMAT(Date_of_Holiday, '%Y-%m-%d') AS Date_of_Holiday,
         IsActive
       FROM ${TABLE_NAME}
       WHERE ${where}
       ORDER BY Date_of_Holiday DESC, Id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

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
    console.error('Holiday master GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'holiday.create');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureHolidayMaster(pool);

    const body = await req.json().catch(() => ({}));
    const holiday = String(body?.holiday ?? '').trim();
    const dateOfHoliday = String(body?.dateOfHoliday ?? '').trim();
    const isActive = body?.isActive === false ? 0 : 1;

    if (!holiday) return NextResponse.json({ error: 'Holiday is required' }, { status: 400 });
    if (!dateOfHoliday) return NextResponse.json({ error: 'Date is required' }, { status: 400 });

    const [result] = await pool.query(
      `INSERT INTO ${TABLE_NAME} (Holiday, Date_of_Holiday, IsActive, IsDelete)
       VALUES (?, ?, ?, 0)`,
      [holiday, dateOfHoliday, isActive]
    );

    return NextResponse.json({ success: true, insertId: (result as any).insertId });
  } catch (err: unknown) {
    console.error('Holiday master POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'holiday.update');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureHolidayMaster(pool);

    const body = await req.json().catch(() => ({}));
    const id = Number(body?.id);
    const holiday = String(body?.holiday ?? '').trim();
    const dateOfHoliday = String(body?.dateOfHoliday ?? '').trim();
    const isActive = body?.isActive === false ? 0 : 1;

    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    if (!holiday) return NextResponse.json({ error: 'Holiday is required' }, { status: 400 });
    if (!dateOfHoliday) return NextResponse.json({ error: 'Date is required' }, { status: 400 });

    await pool.query(
      `UPDATE ${TABLE_NAME}
       SET Holiday = ?, Date_of_Holiday = ?, IsActive = ?
       WHERE Id = ?`,
      [holiday, dateOfHoliday, isActive, id]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Holiday master PUT error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'holiday.delete');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureHolidayMaster(pool);

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id'));

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query(`UPDATE ${TABLE_NAME} SET IsDelete = 1 WHERE Id = ?`, [id]);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Holiday master DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
