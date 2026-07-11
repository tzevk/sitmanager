import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

const fmtMoney = (n: number) =>
  `Rs. ${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Single-page fee receipt PDF, used as an email attachment (see /api/fee-details/[studentId]/[feesId]/email). */
export async function buildFeeReceiptPdf(params: {
  studentName?: string | null;
  studentId: string | number;
  courseName?: string | null;
  batchCode?: string | null;
  receiptNo: string;
  receiptDate: string;
  particular: string;
  paymentType: string;
  amount: number;
  taxType?: string | null;
}): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const logoPath = path.join(process.cwd(), 'public', 'sit.png');
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, doc.page.margins.left, doc.page.margins.top, { height: 44 });
  }
  doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(15)
    .text('Suvidya Institute of Technology', doc.page.margins.left, doc.page.margins.top + 4, { width: pageWidth, align: 'center' });
  doc.fillColor('#2E3093').font('Helvetica-Bold').fontSize(12)
    .text('Fee Receipt', doc.page.margins.left, doc.page.margins.top + 24, { width: pageWidth, align: 'center' });

  let y = doc.page.margins.top + 70;
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).strokeColor('#d1d5db').lineWidth(1).stroke();
  y += 20;

  const rows: [string, string][] = [
    ['Receipt No', params.receiptNo],
    ['Receipt Date', params.receiptDate],
    ['Student Name', params.studentName || '—'],
    ['Student ID', String(params.studentId)],
    ...(params.courseName ? [['Course', params.courseName] as [string, string]] : []),
    ...(params.batchCode ? [['Batch Code', params.batchCode] as [string, string]] : []),
    ['Particular', params.particular],
    ['Payment Type', params.paymentType],
    ...(params.taxType ? [['Tax Type', params.taxType] as [string, string]] : []),
  ];

  const labelW = 150;
  for (const [label, value] of rows) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#6b7280').text(label, doc.page.margins.left, y, { width: labelW });
    doc.font('Helvetica').fontSize(10).fillColor('#111827').text(value, doc.page.margins.left + labelW, y, { width: pageWidth - labelW });
    y += 22;
  }

  y += 10;
  doc.rect(doc.page.margins.left, y, pageWidth, 34).fill('#2E3093');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13)
    .text(`Amount Paid: ${fmtMoney(params.amount)}`, doc.page.margins.left, y + 10, { width: pageWidth, align: 'center' });
  y += 34 + 20;

  doc.fillColor('#9ca3af').font('Helvetica').fontSize(8)
    .text('This is a system-generated receipt for your records.', doc.page.margins.left, y, { width: pageWidth, align: 'center' });

  doc.end();
  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
