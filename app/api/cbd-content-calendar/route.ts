/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

const TABLE = 'cbd_content_calendar';

const DDL = `
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    content_type       VARCHAR(100)  NOT NULL DEFAULT 'Post',
    planned_date       DATE          NULL,
    execution_date     DATE          NULL,
    upload_date        DATE          NULL,
    status             ENUM('Not Started','Planned','Shot','Edited','Approved','Posted')
                       NOT NULL DEFAULT 'Not Started',
    platform           VARCHAR(100)  NOT NULL DEFAULT '',
    responsible_person VARCHAR(255)  NOT NULL DEFAULT '',
    description        TEXT          NULL,
    IsDelete           TINYINT(1)    NOT NULL DEFAULT 0,
    Date_Added         DATETIME      DEFAULT CURRENT_TIMESTAMP,
    Date_Updated       DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_planned  (planned_date),
    INDEX idx_type     (content_type),
    INDEX idx_delete   (IsDelete)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await getPool().query(DDL);
  ensured = true;
}

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

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const year  = searchParams.get('year');
    const month = searchParams.get('month');

    const conditions: string[] = ['(IsDelete = 0 OR IsDelete IS NULL)'];
    const params: (string | number)[] = [];

    if (year && month) {
      conditions.push('YEAR(planned_date) = ? AND MONTH(planned_date) = ?');
      params.push(parseInt(year, 10), parseInt(month, 10));
    }

    const [rows] = await getPool().query(
      `SELECT id, content_type,
              DATE_FORMAT(planned_date,   '%Y-%m-%d') AS planned_date,
              DATE_FORMAT(execution_date, '%Y-%m-%d') AS execution_date,
              DATE_FORMAT(upload_date,    '%Y-%m-%d') AS upload_date,
              status, platform, responsible_person, description
       FROM ${TABLE}
       WHERE ${conditions.join(' AND ')}
       ORDER BY planned_date ASC, id ASC`,
      params
    );
    return NextResponse.json({ rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureTable();
    const b = await req.json().catch(() => null);
    if (!b) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

    const [result] = await getPool().query(
      `INSERT INTO ${TABLE}
         (content_type, planned_date, execution_date, upload_date, status, platform, responsible_person, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        safeStr(b.content_type || 'Post', 100),
        nullableDate(b.planned_date),
        nullableDate(b.execution_date),
        nullableDate(b.upload_date),
        safeStatus(b.status),
        safeStr(b.platform, 100),
        safeStr(b.responsible_person),
        safeStr(b.description, 2000),
      ]
    ) as any;

    return NextResponse.json({ id: result.insertId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to create' }, { status: 500 });
  }
}
