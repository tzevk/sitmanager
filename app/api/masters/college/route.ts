/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

async function ensureCollegeFollowUpColumns(pool: ReturnType<typeof getPool>) {
  const [rows] = await pool.query<any[]>(
    `SELECT COLUMN_NAME, DATA_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'awt_college'
       AND COLUMN_NAME IN ('descipline', 'followup_status', 'followup_date')`
  );
  const columns = new Set(rows.map((row) => String(row.COLUMN_NAME)));
  const descipline = rows.find((row) => String(row.COLUMN_NAME) === 'descipline');
  if (descipline && !/^text$/i.test(String(descipline.DATA_TYPE || ''))) {
    await pool.query(`ALTER TABLE awt_college MODIFY COLUMN descipline TEXT NULL`);
  }
  if (!columns.has('followup_status')) {
    await pool.query(`ALTER TABLE awt_college ADD COLUMN followup_status VARCHAR(100) NULL AFTER descipline`);
  }
  if (!columns.has('followup_date')) {
    await pool.query(`ALTER TABLE awt_college ADD COLUMN followup_date DATE NULL AFTER followup_status`);
  }
}

// GET - fetch all colleges with pagination and search
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'college.view');
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
      conditions.push(`(college_name LIKE ? OR university LIKE ? OR contact_person LIKE ? OR city LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = conditions.join(' AND ');

    // Count
    const countSql = `SELECT COUNT(*) AS total FROM awt_college WHERE ${where}`;
    const [countRows] = await pool.query<any[]>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    // Data
    const dataSql = `
      SELECT id, college_name, university, contact_person, designation, address, city
      FROM awt_college 
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
    console.error('College API error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - add new college
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'college.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const {
      college_name, university, contact_person, designation, address, city,
      pin, state, country, telephone, mobile, email, website,
      remark, purpose, course, batch, refstudentname, refmobile, refemail, descipline,
      followup_status, followup_date
    } = body;

    if (!college_name?.trim()) {
      return NextResponse.json({ error: 'College Name is required' }, { status: 400 });
    }

    await ensureCollegeFollowUpColumns(pool);

    const [result] = await pool.query(
      `INSERT INTO awt_college (
        college_name, university, contact_person, designation, address, city,
        pin, state, country, telephone, mobile, email, website,
        remark, purpose, course, batch, refstudentname, refmobile, refemail, descipline,
        followup_status, followup_date,
        deleted, created_date
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
      [
        college_name.trim(), university?.trim() || null, contact_person?.trim() || null,
        designation?.trim() || null, address?.trim() || null, city?.trim() || null,
        pin?.trim() || null, state?.trim() || null, country?.trim() || null,
        telephone?.trim() || null, mobile?.trim() || null, email?.trim() || null,
        website?.trim() || null, remark?.trim() || null, purpose?.trim() || null,
        course?.trim() || null, batch?.trim() || null, refstudentname?.trim() || null,
        refmobile?.trim() || null, refemail?.trim() || null, descipline?.trim() || null,
        followup_status?.trim() || null, followup_date || null
      ]
    );

    return NextResponse.json({ 
      success: true, 
      insertId: (result as any).insertId 
    });
  } catch (err: unknown) {
    console.error('College POST error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - update college
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'college.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const {
      id, college_name, university, contact_person, designation, address, city,
      pin, state, country, telephone, mobile, email, website,
      remark, purpose, course, batch, refstudentname, refmobile, refemail, descipline,
      followup_status, followup_date
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    if (!college_name?.trim()) {
      return NextResponse.json({ error: 'College Name is required' }, { status: 400 });
    }

    await ensureCollegeFollowUpColumns(pool);

    await pool.query(
      `UPDATE awt_college SET 
        college_name = ?, university = ?, contact_person = ?, designation = ?, address = ?, city = ?,
        pin = ?, state = ?, country = ?, telephone = ?, mobile = ?, email = ?, website = ?,
        remark = ?, purpose = ?, course = ?, batch = ?, refstudentname = ?, refmobile = ?, refemail = ?, descipline = ?,
        followup_status = ?, followup_date = ?,
        updated_date = NOW()
       WHERE id = ?`,
      [
        college_name.trim(), university?.trim() || null, contact_person?.trim() || null,
        designation?.trim() || null, address?.trim() || null, city?.trim() || null,
        pin?.trim() || null, state?.trim() || null, country?.trim() || null,
        telephone?.trim() || null, mobile?.trim() || null, email?.trim() || null,
        website?.trim() || null, remark?.trim() || null, purpose?.trim() || null,
        course?.trim() || null, batch?.trim() || null, refstudentname?.trim() || null,
        refmobile?.trim() || null, refemail?.trim() || null, descipline?.trim() || null,
        followup_status?.trim() || null, followup_date || null,
        id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('College PUT error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete college
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'college.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query(`UPDATE awt_college SET deleted = 1 WHERE id = ?`, [id]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('College DELETE error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
