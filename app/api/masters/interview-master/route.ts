/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { cache } from '@/lib/cache';

const TABLE_NAME = 'placement_interview_master';
const INTERVIEW_TYPES = ['On Campus', 'Company'] as const;

async function ensureInterviewMaster(pool: ReturnType<typeof getPool>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      interview_code VARCHAR(20) NULL,
      interview_date DATE NOT NULL,
      company_name VARCHAR(160) NOT NULL,
      role VARCHAR(160) NOT NULL,
      interview_type VARCHAR(20) NOT NULL DEFAULT 'On Campus',
      is_deleted TINYINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_placement_interview_master_code (interview_code),
      KEY idx_interview_master_active (is_deleted, interview_date),
      KEY idx_interview_master_company (company_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [columnRows] = await pool.query<any[]>(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = 'interview_code'`,
    [TABLE_NAME],
  );
  if (Number(columnRows[0]?.count ?? 0) === 0) {
    await pool.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN interview_code VARCHAR(20) NULL AFTER id`);
  }

  await pool.query(`
    UPDATE ${TABLE_NAME}
    SET interview_code = CONCAT('INT-', LPAD(id, 5, '0'))
    WHERE interview_code IS NULL OR TRIM(interview_code) = ''
  `);

  const [indexRows] = await pool.query<any[]>(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = 'uq_placement_interview_master_code'`,
    [TABLE_NAME],
  );
  if (Number(indexRows[0]?.count ?? 0) === 0) {
    await pool.query(`ALTER TABLE ${TABLE_NAME} ADD UNIQUE KEY uq_placement_interview_master_code (interview_code)`);
  }
}

function normalizeInterviewType(value: unknown) {
  const type = String(value ?? '').trim().toLowerCase();
  if (type === 'company') return 'Company';
  return 'On Campus';
}

function readBody(body: any) {
  const interviewDate = String(body?.interviewDate ?? '').trim();
  const companyName = String(body?.companyName ?? '').trim().slice(0, 160);
  const role = String(body?.role ?? '').trim().slice(0, 160);
  const interviewType = normalizeInterviewType(body?.interviewType);

  if (!interviewDate) throw new Error('Date is required');
  if (!companyName) throw new Error('Company name is required');
  if (!role) throw new Error('Role is required');

  return { interviewDate, companyName, role, interviewType };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'interview_master.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureInterviewMaster(pool);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';
    const type = searchParams.get('type')?.trim() || '';
    const code = searchParams.get('code')?.trim() || '';

    const conditions = ['is_deleted = 0'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`(interview_code LIKE ? OR company_name LIKE ? OR role LIKE ? OR DATE_FORMAT(interview_date, '%Y-%m-%d') LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (code) {
      conditions.push('interview_code = ?');
      params.push(code);
    }

    if (INTERVIEW_TYPES.includes(type as any)) {
      conditions.push('interview_type = ?');
      params.push(type);
    }

    const where = conditions.join(' AND ');
    const [countRows] = await pool.query<any[]>(`SELECT COUNT(*) AS total FROM ${TABLE_NAME} WHERE ${where}`, params);
    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await pool.query<any[]>(
      `SELECT
         id,
         COALESCE(NULLIF(TRIM(interview_code), ''), CONCAT('INT-', LPAD(id, 5, '0'))) AS interview_code,
         DATE_FORMAT(interview_date, '%Y-%m-%d') AS interview_date,
         company_name,
         role,
         interview_type
       FROM ${TABLE_NAME}
       WHERE ${where}
       ORDER BY interview_date ASC, updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return NextResponse.json({
      rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: unknown) {
    console.error('Interview master GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'interview_master.create');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureInterviewMaster(pool);

    const body = await req.json().catch(() => ({}));
    const data = readBody(body);

    const [result] = await pool.query(
      `INSERT INTO ${TABLE_NAME} (interview_date, company_name, role, interview_type)
       VALUES (?, ?, ?, ?)`,
      [data.interviewDate, data.companyName, data.role, data.interviewType],
    );
    const insertId = Number((result as any).insertId || 0);
    if (insertId > 0) {
      await pool.query(`UPDATE ${TABLE_NAME} SET interview_code = CONCAT('INT-', LPAD(id, 5, '0')) WHERE id = ?`, [insertId]);
    }
    await cache.delete('dashboard:data:placement');

    return NextResponse.json({ success: true, insertId, interviewCode: insertId > 0 ? `INT-${String(insertId).padStart(5, '0')}` : null });
  } catch (err: unknown) {
    console.error('Interview master POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'interview_master.update');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureInterviewMaster(pool);

    const body = await req.json().catch(() => ({}));
    const id = Number(body?.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const data = readBody(body);
    await pool.query(
      `UPDATE ${TABLE_NAME}
       SET interview_date = ?, company_name = ?, role = ?, interview_type = ?
       WHERE id = ? AND is_deleted = 0`,
      [data.interviewDate, data.companyName, data.role, data.interviewType, id],
    );
    await cache.delete('dashboard:data:placement');

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Interview master PUT error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'interview_master.delete');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureInterviewMaster(pool);

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id'));
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await pool.query(`UPDATE ${TABLE_NAME} SET is_deleted = 1 WHERE id = ?`, [id]);
  await cache.delete('dashboard:data:placement');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Interview master DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}