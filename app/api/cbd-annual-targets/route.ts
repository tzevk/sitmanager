/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

const TABLE = 'cbd_annual_targets';

export const DDL = `
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    training_name     VARCHAR(200) NOT NULL DEFAULT '',
    target_frequency  INT NOT NULL DEFAULT 0,
    target_students   INT NOT NULL DEFAULT 0,
    students_admitted INT NOT NULL DEFAULT 0,
    uploaded_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

let ensured = false;
export async function ensureTable() {
  if (ensured) return;
  await getPool().query(DDL);
  ensured = true;
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.view');
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureTable();
    const [rows] = await getPool().query<any[]>(
      `SELECT * FROM ${TABLE} ORDER BY id ASC`
    );
    return NextResponse.json({ rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
