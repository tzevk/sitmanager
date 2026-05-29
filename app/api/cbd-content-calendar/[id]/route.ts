/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

const TABLE = 'cbd_content_calendar';
const VALID_STATUSES = ['Not Started', 'Planned', 'Shot', 'Edited', 'Approved', 'Posted'] as const;
type Status = typeof VALID_STATUSES[number];

function safeStatus(v: unknown): Status {
  const s = String(v ?? '').trim();
  return (VALID_STATUSES as readonly string[]).includes(s) ? s as Status : 'Not Started';
}
function safeStr(v: unknown, max = 255): string {
  return String(v ?? '').trim().slice(0, max);
}
function nullableDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const b = await req.json().catch(() => null);
    if (!b) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

    await getPool().query(
      `UPDATE ${TABLE} SET
         content_type       = ?,
         planned_date       = ?,
         execution_date     = ?,
         upload_date        = ?,
         status             = ?,
         platform           = ?,
         responsible_person = ?,
         description        = ?,
         meta_campaign_id   = ?,
         meta_campaign_name = ?
       WHERE id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [
        safeStr(b.content_type || 'Post', 100),
        nullableDate(b.planned_date),
        nullableDate(b.execution_date),
        nullableDate(b.upload_date),
        safeStatus(b.status),
        safeStr(b.platform, 100),
        safeStr(b.responsible_person),
        safeStr(b.description, 2000),
        b.meta_campaign_id ? safeStr(b.meta_campaign_id, 191) : null,
        b.meta_campaign_name ? safeStr(b.meta_campaign_name, 255) : null,
        id,
      ]
    );
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    await getPool().query(
      `UPDATE ${TABLE} SET IsDelete = 1 WHERE id = ?`,
      [id]
    );
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to delete' }, { status: 500 });
  }
}
