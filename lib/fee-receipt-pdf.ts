import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { amountToWords, toSentenceCase } from '@/lib/amount-to-words';

const fmtMoney = (n: number) =>
  `Rs. ${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Fee receipt PDF used as an email attachment (see
 * /api/fee-details/[studentId]/[feesId]/email) — mirrors the wording and
 * layout of the printed receipt (app/dashboard/fee-details/[studentId]/page.tsx
 * renderReceipt) rather than a generic label/value summary, so the emailed
 * copy matches what would come out of Print Receipt.
 */
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
  chequeNo?: string | null;
  bank?: string | null;
  branch?: string | null;
  chequeDate?: string | null;
  cancelled?: boolean;
  transferred?: boolean;
  movedFromBatchCode?: string | null;
  movedToBatchCode?: string | null;
}): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const logoPath = path.join(process.cwd(), 'public', 'sit.png');
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;
  const showCheque = ['Cheque', 'DD', 'PDC'].includes(params.paymentType || '');

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, left, doc.page.margins.top, { height: 44 });
  }
  doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(13)
    .text('PAYMENT RECEIPT', left, doc.page.margins.top + 2, { width: pageWidth, align: 'center' });
  doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(16)
    .text('Suvidya Institute of Technology Private Limited', left, doc.page.margins.top + 20, { width: pageWidth, align: 'center' });
  doc.fillColor('#4b5563').font('Helvetica').fontSize(9)
    .text('Regd. Office : 18/140 Anand Nagar, Nehru Road, Vakola, Santacruz (E), Mumbai - 400 055. Tel.: 022 26682290, 9821569885', left, doc.page.margins.top + 42, { width: pageWidth, align: 'center' });

  let y = doc.page.margins.top + 68;
  doc.font('Helvetica').fontSize(11).fillColor('#111827')
    .text(`Receipt No.: ${params.receiptNo}`, left, y, { continued: false })
    .text(`Date : ${params.receiptDate}`, left + pageWidth - 160, y, { width: 160, align: 'right' });
  y += 20;

  if (params.cancelled || params.transferred) {
    const tag = [
      params.cancelled ? 'CANCELLED' : '',
      params.transferred
        ? `TRANSFERRED${params.movedFromBatchCode && params.movedToBatchCode ? ` ${params.movedFromBatchCode} -> ${params.movedToBatchCode}` : params.movedToBatchCode ? ` -> ${params.movedToBatchCode}` : ''}`
        : '',
    ].filter(Boolean).join('   ');
    doc.fillColor('#B91C1C').font('Helvetica-Bold').fontSize(9).text(tag, left, y);
    y += 16;
  }

  y += 10;
  const amtWords = amountToWords(params.amount);
  const line = (text: string) => {
    doc.font('Helvetica').fontSize(11).fillColor('#111827').text(text, left, y, { width: pageWidth });
    y += 20;
  };
  line(`Received with thanks from ${toSentenceCase(params.studentName)}`);
  line(`the sum of rupees ${amtWords} as`);
  line(`Course fees for ${toSentenceCase(params.courseName || params.particular)} by ${toSentenceCase(params.paymentType)}${params.chequeNo ? ` No. ${params.chequeNo}` : ''}`);
  if (showCheque) {
    line(`Dated ${params.chequeDate || params.receiptDate} drawn on ${toSentenceCase(params.bank || '')}`);
  }

  y += 6;
  doc.font('Helvetica').fontSize(11).fillColor('#111827')
    .text(`Note : ${toSentenceCase(params.particular)}${showCheque && params.branch ? `   Branch: ${toSentenceCase(params.branch)}` : ''}`, left, y, { width: pageWidth - 170 });
  doc.rect(left + pageWidth - 160, y - 6, 160, 34).lineWidth(2).strokeColor('#111827').stroke();
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827')
    .text(`RS. ${fmtMoney(params.amount).replace('Rs. ', '')}`, left + pageWidth - 160, y + 4, { width: 160, align: 'center' });
  y += 44;

  if (params.taxType) {
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text(`Tax Type: ${params.taxType}`, left, y);
    y += 16;
  }

  y += 8;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Notes:', left, y);
  y += 14;
  const notes = [
    'Payment by cheque shall be subject to realization of cheque.',
    'In case cheque bounces, receipt will be automatically cancelled.',
    'Payment strictly not refundable or transferable.',
  ];
  doc.font('Helvetica').fontSize(8).fillColor('#374151');
  for (const note of notes) {
    doc.text(`•  ${note}`, left, y, { width: pageWidth });
    y += 12;
  }

  y += 20;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827')
    .text('This is computer generated receipt, signature does not required.', left, y, { width: pageWidth, align: 'center' });

  doc.end();
  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
