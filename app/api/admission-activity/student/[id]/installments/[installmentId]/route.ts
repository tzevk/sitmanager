/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { ensureInstallmentPlanTable } from '@/lib/student-installments';

// PATCH — edit due date / amount / notes, or mark an installment Paid / Pending.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; installmentId: string }> }) {
  const auth = await requirePermission(req, 'student.update');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, installmentId } = await ctx.params;
    const studentId = Number(id);
    const rowId = Number(installmentId);
    if (!studentId || !rowId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const pool = getPool();
    await ensureInstallmentPlanTable(pool);
    const body = await req.json().catch(() => ({}));

    const setClauses: string[] = [];
    const values: any[] = [];

    if (body.dueDate !== undefined) { setClauses.push('Due_Date = ?'); values.push(body.dueDate || null); }
    if (body.amount !== undefined) { setClauses.push('Amount = ?'); values.push(Number(body.amount) || 0); }
    if (body.notes !== undefined) { setClauses.push('Notes = ?'); values.push(String(body.notes ?? '').trim() || null); }

    if (body.markPaid === true) {
      setClauses.push('Status = ?', 'Paid_Date = ?');
      values.push('Paid', new Date().toISOString().slice(0, 10));
    } else if (body.markPaid === false) {
      setClauses.push('Status = ?', 'Paid_Date = ?');
      values.push('Pending', null);
    }

    if (!setClauses.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    values.push(rowId, studentId);
    await pool.query(
      `UPDATE student_installment_plan SET ${setClauses.join(', ')} WHERE Installment_Id = ? AND Student_Id = ?`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — soft-delete a single installment row.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; installmentId: string }> }) {
  const auth = await requirePermission(req, 'student.update');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, installmentId } = await ctx.params;
    const studentId = Number(id);
    const rowId = Number(installmentId);
    if (!studentId || !rowId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const pool = getPool();
    await ensureInstallmentPlanTable(pool);
    await pool.query(
      `UPDATE student_installment_plan SET IsDelete = 1 WHERE Installment_Id = ? AND Student_Id = ?`,
      [rowId, studentId]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
