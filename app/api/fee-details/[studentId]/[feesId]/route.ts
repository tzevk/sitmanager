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
      Amount, Particular, RDate, TaxType, Fees_Code: customFeesCode, Target_Student_Id,
    } = body;

    if (!Amount || !RDate) {
      return NextResponse.json({ error: 'Amount and Receipt Date are required' }, { status: 400 });
    }

    const typeR = Type === 'Debit' ? 'D' : 'C';
    const notes = TaxType ? `${Particular ?? ''} | Tax: ${TaxType}` : (Particular ?? '');
    const amount = Number(Amount);
    const transactionNo = String(Transaction_No ?? PaymentId ?? Cheque_No ?? '').trim() || null;

    const pool = getPool();
    const targetStudentId = Number(Target_Student_Id || sid);
    if (!Number.isInteger(targetStudentId) || targetStudentId <= 0) {
      return NextResponse.json({ error: 'Invalid target student' }, { status: 400 });
    }

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

    if (targetStudentId !== sid) {
      const [targetRows] = await pool.query<any[]>(
        `SELECT sm.Student_Id, sm.Course_Id, bm.Batch_Id, am.Admission_Id
         FROM student_master sm
         LEFT JOIN batch_mst bm ON bm.Batch_code = sm.Batch_Code
         LEFT JOIN admission_master am ON am.Student_Id = sm.Student_Id AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
         WHERE sm.Student_Id = ? AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
         ORDER BY am.Admission_Id DESC
         LIMIT 1`,
        [targetStudentId]
      );
      if (!targetRows.length) {
        return NextResponse.json({ error: 'Target student not found' }, { status: 404 });
      }
      const target = targetRows[0];
      setClauses.push('Student_Id = ?', 'Course_Id = ?', 'Batch_Id = ?', 'Admission_Id = ?');
      setValues.push(targetStudentId, target.Course_Id ?? null, target.Batch_Id ?? null, target.Admission_Id ?? null);
    }

    const [result] = await pool.query<any>(
      `UPDATE s_fees_mst SET ${setClauses.join(', ')} WHERE Fees_Id = ? AND Student_Id = ?`,
      [...setValues, fid, sid]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

  return NextResponse.json({ success: true, Student_Id: targetStudentId });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ studentId: string; feesId: string }> }) {
  const auth = await requirePermission(req, ['report_fees.update', 'finance.update']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { studentId, feesId } = await ctx.params;
    const sid = Number(studentId);
    const fid = Number(feesId);
    if (!sid || !fid) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const pool = getPool();
    const [result] = await pool.query<any>(
      `UPDATE s_fees_mst SET IsDelete = 1 WHERE Fees_Id = ? AND Student_Id = ?`,
      [fid, sid]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}
