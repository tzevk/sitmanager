/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.view');
  if (auth instanceof NextResponse) return auth;
  try {
    const [rows] = await getPool().query<any[]>('SELECT * FROM finance_cashflow_projection ORDER BY id ASC');
    return NextResponse.json({ rows });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.create');
  if (auth instanceof NextResponse) return auth;
  try {
    const { month, revenue, expenses, loan_repayment } = await req.json();
    const [result]: any = await getPool().query(
      'INSERT INTO finance_cashflow_projection (month, revenue, expenses, loan_repayment) VALUES (?,?,?,?)',
      [month, revenue ?? 0, expenses ?? 0, loan_repayment ?? 0]
    );
    const [rows] = await getPool().query<any[]>('SELECT * FROM finance_cashflow_projection WHERE id=?', [result.insertId]);
    return NextResponse.json({ row: rows[0] }, { status: 201 });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
