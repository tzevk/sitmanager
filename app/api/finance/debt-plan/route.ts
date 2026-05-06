/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.view');
  if (auth instanceof NextResponse) return auth;
  try {
    const [rows] = await getPool().query<any[]>('SELECT * FROM finance_debt_plan ORDER BY planned_date ASC');
    return NextResponse.json({ rows });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.create');
  if (auth instanceof NextResponse) return auth;
  try {
    const { bank_name, emi_amount, planned_date, actual_paid, actual_date, status } = await req.json();
    const [result]: any = await getPool().query(
      'INSERT INTO finance_debt_plan (bank_name, emi_amount, planned_date, actual_paid, actual_date, status) VALUES (?,?,?,?,?,?)',
      [bank_name, emi_amount ?? 0, planned_date || null, actual_paid ?? 0, actual_date || null, status ?? 'Pending']
    );
    const [rows] = await getPool().query<any[]>('SELECT * FROM finance_debt_plan WHERE id=?', [result.insertId]);
    return NextResponse.json({ row: rows[0] }, { status: 201 });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
