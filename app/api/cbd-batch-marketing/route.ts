/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

const TABLE = 'cbd_batch_marketing';
const STATUS = ['Pending', 'In Progress', 'Done'] as const;
type S = typeof STATUS[number];

const DDL = `
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    batch_name              VARCHAR(200) NOT NULL DEFAULT '',
    training_name           VARCHAR(200) NOT NULL DEFAULT '',
    batch_start_date        DATE NULL,
    batch_announcement_date DATE NULL,
    meta_ads_date           DATE NULL,
    flyer_status            ENUM('Pending','In Progress','Done') NOT NULL DEFAULT 'Pending',
    announcement_status     ENUM('Pending','In Progress','Done') NOT NULL DEFAULT 'Pending',
    meta_ads_status         ENUM('Pending','In Progress','Done') NOT NULL DEFAULT 'Pending',
    is_locked               TINYINT(1) NOT NULL DEFAULT 0,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_batch_start (batch_start_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const MIGRATION = `
  ALTER TABLE ${TABLE}
    ADD COLUMN IF NOT EXISTS is_locked TINYINT(1) NOT NULL DEFAULT 0
`;

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await getPool().query(DDL);
  try { await getPool().query(MIGRATION); } catch { /* column already exists */ }
  ensured = true;
}

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

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.view');
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureTable();
    const [rows] = await getPool().query<any[]>(
      `SELECT * FROM ${TABLE} ORDER BY COALESCE(batch_start_date,'9999-12-31') ASC, id ASC`
    );
    return NextResponse.json({ rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.create');
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureTable();
    const b = await req.json().catch(() => null);
    if (!b) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

    const startDate = nullableDate(b.batch_start_date);
    const [result] = await getPool().query<any>(
      `INSERT INTO ${TABLE}
         (batch_name, training_name, batch_start_date, batch_announcement_date, meta_ads_date,
          flyer_status, announcement_status, meta_ads_status, is_locked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        safeStr(b.batch_name),
        safeStr(b.training_name),
        startDate,
        subtractMonths(startDate, 3),
        subtractMonths(startDate, 1),
        oneOf(b.flyer_status, 'Pending'),
        oneOf(b.announcement_status, 'Pending'),
        oneOf(b.meta_ads_status, 'Pending'),
      ]
    );
    const [rows] = await getPool().query<any[]>(`SELECT * FROM ${TABLE} WHERE id=?`, [result.insertId]);
    return NextResponse.json({ row: rows[0] }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
