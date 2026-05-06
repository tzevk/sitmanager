/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'finance.update');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const { month, actual_cost, target_cost } = await req.json();
    await getPool().query(
      'UPDATE finance_deputation SET month=?, actual_cost=?, target_cost=? WHERE id=?',
      [month, actual_cost ?? 0, target_cost ?? 0, id]
    );
    const [rows] = await getPool().query<any[]>('SELECT * FROM finance_deputation WHERE id=?', [id]);
    return NextResponse.json({ row: rows[0] });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'finance.delete');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    await getPool().query('DELETE FROM finance_deputation WHERE id=?', [id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
