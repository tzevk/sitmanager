/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'finance.update');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const { bank_name, emi_amount, planned_date, actual_paid, actual_date, status } = await req.json();
    await getPool().query(
      'UPDATE finance_debt_plan SET bank_name=?, emi_amount=?, planned_date=?, actual_paid=?, actual_date=?, status=? WHERE id=?',
      [bank_name, emi_amount ?? 0, planned_date || null, actual_paid ?? 0, actual_date || null, status ?? 'Pending', id]
    );
    const [rows] = await getPool().query<any[]>('SELECT * FROM finance_debt_plan WHERE id=?', [id]);
    return NextResponse.json({ row: rows[0] });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'finance.delete');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    await getPool().query('DELETE FROM finance_debt_plan WHERE id=?', [id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
