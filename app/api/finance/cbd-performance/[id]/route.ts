/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'finance.update');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const { programme, frequency, target_students, achieved_students, fees_target, fees_received } = await req.json();
    await getPool().query(
      'UPDATE finance_cbd_performance SET programme=?, frequency=?, target_students=?, achieved_students=?, fees_target=?, fees_received=? WHERE id=?',
      [programme, frequency ?? 0, target_students ?? 0, achieved_students ?? 0, fees_target ?? 0, fees_received ?? 0, id]
    );
    const [rows] = await getPool().query<any[]>('SELECT * FROM finance_cbd_performance WHERE id=?', [id]);
    return NextResponse.json({ row: rows[0] });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'finance.delete');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    await getPool().query('DELETE FROM finance_cbd_performance WHERE id=?', [id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
