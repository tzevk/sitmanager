/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

async function ensureCollegeFollowUpColumns(pool: ReturnType<typeof getPool>) {
  const [rows] = await pool.query<any[]>(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'awt_college'
       AND COLUMN_NAME IN ('followup_status', 'followup_date')`
  );
  const columns = new Set(rows.map((row) => String(row.COLUMN_NAME)));
  if (!columns.has('followup_status')) {
    await pool.query(`ALTER TABLE awt_college ADD COLUMN followup_status VARCHAR(100) NULL AFTER descipline`);
  }
  if (!columns.has('followup_date')) {
    await pool.query(`ALTER TABLE awt_college ADD COLUMN followup_date DATE NULL AFTER followup_status`);
  }
}

// GET - fetch single college by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pool = getPool();
    const { id } = await params;
    await ensureCollegeFollowUpColumns(pool);

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const [rows] = await pool.query<any[]>(
      `SELECT 
        id, college_name, university, contact_person, designation, address, city,
        pin, state, country, telephone, mobile, email, website,
        remark, purpose, course, batch, refstudentname, refmobile, refemail, descipline,
        followup_status, followup_date
       FROM awt_college 
       WHERE id = ? AND (deleted = 0 OR deleted IS NULL)`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'College not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err: unknown) {
    console.error('College GET by ID error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
