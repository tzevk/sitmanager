/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';
import { ensureOnce, jsonOk, jsonErr, badRequest, nonNegNum, nullableMonth, nullableDate } from '@/lib/finance-helpers';

const TABLE = 'finance_salary_cashflow';

const DDL = `
  CREATE TABLE IF NOT EXISTS finance_salary_cashflow (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    month_year     CHAR(7) NOT NULL UNIQUE,
    total_payable  DECIMAL(14,2) NOT NULL DEFAULT 0,
    salary_paid    DECIMAL(14,2) NOT NULL DEFAULT 0,
    salary_pending DECIMAL(14,2) NOT NULL DEFAULT 0,
    next_payout    DATE NULL,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

/** GET — fetch a single record for the requested month. */
export async function GET(req: NextRequest) {
  const limited = apiRateLimiter(req);
  if (limited) return limited;
  const auth = await requirePermission(req, 'finance.view');
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureOnce(getPool(), TABLE, DDL);
    const monthYear = nullableMonth(new URL(req.url).searchParams.get('month_year'));
    if (!monthYear) return jsonOk({ row: null });
    const [rows] = await getPool().query<any[]>(
      `SELECT * FROM ${TABLE} WHERE month_year=? LIMIT 1`,
      [monthYear],
    );
    return jsonOk({ row: rows[0] ?? null });
  } catch (err: any) {
    return jsonErr(err?.message ?? 'Server error');
  }
}

/** PUT — upsert by month_year. */
export async function PUT(req: NextRequest) {
  const limited = apiRateLimiter(req);
  if (limited) return limited;
  const auth = await requirePermission(req, 'finance.update');
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureOnce(getPool(), TABLE, DDL);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

    const monthYear = nullableMonth(body.month_year);
    if (!monthYear) return badRequest('month_year must be YYYY-MM');

    const totalPayable  = nonNegNum(body.total_payable);
    const salaryPaid    = nonNegNum(body.salary_paid);
    const salaryPending = nonNegNum(body.salary_pending);
    const nextPayout    = nullableDate(body.next_payout);

    await getPool().query(
      `INSERT INTO ${TABLE} (month_year, total_payable, salary_paid, salary_pending, next_payout)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_payable  = VALUES(total_payable),
         salary_paid    = VALUES(salary_paid),
         salary_pending = VALUES(salary_pending),
         next_payout    = VALUES(next_payout)`,
      [monthYear, totalPayable, salaryPaid, salaryPending, nextPayout],
    );
    const [rows] = await getPool().query<any[]>(
      `SELECT * FROM ${TABLE} WHERE month_year=? LIMIT 1`,
      [monthYear],
    );
    return jsonOk({ row: rows[0] });
  } catch (err: any) {
    return jsonErr(err?.message ?? 'Server error');
  }
}
