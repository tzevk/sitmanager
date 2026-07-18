/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { sendFeeReceiptEmail } from '@/lib/mailer';
import { buildFeeReceiptPdf } from '@/lib/fee-receipt-pdf';

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

    const body = await req.json().catch(() => ({}));
    const customMessage = typeof body?.message === 'string' ? body.message.trim() : '';
    const attachReceipt = body?.attachReceipt !== false; // default true

    const pool = getPool();

    // Same fields the printed receipt uses (student.Cancel/Transfered), so the
    // emailed receipt shows identical status tags to what gets printed.
    const [studentRows] = await pool.query<any[]>(
      `SELECT sm.Student_Id, sm.Student_Name, sm.Email,
              cm.Course_Name, sm.Batch_Code,
              COALESCE(NULLIF(TRIM(sm.Transfered), ''), '') AS Transfered,
              COALESCE(sm.Moved_To_Batch_Code, '') AS Moved_To_Batch_Code,
              COALESCE(sm.Moved_From_Batch_Code, '') AS Moved_From_Batch_Code,
              (SELECT MAX(CASE WHEN LOWER(TRIM(CAST(COALESCE(am.Cancel,'') AS CHAR))) IN ('yes','1','true') THEN 1 ELSE 0 END)
               FROM admission_master am
               WHERE am.Student_Id = sm.Student_Id AND (am.IsDelete = 0 OR am.IsDelete IS NULL)) AS Cancelled
       FROM student_master sm
       LEFT JOIN course_mst cm ON cm.Course_Id = sm.Course_Id
       WHERE sm.Student_Id = ?`,
      [sid]
    );
    const student = studentRows[0];
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    if (!student.Email) return NextResponse.json({ error: 'Student does not have an email address on file' }, { status: 400 });

    const [feeRows] = await pool.query<any[]>(
      `SELECT Fees_Id, Fees_Code, Payment_Type, Amount, Notes, RDate,
              Cheque_No, Cheque_Bank, Cheque_Branch, Cheque_Date, PaymentId
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

    const receiptFields = {
      studentName: student.Student_Name,
      studentId: sid,
      courseName: student.Course_Name,
      batchCode: student.Batch_Code,
      receiptNo: fee.Fees_Code,
      // Raw ISO date — the mail/PDF builders format it the same way the
      // printed receipt does ("18th Jul-2026"), so pass it unformatted.
      receiptDate: fee.RDate ? String(fee.RDate).slice(0, 10) : '',
      particular: particular || '—',
      paymentType: fee.Payment_Type ?? '—',
      amount: Number(fee.Amount) || 0,
      taxType,
      chequeNo: fee.PaymentId || fee.Cheque_No || null,
      bank: fee.Cheque_Bank || null,
      branch: fee.Cheque_Branch || null,
      chequeDate: fee.Cheque_Date ? String(fee.Cheque_Date).slice(0, 10) : null,
      cancelled: Number(student.Cancelled ?? 0) === 1,
      transferred: String(student.Transfered).toLowerCase() === 'yes',
      movedFromBatchCode: student.Moved_From_Batch_Code || null,
      movedToBatchCode: student.Moved_To_Batch_Code || null,
    };

    const attachments = attachReceipt
      ? [{
          filename: `Fee_Receipt_${fee.Fees_Code || fid}.pdf`,
          content: await buildFeeReceiptPdf({ ...receiptFields, receiptDate: fmtDate(fee.RDate) }),
          contentType: 'application/pdf',
        }]
      : undefined;

    await sendFeeReceiptEmail({
      toEmail: student.Email,
      ...receiptFields,
      customMessage,
      attachments,
    });

    return NextResponse.json({ success: true, email: student.Email });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}
