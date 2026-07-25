/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';
import { ensureOnce, jsonOk, jsonErr, badRequest, nonNegNum } from '@/lib/finance-helpers';

const TABLE = 'finance_bank_balance';

const DDL = `
  CREATE TABLE IF NOT EXISTS finance_bank_balance (
    id            INT PRIMARY KEY DEFAULT 1,
    sit_balance   DECIMAL(14,2) NOT NULL DEFAULT 0,
    atspl_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

/** GET — the single current bank balance record (manually maintained; no live bank feed). */
export async function GET(req: NextRequest) {
  const limited = await apiRateLimiter(req);
  if (limited) return limited;
  const auth = await requirePermission(req, 'finance.view');
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureOnce(getPool(), TABLE, DDL);
    const [rows] = await getPool().query<any[]>(`SELECT * FROM ${TABLE} WHERE id = 1 LIMIT 1`);
    return jsonOk({ row: rows[0] ?? null });
  } catch (err: any) {
    return jsonErr(err?.message ?? 'Server error');
  }
}

/** PUT — upsert the single record (id always 1). */
export async function PUT(req: NextRequest) {
  const limited = await apiRateLimiter(req);
  if (limited) return limited;
  const auth = await requirePermission(req, 'finance.update');
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureOnce(getPool(), TABLE, DDL);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

    const sitBalance   = nonNegNum(body.sit_balance);
    const atsplBalance = nonNegNum(body.atspl_balance);

    await getPool().query(
      `INSERT INTO ${TABLE} (id, sit_balance, atspl_balance) VALUES (1, ?, ?)
       ON DUPLICATE KEY UPDATE
         sit_balance   = VALUES(sit_balance),
         atspl_balance = VALUES(atspl_balance)`,
      [sitBalance, atsplBalance],
    );
    const [rows] = await getPool().query<any[]>(`SELECT * FROM ${TABLE} WHERE id = 1 LIMIT 1`);
    return jsonOk({ row: rows[0] });
  } catch (err: any) {
    return jsonErr(err?.message ?? 'Server error');
  }
}
