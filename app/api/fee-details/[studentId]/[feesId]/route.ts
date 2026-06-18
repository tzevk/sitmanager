/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function PUT(req: NextRequest, ctx: { params: Promise<{ studentId: string; feesId: string }> }) {
  const auth = await requirePermission(req, ['report_fees.update', 'finance.update']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { studentId, feesId } = await ctx.params;
    const sid = Number(studentId);
    const fid = Number(feesId);
    if (!sid || !fid) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const body = await req.json();
    const {
      Type, Payment_Type, Cheque_Bank, Cheque_No, Transaction_No, PaymentId, Cheque_Date, Cheque_Branch,
      Amount, Particular, RDate, TaxType, Fees_Code: customFeesCode,
    } = body;

    if (!Amount || !RDate) {
      return NextResponse.json({ error: 'Amount and Receipt Date are required' }, { status: 400 });
    }

    const typeR = Type === 'Debit' ? 'D' : 'C';
    const notes = TaxType ? `${Particular ?? ''} | Tax: ${TaxType}` : (Particular ?? '');
    const amount = Number(Amount);
    const transactionNo = String(Transaction_No ?? PaymentId ?? Cheque_No ?? '').trim() || null;

    const pool = getPool();
    const setClauses = [
      'Payment_Type = ?', 'Cheque_Bank = ?', 'Cheque_No = ?', 'PaymentId = ?', 'Cheque_Date = ?', 'Cheque_Branch = ?',
      'Amount = ?', 'Total_Amt = ?', 'TypeR = ?', 'Notes = ?', 'RDate = ?',
    ];
    const setValues: any[] = [
      Payment_Type ?? null, Cheque_Bank ?? null, transactionNo, transactionNo, Cheque_Date || null, Cheque_Branch ?? null,
      amount, amount, typeR, notes, RDate,
    ];
    if (typeof customFeesCode === 'string' && customFeesCode.trim()) {
      setClauses.push('Fees_Code = ?');
      setValues.push(customFeesCode.trim());
    }

    const [result] = await pool.query<any>(
      `UPDATE s_fees_mst SET ${setClauses.join(', ')} WHERE Fees_Id = ? AND Student_Id = ?`,
      [...setValues, fid, sid]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}
