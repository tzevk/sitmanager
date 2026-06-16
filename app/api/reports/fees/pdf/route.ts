/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getPool } from '@/lib/db';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
      'am.Batch_Id = ?',
    ];
    const params: any[] = [Number(batchId)];
    if (courseId) { conditions.push('bm.Course_Id = ?'); params.push(Number(courseId)); }

    const [students] = await pool.query<any[]>(
      `SELECT
         am.Student_Id, MAX(am.Admission_Date) AS Admission_Date, MAX(am.Fees) AS Fees,
         COALESCE(MAX(sm.Student_Name), MAX(CONCAT_WS(' ', sm.FName, sm.MName, sm.LName)), '') AS Student_Name,
         COALESCE(MAX(bm.Batch_code),'') AS Batch_Code, MAX(bm.Fees_Full_Payment) AS Fees_Full_Payment,
         MAX(bm.SDate) AS SDate, MAX(bm.EDate) AS EDate,
         COALESCE(MAX(cm.Course_Name),'') AS Course_Name,
         COALESCE(MAX(sm.Moved_To_Batch_Code), '') AS Moved_To_Batch_Code,
         COALESCE(NULLIF(TRIM(MAX(sm.Transfered)), ''), '') AS Transfered,
         CASE WHEN LOWER(TRIM(CAST(MAX(COALESCE(am.Cancel,'')) AS CHAR))) IN ('yes','1','true') THEN 1 ELSE 0 END AS Cancelled
       FROM admission_master am
       LEFT JOIN student_master sm ON sm.Student_Id = am.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
       LEFT JOIN batch_mst bm ON bm.Batch_Id = am.Batch_Id
       LEFT JOIN course_mst cm ON cm.Course_Id = bm.Course_Id
       WHERE ${conditions.join(' AND ')}
       GROUP BY am.Student_Id
       ORDER BY Student_Name ASC`,
      params
    );

    if (!students.length) {
      return NextResponse.json({ error: 'No students found for this batch' }, { status: 404 });
    }

    const studentIds = students.map(s => s.Student_Id);
    const [payments] = await pool.query<any[]>(
      `SELECT Student_Id, SUM(Total_Amt) AS Paid
       FROM s_fees_mst
       WHERE Student_Id IN (?) AND TypeR = 'C' AND (IsDelete = 0 OR IsDelete IS NULL)
       GROUP BY Student_Id`,
      [studentIds]
    );

    const paidByStudent = new Map<number, number>();
    for (const p of payments) {
      paidByStudent.set(Number(p.Student_Id), Number(p.Paid) || 0);
    }

    // ── Build PDF ─────────────────────────────────────────────────
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const logoPath = path.join(process.cwd(), 'public', 'sit.png');
    const hasLogo = fs.existsSync(logoPath);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const pageBottom = doc.page.height - doc.page.margins.bottom;
    const colWidths = [35, 270, 70, 70, 70]; // S.No, Student Name, Amount, Paid Amount, Rem Amount
    const colX: number[] = [];
    let acc = doc.page.margins.left;
    for (const w of colWidths) { colX.push(acc); acc += w; }
    const tableRight = doc.page.margins.left + pageWidth;

    const drawCell = (x: number, y: number, w: number, h: number, text: string, opts: {
      bold?: boolean; align?: 'left' | 'center' | 'right'; size?: number; fill?: string; textColor?: string;
    } = {}) => {
      if (opts.fill) doc.rect(x, y, w, h).fill(opts.fill);
      doc.strokeColor('#d1d5db').lineWidth(0.75).rect(x, y, w, h).stroke();
      const size = opts.size ?? 9;
      const lines = text.split('\n');
      const lineHeight = size * 1.15;
      const startY = y + h / 2 - (lines.length * lineHeight) / 2 + (lineHeight - size) / 2;
      doc.fillColor(opts.textColor ?? '#111827')
        .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(size);
      lines.forEach((line, i) => {
        doc.text(line, x + 5, startY + i * lineHeight, { width: w - 10, align: opts.align ?? 'left' });
      });
    };

    const headers = ['S.No', 'Student Name', 'Amount', 'Paid Amount', 'Rem Amount'];
    const headerH = 24;
    const rowH = 22;

    const drawTableHeader = (y: number) => {
      headers.forEach((h, i) => {
        drawCell(colX[i], y, colWidths[i], headerH, h, {
          bold: true, align: i >= 2 ? 'center' : (i === 0 ? 'center' : 'left'), size: 9.5, fill: '#2E3093', textColor: '#ffffff',
        });
      });
      return y + headerH;
    };

    const first = students[0];
    const drawReportHeader = () => {
      const headerY = doc.page.margins.top;
      if (hasLogo) {
        doc.image(logoPath, doc.page.margins.left, headerY, { height: 40 });
      }
      doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(13)
        .text('Suvidya Institute of Technology', doc.page.margins.left, headerY, { width: pageWidth, align: 'center' });
      doc.fillColor('#2E3093').font('Helvetica-Bold').fontSize(12)
        .text('Batch Wise Fees Report', doc.page.margins.left, headerY + 18, { width: pageWidth, align: 'center' });

      let y = headerY + 44;

      const infoH = 44;
      const halfW = pageWidth / 2;
      drawCell(doc.page.margins.left, y, halfW, infoH / 2, `Training Programme : ${first.Course_Name || '—'}`, { bold: true, size: 9 });
      drawCell(doc.page.margins.left + halfW, y, halfW, infoH / 2, `Batch Start Date : ${fmtDate(fromDate || first.SDate)}`, { bold: true, size: 9 });
      drawCell(doc.page.margins.left, y + infoH / 2, halfW, infoH / 2, `Batch Code : ${first.Batch_Code || '—'}`, { bold: true, size: 9 });
      drawCell(doc.page.margins.left + halfW, y + infoH / 2, halfW, infoH / 2, `Batch End Date : ${fmtDate(toDate || first.EDate)}`, { bold: true, size: 9 });

      y += infoH;
      return drawTableHeader(y);
    };

    let y = drawReportHeader();

    const rowStatus = (stu: any): 'Cancelled' | 'Transferred' | 'Active' => {
      if (Number(stu.Cancelled) === 1) return 'Cancelled';
      if (String(stu.Transfered ?? '').trim().toLowerCase() === 'yes') return 'Transferred';
      return 'Active';
    };

    const statusRowFill: Record<string, string> = {
      Active:      '#ffffff',
      Cancelled:   '#FEE2E2',
      Transferred: '#FEF3C7',
    };
    const statusAltFill: Record<string, string> = {
      Active:      '#F9FAFB',
      Cancelled:   '#FEE2E2',
      Transferred: '#FEF3C7',
    };
    const statusTextColor: Record<string, string> = {
      Active:      '#111827',
      Cancelled:   '#B91C1C',
      Transferred: '#A16207',
    };

    let grandAmount = 0;
    let grandPaid = 0;
    let grandRem = 0;

    students.forEach((stu, idx) => {
      if (y + rowH > pageBottom) {
        doc.addPage();
        y = drawReportHeader();
      }

      const status = rowStatus(stu);
      const rowFill = idx % 2 === 0 ? statusRowFill[status] : statusAltFill[status];
      const textColor = statusTextColor[status];

      const amount = Number(stu.Fees ?? stu.Fees_Full_Payment ?? 0);
      const paid = paidByStudent.get(Number(stu.Student_Id)) ?? 0;
      const rem = amount - paid;

      grandAmount += amount;
      grandPaid += paid;
      grandRem += rem;

      let nameLabel = stu.Student_Name || '—';
      if (status === 'Cancelled')   nameLabel += '  [Cancelled]';
      if (status === 'Transferred') nameLabel += `  [Transferred${stu.Moved_To_Batch_Code ? ` → ${stu.Moved_To_Batch_Code}` : ''}]`;

      drawCell(colX[0], y, colWidths[0], rowH, String(idx + 1), { align: 'center', fill: rowFill, textColor });
      drawCell(colX[1], y, colWidths[1], rowH, nameLabel, { bold: true, fill: rowFill, textColor });
      drawCell(colX[2], y, colWidths[2], rowH, fmtMoney(amount), { align: 'right', fill: rowFill, textColor });
      drawCell(colX[3], y, colWidths[3], rowH, fmtMoney(paid), { align: 'right', fill: rowFill, textColor });
      drawCell(colX[4], y, colWidths[4], rowH, fmtMoney(rem), {
        align: 'right', fill: rowFill,
        textColor: status !== 'Active' ? textColor : (rem > 0 ? '#B91C1C' : '#15803D'),
      });
      y += rowH;
    });

    if (y + rowH > pageBottom) {
      doc.addPage();
      y = drawReportHeader();
    }

    // ── Grand total row ─────────────────────────────────────────────
    drawCell(colX[0], y, colWidths[0] + colWidths[1], rowH, 'Grand Total', { bold: true, align: 'center', fill: '#F3F4F6' });
    drawCell(colX[2], y, colWidths[2], rowH, fmtMoney(grandAmount), { bold: true, align: 'right', fill: '#F3F4F6' });
    drawCell(colX[3], y, colWidths[3], rowH, fmtMoney(grandPaid), { bold: true, align: 'right', fill: '#F3F4F6' });
    drawCell(colX[4], y, colWidths[4], rowH, fmtMoney(grandRem), { bold: true, align: 'right', fill: '#F3F4F6' });
    y += rowH;

    // ── Legend ──────────────────────────────────────────────────────
    y += 10;
    if (y + 14 > pageBottom) { doc.addPage(); y = doc.page.margins.top; }
    const legendItems: [string, string, string][] = [
      ['#FEE2E2', '#B91C1C', 'Cancelled'],
      ['#FEF3C7', '#A16207', 'Transferred'],
      ['#F9FAFB', '#111827', 'Active'],
    ];
    let lx = doc.page.margins.left;
    doc.font('Helvetica').fontSize(7.5).fillColor('#6B7280').text('Legend:', lx, y + 2);
    lx += 40;
    legendItems.forEach(([bg, fg, label]) => {
      doc.rect(lx, y, 10, 10).fill(bg).strokeColor('#d1d5db').lineWidth(0.5).stroke();
      doc.fillColor(fg).font('Helvetica').fontSize(7.5).text(label, lx + 13, y + 1.5);
      lx += 13 + doc.widthOfString(label) + 16;
    });

    // ── Footer ──────────────────────────────────────────────────────
    doc.fillColor('#9ca3af').font('Helvetica').fontSize(8)
      .text(`Generated on ${fmtDate(new Date())}`, doc.page.margins.left, doc.page.height - doc.page.margins.bottom - 10, {
        width: pageWidth, align: 'right',
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
