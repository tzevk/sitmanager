/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

const TABLE = 'cbd_batch_marketing';
const STATUS = ['Pending', 'In Progress', 'Done'] as const;
type S = typeof STATUS[number];

function oneOf(v: unknown, fallback: S): S {
  const s = String(v ?? '').trim();
  return (STATUS as readonly string[]).includes(s) ? s as S : fallback;
}

function subtractMonths(dateStr: string | null, months: number): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function nullableDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function safeStr(v: unknown, max = 200): string {
  return String(v ?? '').trim().slice(0, max);
}

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'finance.update');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const b = await req.json().catch(() => null);
    if (!b) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

    const startDate = nullableDate(b.batch_start_date);
    const isLocked  = b.is_locked === true || b.is_locked === 1 ? 1 : 0;

    await getPool().query(
      `UPDATE ${TABLE} SET
         batch_name=?, training_name=?, batch_start_date=?,
         batch_announcement_date=?, meta_ads_date=?,
         flyer_status=?, announcement_status=?, meta_ads_status=?,
         is_locked=?
       WHERE id=?`,
      [
        safeStr(b.batch_name),
        safeStr(b.training_name),
        startDate,
        subtractMonths(startDate, 3),
        subtractMonths(startDate, 1),
        oneOf(b.flyer_status, 'Pending'),
        oneOf(b.announcement_status, 'Pending'),
        oneOf(b.meta_ads_status, 'Pending'),
        isLocked,
        id,
      ]
    );
    const [rows] = await getPool().query<any[]>(`SELECT * FROM ${TABLE} WHERE id=?`, [id]);
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ row: rows[0] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'finance.delete');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    await getPool().query(`DELETE FROM ${TABLE} WHERE id=?`, [id]);
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
