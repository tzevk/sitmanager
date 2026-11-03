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
    const [balance, [rows], [infoRows]] = await Promise.all([
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
      pool.query(
        `SELECT c.Course_Name,
                DATE_FORMAT(COALESCE(am.Admission_Date, sm.Admission_Dt), '%Y-%m-%d') AS Admission_Date
         FROM student_master sm
         LEFT JOIN course_mst c ON c.Course_Id = sm.Course_Id
         LEFT JOIN admission_master am
           ON am.Student_Id = sm.Student_Id AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
         WHERE sm.Student_Id = ?
         ORDER BY am.Admission_Id DESC
         LIMIT 1`,
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

    // The course fee (and ₹899 membership when not yet posted) isn't a ledger
    // row — add it as the opening debit so debits sum to Total Fees.
    const postedDebits = transactions.reduce((sum, t) => sum + t.debit, 0);
    const courseFee = balance.totalFees - postedDebits;
    const info = (infoRows as any[])[0] ?? {};
    if (courseFee > 0) {
      transactions.unshift({
        id: 0,
        date: info.Admission_Date || null,
        receiptNo: '',
        type: 'Charge',
        mode: '',
        reference: '',
        bank: '',
        particular: info.Course_Name ? `Course Fees — ${info.Course_Name}` : 'Course Fees',
        debit: courseFee,
        credit: 0,
      });
    }

    // Remaining = amount still owed after each entry: course fee first, then date order.
    const ordered = [...transactions].sort((a, b) =>
      (a.id === 0 ? -1 : b.id === 0 ? 1 : 0)
      || String(a.date || '').localeCompare(String(b.date || ''))
      || (b.debit - a.debit) || a.id - b.id);
    let running = 0;
    const remaining = new Map<number, number>();
    for (const t of ordered) {
      running += t.debit - t.credit;
      remaining.set(t.id, running);
    }

    return NextResponse.json({
      ...balance,
      transactions: ordered.map((t) => ({ ...t, remaining: remaining.get(t.id) ?? 0 })),
    });
  } catch (err: unknown) {
    console.error('Student fees summary GET error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
