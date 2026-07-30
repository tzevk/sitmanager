/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Admitted-students PDF for one batch — same Status_id = 8 definition the CBD
// dashboard's "Confirmed Admissions" count uses, so this always matches that number.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const batchCode = (searchParams.get('batchCode') || '').trim();
    if (!batchCode) {
      return NextResponse.json({ error: 'batchCode is required' }, { status: 400 });
    }

    const pool = getPool();
    const [students] = await pool.query<any[]>(
      `SELECT
         sm.Student_Id, sm.Student_Name, sm.Present_Mobile, sm.Email,
         sm.Batch_Code, COALESCE(c.Course_Name, '') AS Course_Name, sm.Admission_Dt
       FROM student_master sm
       LEFT JOIN course_mst c ON c.Course_Id = sm.Course_Id
       WHERE sm.Batch_Code = ?
         AND sm.Status_id = 8
         AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
       ORDER BY sm.Student_Name ASC`,
      [batchCode]
    );

    // ── Build PDF ─────────────────────────────────────────────────
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const logoPath = path.join(process.cwd(), 'public', 'sit.png');
    const hasLogo = fs.existsSync(logoPath);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const pageBottom = doc.page.height - doc.page.margins.bottom;
    const colWidths = [30, 55, 130, 75, 130, 40]; // Sr, ID, Name, Mobile, Email, Adm. Date
    const colX: number[] = [];
    let acc = doc.page.margins.left;
    for (const w of colWidths) { colX.push(acc); acc += w; }

    const drawCell = (x: number, y: number, w: number, h: number, text: string, opts: {
      bold?: boolean; align?: 'left' | 'center' | 'right'; size?: number; fill?: string; textColor?: string;
    } = {}) => {
      if (opts.fill) doc.rect(x, y, w, h).fill(opts.fill);
      doc.strokeColor('#d1d5db').lineWidth(0.75).rect(x, y, w, h).stroke();
      const size = opts.size ?? 8.5;
      doc.fillColor(opts.textColor ?? '#111827')
        .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(size)
        .text(text, x + 4, y + h / 2 - size / 2, { width: w - 8, align: opts.align ?? 'left' });
    };

    const headers = ['S.No', 'ID', 'Name', 'Mobile', 'Email', 'Adm. Date'];
    const headerH = 22;
    const rowH = 20;

    const drawTableHeader = (y: number) => {
      headers.forEach((h, i) => {
        drawCell(colX[i], y, colWidths[i], headerH, h, {
          bold: true, align: i === 0 ? 'center' : 'left', size: 9, fill: '#2E3093', textColor: '#ffffff',
        });
      });
      return y + headerH;
    };

    const courseName = students[0]?.Course_Name || '';

    const drawReportHeader = () => {
      const headerY = doc.page.margins.top;
      if (hasLogo) doc.image(logoPath, doc.page.margins.left, headerY, { height: 36 });
      doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(13)
        .text('Suvidya Institute of Technology', doc.page.margins.left, headerY, { width: pageWidth, align: 'center' });
      doc.fillColor('#2E3093').font('Helvetica-Bold').fontSize(11)
        .text('Admitted Students Report', doc.page.margins.left, headerY + 17, { width: pageWidth, align: 'center' });

      let y = headerY + 42;
      const halfW = pageWidth / 2;
      drawCell(doc.page.margins.left, y, halfW, 16, `Batch Code: ${batchCode}`, { bold: true, size: 9 });
      drawCell(doc.page.margins.left + halfW, y, halfW, 16, `Training Programme: ${courseName || '—'}`, { bold: true, size: 9 });
      y += 16;
      drawCell(doc.page.margins.left, y, pageWidth, 16, `Total Admitted: ${students.length}`, { bold: true, size: 9 });
      y += 20;

      return drawTableHeader(y);
    };

    let y = drawReportHeader();

    students.forEach((stu, idx) => {
      if (y + rowH > pageBottom) {
        doc.addPage();
        y = drawReportHeader();
      }
      const fill = idx % 2 === 0 ? '#ffffff' : '#F9FAFB';
      drawCell(colX[0], y, colWidths[0], rowH, String(idx + 1), { align: 'center', fill });
      drawCell(colX[1], y, colWidths[1], rowH, String(stu.Student_Id ?? ''), { fill });
      drawCell(colX[2], y, colWidths[2], rowH, stu.Student_Name || '—', { bold: true, fill });
      drawCell(colX[3], y, colWidths[3], rowH, stu.Present_Mobile || '—', { fill });
      drawCell(colX[4], y, colWidths[4], rowH, stu.Email || '—', { fill });
      drawCell(colX[5], y, colWidths[5], rowH, stu.Admission_Dt || '—', { align: 'center', fill });
      y += rowH;
    });

    if (!students.length) {
      drawCell(colX[0], y, pageWidth, rowH, 'No admitted students found for this batch', { align: 'center', fill: '#F9FAFB' });
    }

    doc.fillColor('#9ca3af').font('Helvetica').fontSize(8)
      .text(`Generated on ${new Date().toLocaleDateString('en-IN')}`, doc.page.margins.left, doc.page.height - doc.page.margins.bottom - 10, {
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
        'Content-Disposition': `inline; filename="admitted-students-${batchCode}.pdf"`,
      },
    });
  } catch (err: unknown) {
    console.error('[Batch Admissions PDF] error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
