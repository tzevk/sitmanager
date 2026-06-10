/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { sendFeeReceiptEmail } from '@/lib/mailer';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ studentId: string; feesId: string }> }) {
  const auth = await requirePermission(req, ['report_fees.update', 'finance.update']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { studentId, feesId } = await ctx.params;
    const sid = Number(studentId);
    const fid = Number(feesId);
    if (!sid || !fid) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const pool = getPool();

    const [studentRows] = await pool.query<any[]>(
      `SELECT sm.Student_Id, sm.Student_Name, sm.Email,
              cm.Course_Name, sm.Batch_Code
       FROM student_master sm
       LEFT JOIN course_mst cm ON cm.Course_Id = sm.Course_Id
       WHERE sm.Student_Id = ?`,
      [sid]
    );
    const student = studentRows[0];
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    if (!student.Email) return NextResponse.json({ error: 'Student does not have an email address on file' }, { status: 400 });

    const [feeRows] = await pool.query<any[]>(
      `SELECT Fees_Id, Fees_Code, Payment_Type, Amount, Notes, RDate
       FROM s_fees_mst WHERE Fees_Id = ? AND Student_Id = ?`,
      [fid, sid]
    );
    const fee = feeRows[0];
    if (!fee) return NextResponse.json({ error: 'Fee record not found' }, { status: 404 });

    let particular = fee.Notes ?? '';
    let taxType: string | null = null;
    if (particular.includes('| Tax:')) {
      const [p, t] = particular.split('| Tax:');
      particular = p.trim();
      taxType = t.trim();
    }

    const fmtDate = (d: any) => {
      if (!d) return '—';
      const s = String(d).slice(0, 10);
      const [y, m, day] = s.split('-');
      return `${day}/${m}/${y}`;
    };

    await sendFeeReceiptEmail({
      toEmail: student.Email,
      studentName: student.Student_Name,
      studentId: sid,
      courseName: student.Course_Name,
      batchCode: student.Batch_Code,
      receiptNo: fee.Fees_Code,
      receiptDate: fmtDate(fee.RDate),
      particular: particular || '—',
      paymentType: fee.Payment_Type ?? '—',
      amount: Number(fee.Amount) || 0,
      taxType,
    });

    return NextResponse.json({ success: true, email: student.Email });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}
