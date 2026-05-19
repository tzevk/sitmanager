/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';
import { ensureOnce, jsonOk, jsonErr, badRequest, nullableDate } from '@/lib/finance-helpers';
import { collectionHandlers } from '@/lib/finance-resource';
import { FINANCE_CASHFLOW } from '@/lib/finance-tables';

const factory = collectionHandlers(FINANCE_CASHFLOW);

/** Custom GET adds q (free-text) + dateFrom/dateTo filters on top of the factory's type/category. */
export async function GET(req: NextRequest) {
  const limited = await apiRateLimiter(req);
  if (limited) return limited;
  const auth = await requirePermission(req, 'finance.view');
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureOnce(getPool(), FINANCE_CASHFLOW.table, FINANCE_CASHFLOW.ddl);
    const url = new URL(req.url);
    const q        = (url.searchParams.get('q') ?? '').trim();
    const entity   = url.searchParams.get('entity');
    const type     = url.searchParams.get('type');
    const category = url.searchParams.get('category');
    const dateFrom = nullableDate(url.searchParams.get('dateFrom'));
    const dateTo   = nullableDate(url.searchParams.get('dateTo'));

    const where: string[] = [];
    const params: unknown[] = [];
    if (entity)   { where.push('`entity` = ?');   params.push(entity); }
    if (type)     { where.push('`type` = ?');     params.push(type); }
    if (category) { where.push('`category` = ?'); params.push(category); }
    if (dateFrom) { where.push('`date` >= ?');    params.push(dateFrom); }
    if (dateTo)   { where.push('`date` <= ?');    params.push(dateTo); }
    if (q) {
      where.push('(`description` LIKE ? OR `ref_no` LIKE ? OR `category` LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await getPool().query<any[]>(
      `SELECT * FROM ${FINANCE_CASHFLOW.table} ${whereSql} ORDER BY ${FINANCE_CASHFLOW.defaultOrder} LIMIT 1000`,
      params,
    );
    return jsonOk({ rows });
  } catch (err: any) {
    return jsonErr(err?.message ?? 'Server error');
  }
}

export const POST = factory.POST;
// Keep badRequest in scope so tree-shakers don't drop it from the helper bundle when unused.
void badRequest;
