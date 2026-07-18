import { readFile } from 'fs/promises';
import path from 'path';
import { amountToWords, formatReceiptDate, toSentenceCase } from '@/lib/amount-to-words';

/**
 * Server-side rebuild of the exact receipt markup/CSS used by
 * app/dashboard/fee-details/[studentId]/page.tsx's renderReceipt/copy()
 * function, so a PDF rendered from this HTML (see lib/receipt-pdf-render.ts)
 * is pixel-identical to what Print Receipt produces in the browser. Keep
 * both in sync if the print template changes.
 */
export async function buildReceiptHtml(params: {
  studentName?: string | null;
  courseName?: string | null;
  receiptNo: string;
  receiptDate: string; // ISO yyyy-mm-dd
  particular: string;
  paymentType: string;
  amount: number;
  chequeNo?: string | null;
  bank?: string | null;
  branch?: string | null;
  chequeDate?: string | null; // ISO yyyy-mm-dd
  cancelled?: boolean;
  transferred?: boolean;
  movedFromBatchCode?: string | null;
  movedToBatchCode?: string | null;
}): Promise<string> {
  let logoSrc = '';
  try {
    const logoPath = path.join(process.cwd(), 'public', 'sit.png');
    const buf = await readFile(logoPath);
    logoSrc = `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    // logo optional — receipt still renders without it
  }

  const fmt = (n: number) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const showCheque = ['Cheque', 'DD', 'PDC'].includes(params.paymentType || '');
  const amtWords = amountToWords(params.amount);
  const receiptDateFmt = formatReceiptDate(params.receiptDate) || params.receiptDate;
  const chequeDateFmt = params.chequeDate ? (formatReceiptDate(params.chequeDate) || params.chequeDate) : receiptDateFmt;
  const refNo = params.chequeNo || '';
  const transferredYes = Boolean(params.transferred);

  const statusLine = (params.cancelled || transferredYes)
    ? `<div class="status-line">
        ${params.cancelled ? '<span class="status-tag status-cancelled">CANCELLED</span>' : ''}
        ${transferredYes ? `<span class="status-tag status-transferred">TRANSFERRED${params.movedFromBatchCode && params.movedToBatchCode ? ` ${params.movedFromBatchCode} &rarr; ${params.movedToBatchCode}` : params.movedToBatchCode ? ` &rarr; ${params.movedToBatchCode}` : ''}</span>` : ''}
      </div>`
    : '';

  const receipt = `
    <div class="receipt">
      <div class="top-row">
        ${logoSrc ? `<img src="${logoSrc}" alt="SIT" class="logo" />` : '<div class="logo"></div>'}
        <div class="copy-tag">Student Copy</div>
      </div>
      <div class="header">
        <div class="receipt-label">PAYMENT RECEIPT</div>
        <div class="org-name">Suvidya Institute of Technology Private Limited</div>
        <div class="org-addr">Regd. Office : 18/140 Anand Nagar, Nehru Road, Vakola, Santacruz (E),<br />Mumbai - 400 055. Tel.: 022 26682290, 9821569885</div>
      </div>
      <div class="meta-line">
        <div>Receipt No.: <span class="strong">${params.receiptNo}</span></div>
        <div>Date : <span class="strong">${receiptDateFmt}</span></div>
      </div>
      ${statusLine}
      <div class="body">
        <div class="line-row">Received with thanks from <span class="fill name">${toSentenceCase(params.studentName)}</span></div>
        <div class="line-row">the sum of rupees <span class="fill words">${amtWords}</span> as</div>
        <div class="course-row">
          <span>Course fees for</span><span class="fill course">${toSentenceCase(params.courseName || params.particular)}</span>
          <span>by</span><span class="fill mode">${toSentenceCase(params.paymentType)}</span>
          <span>No.</span><span class="fill ref">${refNo}</span>
        </div>
        <div class="course-row second">
          <span>Dated</span><span class="fill dated">${showCheque ? chequeDateFmt : receiptDateFmt}</span>
          <span>drawn on</span><span class="fill drawn">${toSentenceCase(showCheque ? (params.bank || '') : '')}</span>
        </div>
        <div class="note-row">
          <span>Note :</span><span class="fill note">${toSentenceCase(params.particular)}</span>
          <span>Branch</span><span class="fill branch">${toSentenceCase(showCheque ? (params.branch || '') : '')}</span>
          <span class="amount-box">RS. ${fmt(params.amount)}</span>
        </div>
        <div class="notes-title">Notes:</div>
        <ul class="notes-list">
          <li>Payment by cheque shall be subject to realization of cheque.</li>
          <li>In case cheque bounces, receipt will be automatically cancelled.</li>
          <li>Payment strictly not refundable or transferable.</li>
        </ul>
      </div>
      <div class="footer-text">This is computer generated receipt signature does not required.</div>
      <div class="cut-line"></div>
    </div>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Receipt ${params.receiptNo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #000; background: #fff; font-size: 14px; }
  .receipt { width: 100%; padding: 28px 28px 12px; background: #fff; }
  .top-row { display: flex; align-items: flex-start; justify-content: space-between; }
  .logo { width: 235px; height: auto; object-fit: contain; }
  .copy-tag { margin-top: 58px; margin-right: 55px; font-size: 14px; }
  .header { text-align: center; margin-top: 0; }
  .receipt-label { font-size: 18px; font-weight: 700; margin-bottom: 18px; }
  .org-name { font-size: 24px; font-weight: 700; margin-bottom: 6px; }
  .org-addr { font-size: 12px; line-height: 1.4; }
  .meta-line { display: flex; justify-content: space-between; margin-top: 44px; font-size: 14px; }
  .status-line { display: flex; gap: 10px; margin-top: 10px; }
  .status-tag { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.03em; border: 1.5px solid; }
  .status-cancelled { color: #B91C1C; border-color: #B91C1C; background: #FEE2E2; }
  .status-transferred { color: #A16207; border-color: #A16207; background: #FEF3C7; }
  .strong { font-size: 16px; font-weight: 400; margin-left: 24px; }
  .body { margin-top: 24px; }
  .line-row, .course-row, .note-row { display: flex; align-items: baseline; gap: 8px; margin-top: 24px; white-space: nowrap; }
  .course-row, .note-row { flex-wrap: wrap; }
  .fill { display: inline-block; border-bottom: 2px dotted #222; text-align: center; min-height: 20px; font-size: 16px; }
  .name { width: 650px; }
  .words { width: 630px; }
  .course { width: 460px; white-space: normal; word-break: break-word; line-height: 1.3; }
  .mode { width: 100px; }
  .ref { width: 140px; }
  .dated { width: 145px; }
  .drawn { width: 455px; }
  .note { width: 300px; white-space: normal; word-break: break-word; line-height: 1.3; }
  .branch { width: 160px; }
  .amount-box { margin-left: auto; border: 3px solid #111; padding: 10px 46px; font-size: 18px; font-weight: 700; }
  .notes-title { margin-top: 22px; font-size: 16px; }
  .notes-list { margin-top: 0; padding-left: 18px; font-size: 12px; line-height: 1.15; }
  .footer-text { margin-top: 28px; text-align: center; font-size: 18px; font-weight: 700; }
  .cut-line { margin-top: 22px; border-top: 4px dashed #111; }
</style></head><body>
${receipt}
</body></html>`;
}
