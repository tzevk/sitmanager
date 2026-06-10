/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getPool } from '@/lib/db';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MEMBERSHIP_FEE_AMOUNT = 899;
const MEMBERSHIP_FEE_LABEL = 'One Time Membership Fees - Sitians Alumni Association';

const fmtMoney = (n: number) =>
  (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: any) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${dt.getFullYear()}`;
};

interface LedgerRow {
  date: string;
  desc: string;
  charge: number | null;
  payment: number | null;
  balance: number;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['report_fees.view', 'finance.view']);
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId') || '';
    const batchId  = searchParams.get('batchId') || '';
    const fromDate = searchParams.get('fromDate') || '';
    const toDate   = searchParams.get('toDate') || '';

    if (!batchId) {
      return NextResponse.json({ error: 'batchId is required' }, { status: 400 });
    }

    const conditions: string[] = [
      '(am.IsDelete = 0 OR am.IsDelete IS NULL)',
      '(am.Cancel = 0 OR am.Cancel IS NULL)',
      'am.Batch_Id = ?',
    ];
    const params: any[] = [Number(batchId)];
    if (courseId) { conditions.push('bm.Course_Id = ?'); params.push(Number(courseId)); }

    const [students] = await pool.query<any[]>(
      `SELECT
         am.Student_Id, am.Admission_Date, am.Fees,
         COALESCE(sm.Student_Name, CONCAT_WS(' ', sm.FName, sm.MName, sm.LName), '') AS Student_Name,
         COALESCE(bm.Batch_code,'') AS Batch_Code, bm.Fees_Full_Payment, bm.SDate, bm.EDate,
         COALESCE(cm.Course_Name,'') AS Course_Name
       FROM admission_master am
       LEFT JOIN student_master sm ON sm.Student_Id = am.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
       LEFT JOIN batch_mst bm ON bm.Batch_Id = am.Batch_Id
       LEFT JOIN course_mst cm ON cm.Course_Id = bm.Course_Id
       WHERE ${conditions.join(' AND ')}
       ORDER BY sm.Student_Name ASC`,
      params
    );

    if (!students.length) {
      return NextResponse.json({ error: 'No students found for this batch' }, { status: 404 });
    }

    const studentIds = students.map(s => s.Student_Id);
    const [payments] = await pool.query<any[]>(
      `SELECT Student_Id, Fees_Code, RDate, Date_Added, Total_Amt
       FROM s_fees_mst
       WHERE Student_Id IN (?) AND TypeR = 'C' AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY RDate ASC, Fees_Id ASC`,
      [studentIds]
    );

    const paymentsByStudent = new Map<number, any[]>();
    for (const p of payments) {
      const list = paymentsByStudent.get(p.Student_Id) ?? [];
      list.push(p);
      paymentsByStudent.set(p.Student_Id, list);
    }

    // ── Build PDF ─────────────────────────────────────────────────
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const logoPath = path.join(process.cwd(), 'public', 'sit.png');
    const hasLogo = fs.existsSync(logoPath);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidths = [75, 220, 75, 75, 70]; // Date, Description, Amount, Amount, Balance Payment
    const colX: number[] = [];
    let acc = doc.page.margins.left;
    for (const w of colWidths) { colX.push(acc); acc += w; }
    const tableRight = doc.page.margins.left + pageWidth;

    const drawCell = (x: number, y: number, w: number, h: number, text: string, opts: {
      bold?: boolean; align?: 'left' | 'center' | 'right'; size?: number; fill?: string;
    } = {}) => {
      if (opts.fill) doc.rect(x, y, w, h).fill(opts.fill);
      doc.strokeColor('#1f2937').lineWidth(0.75).rect(x, y, w, h).stroke();
      doc.fillColor('#111827')
        .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(opts.size ?? 9)
        .text(text, x + 5, y + h / 2 - (opts.size ?? 9) / 2, { width: w - 10, align: opts.align ?? 'left' });
    };

    students.forEach((stu, idx) => {
      if (idx > 0) doc.addPage();

      // ── Header band with logo ──────────────────────────────────
      let headerY = doc.page.margins.top;
      if (hasLogo) {
        doc.image(logoPath, doc.page.margins.left, headerY, { height: 42 });
      }
      doc.fillColor('#2E3093').font('Helvetica-Bold').fontSize(16)
        .text('Skill India Training', hasLogo ? doc.page.margins.left + 50 : doc.page.margins.left, headerY + 2, { width: pageWidth - 50 });
      doc.fillColor('#6b7280').font('Helvetica').fontSize(9)
        .text('Student Fee Ledger Statement', hasLogo ? doc.page.margins.left + 50 : doc.page.margins.left, headerY + 22, { width: pageWidth - 50 });

      doc.moveTo(doc.page.margins.left, headerY + 50)
        .lineTo(tableRight, headerY + 50)
        .strokeColor('#FAE452').lineWidth(2.5).stroke();

      let y = headerY + 62;

      // ── Name / Batch / Duration box ────────────────────────────
      const infoH = 50;
      const leftBoxW = colWidths[0] + colWidths[1];
      drawCell(colX[0], y, leftBoxW, infoH / 2, `Name: ${stu.Student_Name || '—'}`, { bold: true, size: 11 });
      drawCell(colX[0], y + infoH / 2, leftBoxW, infoH / 2, `Batch: ${stu.Course_Name || '—'} - ${stu.Batch_Code || '—'}`, { bold: true, size: 11 });

      const durW = colWidths[2];
      drawCell(colX[2], y, durW, infoH, 'Duration', { bold: true, align: 'center', size: 10, fill: '#EEF0FB' });
      const dStart = fromDate || stu.SDate;
      const dEnd = toDate || stu.EDate;
      drawCell(colX[3], y, durW + colWidths[4], infoH / 2, fmtDate(dStart), { bold: true, align: 'center', size: 10 });
      drawCell(colX[3], y + infoH / 2, durW + colWidths[4], infoH / 2, fmtDate(dEnd), { bold: true, align: 'center', size: 10 });

      y += infoH;

      // ── Table header ────────────────────────────────────────────
      const headers = ['Date', 'Description', 'Amount', 'Amount', 'Balance Payment'];
      const headerH = 28;
      headers.forEach((h, i) => {
        drawCell(colX[i], y, colWidths[i], headerH, h, { bold: true, align: i >= 2 ? 'center' : 'left', size: 10, fill: '#2E3093' });
        doc.fillColor('#ffffff');
      });
      // re-draw header text in white over fill
      headers.forEach((h, i) => {
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10)
          .text(h, colX[i] + 5, y + headerH / 2 - 5, { width: colWidths[i] - 10, align: i >= 2 ? 'center' : 'left' });
      });
      y += headerH;

      // ── Build ledger rows ───────────────────────────────────────
      const rows: LedgerRow[] = [];
      const admDate = fmtDate(stu.Admission_Date) || fmtDate(stu.SDate);
      const totalFee = Number(stu.Fees ?? stu.Fees_Full_Payment ?? 0);
      const tuitionFee = Math.max(totalFee - MEMBERSHIP_FEE_AMOUNT, 0);

      let runningBalance = 0;
      runningBalance += tuitionFee;
      rows.push({
        date: admDate,
        desc: `Tuition Fees - ${stu.Course_Name || ''}, Batch - ${stu.Batch_Code || ''}`,
        charge: tuitionFee, payment: null, balance: runningBalance,
      });

      runningBalance += MEMBERSHIP_FEE_AMOUNT;
      rows.push({
        date: admDate,
        desc: MEMBERSHIP_FEE_LABEL,
        charge: MEMBERSHIP_FEE_AMOUNT, payment: null, balance: runningBalance,
      });

      const studentPayments = paymentsByStudent.get(stu.Student_Id) ?? [];
      for (const p of studentPayments) {
        const amt = Number(p.Total_Amt) || 0;
        runningBalance -= amt;
        rows.push({
          date: fmtDate(p.RDate || p.Date_Added),
          desc: `Payment Received - ${p.Fees_Code ?? ''}`,
          charge: null, payment: amt, balance: runningBalance,
        });
      }

      const totalCharge = rows.reduce((s, r) => s + (r.charge ?? 0), 0);
      const totalPayment = rows.reduce((s, r) => s + (r.payment ?? 0), 0);

      // ── Table body ──────────────────────────────────────────────
      const rowH = 24;
      const minRows = 13;
      const blankRows = Math.max(0, minRows - rows.length);

      for (const r of rows) {
        drawCell(colX[0], y, colWidths[0], rowH, r.date, { align: 'center' });
        drawCell(colX[1], y, colWidths[1], rowH, r.desc, {});
        drawCell(colX[2], y, colWidths[2], rowH, r.charge != null ? fmtMoney(r.charge) : '', { align: 'right' });
        drawCell(colX[3], y, colWidths[3], rowH, r.payment != null ? fmtMoney(r.payment) : '', { align: 'right' });
        drawCell(colX[4], y, colWidths[4], rowH, fmtMoney(r.balance), { align: 'right', bold: true });
        y += rowH;
      }

      for (let i = 0; i < blankRows; i++) {
        for (let c = 0; c < colWidths.length; c++) {
          drawCell(colX[c], y, colWidths[c], rowH, '', {});
        }
        y += rowH;
      }

      // ── Totals row ──────────────────────────────────────────────
      drawCell(colX[0], y, colWidths[0] + colWidths[1], rowH, 'Total >>>', { bold: true, align: 'center', fill: '#F3F4F6' });
      drawCell(colX[2], y, colWidths[2], rowH, fmtMoney(totalCharge), { bold: true, align: 'right', fill: '#F3F4F6' });
      drawCell(colX[3], y, colWidths[3], rowH, fmtMoney(totalPayment), { bold: true, align: 'right', fill: '#F3F4F6' });
      drawCell(colX[4], y, colWidths[4], rowH, fmtMoney(runningBalance), { bold: true, align: 'right', fill: '#F3F4F6' });
      y += rowH;

      // ── Footer ──────────────────────────────────────────────────
      doc.fillColor('#9ca3af').font('Helvetica').fontSize(8)
        .text(`Generated on ${fmtDate(new Date())}`, doc.page.margins.left, doc.page.height - doc.page.margins.bottom - 10, {
          width: pageWidth, align: 'right',
        });
    });

    doc.end();
    const pdfBuffer: Buffer = await new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="fees-batch-${batchId}.pdf"`,
      },
    });
  } catch (err: unknown) {
    console.error('[Fees Report PDF] error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
