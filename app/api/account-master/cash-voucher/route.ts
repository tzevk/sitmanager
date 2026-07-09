/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { ensureCashVoucherColumns, generateVoucherNo } from '@/lib/cash-voucher';

// GET — list every cash voucher in the DB (paginated), newest first, with each
// voucher's line-item total so the list can show it without a second round trip.
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.view');
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getPool();
    await ensureCashVoucherColumns(pool);
    const { searchParams } = new URL(req.url);

    const page   = Math.max(1, Number(searchParams.get('page'))  || 1);
    const limit  = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';

    const conditions = ['v.deleted = 0'];
    const params: any[] = [];
    if (search) {
      conditions.push('(v.voucherno LIKE ? OR v.paidto LIKE ? OR v.company LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const where = conditions.join(' AND ');

    // Paginate the header table first (cheap, PK-ordered), then look up each of the
    // ~25 rows' totals via an indexed scalar subquery — avoids joining/grouping
    // across the entire (21,000+ row) child table on every request.
    const [rows, [countRows]] = await Promise.all([
      pool.query(
        `SELECT v.id, v.company, v.voucherno, v.date, v.paidto, v.paidby,
                v.prepaired_by, v.approved_by, v.checked_by, v.opening_balance,
                (SELECT COALESCE(SUM(c.amount), 0) FROM awt_cashvoucherchild c
                 WHERE c.voucherid = v.id AND c.deleted = 0) AS total_amount
         FROM awt_cashvoucher v
         WHERE ${where}
         ORDER BY v.id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ).then(([r]) => r as any[]),
      pool.query(
        `SELECT COUNT(*) AS total FROM awt_cashvoucher v WHERE ${where}`,
        params
      ) as unknown as Promise<[any[], any]>,
    ]);

    const total = (countRows as any[])[0]?.total || 0;

    return NextResponse.json({
      vouchers: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — create a new cash voucher + its expense line items, auto-generating the
// voucher number from the (company-independent) "C-{MM}/{seq}" scheme already in
// use for the 6,000+ existing rows.
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.create');
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getPool();
    await ensureCashVoucherColumns(pool);
    const body = await req.json().catch(() => ({}));

    const company = String(body?.company ?? '').trim();
    const date = String(body?.date ?? '').trim();
    const paidTo = String(body?.paidTo ?? '').trim();
    const openingBalance = body?.openingBalance !== '' && body?.openingBalance != null
      ? Number(body.openingBalance)
      : null;
    const paidBy = String(body?.paidBy ?? '').trim() || null;
    const preparedBy = String(body?.preparedBy ?? '').trim() || null;

    if (!date) return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    if (!paidTo) return NextResponse.json({ error: 'Paid To is required' }, { status: 400 });

    const items = Array.isArray(body?.items) ? body.items : [];
    const validItems = items.filter((it: any) => Number(it?.amount) > 0);

    const voucherno = await generateVoucherNo(pool, date);

    const [insertResult] = await pool.query(
      `INSERT INTO awt_cashvoucher
         (company, voucherno, date, paidto, paidby, prepaired_by, opening_balance, created_date, updated_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [company, voucherno, date, paidTo, paidBy, preparedBy, openingBalance]
    ) as [any, any];
    const voucherId = insertResult.insertId;

    if (validItems.length) {
      const values = validItems.map((it: any) => [
        voucherId,
        it.billNo ? String(it.billNo).trim() : null,
        it.date ? String(it.date).trim() : date,
        it.accountHead ? String(it.accountHead).trim() : null,
        Number(it.amount),
        it.description ? String(it.description).trim() : null,
        it.project ? String(it.project).trim() : null,
        it.trainingProgramme ? String(it.trainingProgramme).trim() : null,
        it.batchCode ? String(it.batchCode).trim() : null,
      ]);
      await pool.query(
        `INSERT INTO awt_cashvoucherchild
           (voucherid, bill_no, date, account_head, amount, description, project, training_programee, batch_code, created_date, updated_date)
         VALUES ?`,
        [values.map((v: any[]) => [...v, new Date(), new Date()])]
      );
    }

    return NextResponse.json({ success: true, id: voucherId, voucherno });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
