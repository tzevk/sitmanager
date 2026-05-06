/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

/** GET returns the single row for the requested month_year (query param), or null. */
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.view');
  if (auth instanceof NextResponse) return auth;
  try {
    const monthYear = new URL(req.url).searchParams.get('month_year') ?? '';
    const [rows] = await getPool().query<any[]>(
      'SELECT * FROM finance_salary_cashflow WHERE month_year=? LIMIT 1',
      [monthYear]
    );
    return NextResponse.json({ row: rows[0] ?? null });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

/** PUT upserts the salary cashflow record for the given month_year. */
export async function PUT(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.update');
  if (auth instanceof NextResponse) return auth;
  try {
    const { month_year, total_payable, salary_paid, salary_pending, next_payout } = await req.json();
    await getPool().query(`
      INSERT INTO finance_salary_cashflow (month_year, total_payable, salary_paid, salary_pending, next_payout)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total_payable=VALUES(total_payable),
        salary_paid=VALUES(salary_paid),
        salary_pending=VALUES(salary_pending),
        next_payout=VALUES(next_payout)
    `, [month_year, total_payable ?? 0, salary_paid ?? 0, salary_pending ?? 0, next_payout || null]);
    const [rows] = await getPool().query<any[]>('SELECT * FROM finance_salary_cashflow WHERE month_year=?', [month_year]);
    return NextResponse.json({ row: rows[0] });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
