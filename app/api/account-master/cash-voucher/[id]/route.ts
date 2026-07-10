/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { ensureCashVoucherColumns } from '@/lib/cash-voucher';

// GET — single voucher + its expense line items (used by the Edit and Print pages).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'finance.view');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await ctx.params;
    const voucherId = Number(id);
    if (!voucherId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const pool = getPool();
    await ensureCashVoucherColumns(pool);

    const [voucherRows] = await pool.query(
      `SELECT id, COALESCE(NULLIF(company, ''), 'SUVIDYA') AS company, voucherno, date, paidto, paidby, prepaired_by, approved_by, checked_by
       FROM awt_cashvoucher WHERE id = ? AND deleted = 0 LIMIT 1`,
      [voucherId]
    ) as [any[], any];
    if (!voucherRows.length) return NextResponse.json({ error: 'Cash voucher not found' }, { status: 404 });

    const [items] = await pool.query(
      `SELECT id, bill_no, date, account_head, amount, description, project, training_programee, batch_code
       FROM awt_cashvoucherchild WHERE voucherid = ? AND deleted = 0 ORDER BY id ASC`,
      [voucherId]
    );

    return NextResponse.json({ voucher: voucherRows[0], items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH — edit a voucher's header + fully replace its line items (simplest correct
// model: soft-delete existing item rows, insert the submitted set fresh).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'finance.update');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await ctx.params;
    const voucherId = Number(id);
    if (!voucherId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const pool = getPool();
    await ensureCashVoucherColumns(pool);
    const body = await req.json().catch(() => ({}));

    const company = String(body?.company ?? '').trim();
    const date = String(body?.date ?? '').trim();
    const paidTo = String(body?.paidTo ?? '').trim();
    const paidBy = String(body?.paidBy ?? '').trim() || null;
    const preparedBy = String(body?.preparedBy ?? '').trim() || null;

    if (!date) return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    if (!paidTo) return NextResponse.json({ error: 'Paid To is required' }, { status: 400 });

    await pool.query(
      `UPDATE awt_cashvoucher SET
         company = ?, date = ?, paidto = ?, paidby = ?, prepaired_by = ?, updated_date = NOW()
       WHERE id = ? AND deleted = 0`,
      [company, date, paidTo, paidBy, preparedBy, voucherId]
    );

    const items = Array.isArray(body?.items) ? body.items : [];
    const validItems = items.filter((it: any) => Number(it?.amount) > 0);

    await pool.query(`UPDATE awt_cashvoucherchild SET deleted = 1 WHERE voucherid = ?`, [voucherId]);

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
        new Date(),
        new Date(),
      ]);
      await pool.query(
        `INSERT INTO awt_cashvoucherchild
           (voucherid, bill_no, date, account_head, amount, description, project, training_programee, batch_code, created_date, updated_date)
         VALUES ?`,
        [values]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — soft-delete the voucher (and its line items, for consistency).
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'finance.delete');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await ctx.params;
    const voucherId = Number(id);
    if (!voucherId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const pool = getPool();
    await pool.query(`UPDATE awt_cashvoucher SET deleted = 1 WHERE id = ?`, [voucherId]);
    await pool.query(`UPDATE awt_cashvoucherchild SET deleted = 1 WHERE voucherid = ?`, [voucherId]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
