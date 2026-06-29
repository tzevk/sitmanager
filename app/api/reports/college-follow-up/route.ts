/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'report_college_followup.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') || 25)));
    const offset = (page - 1) * limit;
    const search = (searchParams.get('search') || '').trim();

    const conditions = ['(deleted = 0 OR deleted IS NULL)'];
    const params: Array<string | number> = [];

    if (search) {
      conditions.push(`(
        college_name LIKE ? OR university LIKE ? OR address LIKE ? OR city LIKE ?
        OR contact_person LIKE ? OR telephone LIKE ? OR email LIKE ? OR mobile LIKE ? OR website LIKE ?
      )`);
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like, like, like, like);
    }

    const where = conditions.join(' AND ');
    const [countRows] = await pool.query<any[]>(`SELECT COUNT(*) AS total FROM awt_college WHERE ${where}`, params);
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await pool.query<any[]>(
      `SELECT
         id,
         college_name,
        college_name AS CollegeName,
         university,
         address,
         city,
         contact_person,
         telephone,
         email,
         mobile,
         website
       FROM awt_college
       WHERE ${where}
       ORDER BY
         CASE WHEN TRIM(COALESCE(college_name, '')) IN ('', '#NAME?', '.', '0') THEN 1 ELSE 0 END,
         CASE WHEN CONCAT_WS('', address, city, contact_person, telephone, email, mobile, website) = '' THEN 1 ELSE 0 END,
         college_name ASC,
         id ASC
       LIMIT ${limit} OFFSET ${offset}`,
      params
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
    const message = err instanceof Error ? err.message : 'Failed to load college follow ups';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}