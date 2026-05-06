/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.view');
  if (auth instanceof NextResponse) return auth;
  try {
    const [rows] = await getPool().query<any[]>('SELECT * FROM finance_cbd_performance ORDER BY id DESC');
    return NextResponse.json({ rows });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.create');
  if (auth instanceof NextResponse) return auth;
  try {
    const { programme, frequency, target_students, achieved_students, fees_target, fees_received } = await req.json();
    const [result]: any = await getPool().query(
      'INSERT INTO finance_cbd_performance (programme, frequency, target_students, achieved_students, fees_target, fees_received) VALUES (?,?,?,?,?,?)',
      [programme, frequency ?? 0, target_students ?? 0, achieved_students ?? 0, fees_target ?? 0, fees_received ?? 0]
    );
    const [rows] = await getPool().query<any[]>('SELECT * FROM finance_cbd_performance WHERE id=?', [result.insertId]);
    return NextResponse.json({ row: rows[0] }, { status: 201 });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
