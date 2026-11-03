/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { computeStudentFeeBalance } from '@/lib/fee-balance';

/**
 * Read-only fees summary for the Student Master "Fees Summary" tab: totals
 * (same formula as Fee Details / Fee Report via computeStudentFeeBalance) and
 * every fee transaction on the student's ledger. Unlike /api/fee-details/[id],
 * this never writes (no discount self-heal), so viewing a student is safe.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'student.view');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await ctx.params;
    const studentId = Number(id);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return NextResponse.json({ error: 'Invalid student id' }, { status: 400 });
    }

    const pool = getPool();
    const [balance, [rows]] = await Promise.all([
      computeStudentFeeBalance(pool, studentId),
      pool.query(
        `SELECT Fees_Id, Fees_Code, TypeR, Payment_Type, Cheque_No, PaymentId, Cheque_Bank,
                COALESCE(Total_Amt, Amount, 0) AS Amount, Notes,
                DATE_FORMAT(COALESCE(RDate, Date_Added), '%Y-%m-%d') AS Txn_Date
         FROM s_fees_mst
         WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY COALESCE(RDate, Date_Added) ASC, Fees_Id ASC`,
        [studentId]
      ) as Promise<[any[], any]>,
    ]);

    const transactions = (rows as any[]).map((r) => ({
      id: Number(r.Fees_Id),
      date: r.Txn_Date || null,
      receiptNo: r.Fees_Code || '',
      type: r.TypeR === 'D' ? 'Charge' : 'Payment',
      mode: r.Payment_Type || '',
      reference: r.PaymentId || r.Cheque_No || '',
      bank: r.Cheque_Bank || '',
      particular: String(r.Notes || '').replace(/\s*\|\s*Tax:\s*(CGST|SGST|IGST)\s*$/i, '').trim(),
      debit: r.TypeR === 'D' ? Number(r.Amount) : 0,
      credit: r.TypeR === 'C' ? Number(r.Amount) : 0,
    }));

    return NextResponse.json({ ...balance, transactions });
  } catch (err: unknown) {
    console.error('Student fees summary GET error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
