/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'finance.update');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const { month, training_name, count, cost, target } = await req.json();
    await getPool().query(
      'UPDATE finance_ct_performance SET month=?, training_name=?, count=?, cost=?, target=? WHERE id=?',
      [month, training_name, count ?? 0, cost ?? 0, target ?? 0, id]
    );
    const [rows] = await getPool().query<any[]>('SELECT * FROM finance_ct_performance WHERE id=?', [id]);
    return NextResponse.json({ row: rows[0] });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'finance.delete');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    await getPool().query('DELETE FROM finance_ct_performance WHERE id=?', [id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
