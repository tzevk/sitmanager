/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.view');
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const month_year = searchParams.get('month_year');
    const [rows] = await getPool().query<any[]>(
      month_year
        ? 'SELECT * FROM finance_dept_performance WHERE month_year=? ORDER BY id ASC'
        : 'SELECT * FROM finance_dept_performance ORDER BY month_year DESC, id ASC',
      month_year ? [month_year] : []
    );
    return NextResponse.json({ rows });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.create');
  if (auth instanceof NextResponse) return auth;
  try {
    const { month_year, department, amount_achieved, target_amount } = await req.json();
    const [result]: any = await getPool().query(
      'INSERT INTO finance_dept_performance (month_year, department, amount_achieved, target_amount) VALUES (?,?,?,?)',
      [month_year, department, amount_achieved ?? 0, target_amount ?? 0]
    );
    const [rows] = await getPool().query<any[]>('SELECT * FROM finance_dept_performance WHERE id=?', [result.insertId]);
    return NextResponse.json({ row: rows[0] }, { status: 201 });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
