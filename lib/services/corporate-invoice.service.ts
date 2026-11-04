/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool } from '@/lib/db';

// ── Types ─────────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'Unpaid' | 'Partly Paid' | 'Paid' | 'Overdue' | 'Cancelled';

export interface CorporateInvoiceInput {
  Inquiry_Id: number;
  Invoice_Date: string;
  Due_Date?: string | null;
  Bill_To_Name: string;
  Bill_To_Address?: string | null;
  Bill_To_GSTIN?: string | null;
  Place_Of_Supply?: string | null;
  Description: string;
  Taxable_Amount: number;
  GST_Percent: number;
  Interstate?: boolean;
  Notes?: string | null;
}

export interface CorporatePaymentInput {
  Payment_Date: string;
  Amount: number;
  Mode?: string | null;
  Reference_No?: string | null;
  TDS_Amount?: number | null;
  Remarks?: string | null;
}

// ── Schema ────────────────────────────────────────────────────────────────────

let schemaReady: Promise<void> | null = null;

export function ensureCorporateInvoiceSchema(): Promise<void> {
  if (!schemaReady) {
    const pool = getPool();
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS corporate_invoice (
          Id INT AUTO_INCREMENT PRIMARY KEY,
          Inquiry_Id INT NOT NULL,
          Invoice_No VARCHAR(40) NOT NULL,
          Fin_Year VARCHAR(9) NOT NULL,
          Seq INT NOT NULL,
          Invoice_Date DATE NOT NULL,
          Due_Date DATE NULL,
          Bill_To_Name VARCHAR(255) NOT NULL,
          Bill_To_Address TEXT NULL,
          Bill_To_GSTIN VARCHAR(20) NULL,
          Place_Of_Supply VARCHAR(100) NULL,
          Description TEXT NOT NULL,
          Taxable_Amount DECIMAL(12,2) NOT NULL DEFAULT 0,
          GST_Percent DECIMAL(5,2) NOT NULL DEFAULT 18,
          Interstate TINYINT(1) NOT NULL DEFAULT 0,
          GST_Amount DECIMAL(12,2) NOT NULL DEFAULT 0,
          Total_Amount DECIMAL(12,2) NOT NULL DEFAULT 0,
          Notes TEXT NULL,
          Cancelled TINYINT(1) NOT NULL DEFAULT 0,
          Created_By INT NULL,
          Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
          Updated_At DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_corp_invoice_no (Invoice_No),
          UNIQUE KEY uq_corp_invoice_seq (Fin_Year, Seq),
          KEY idx_corp_invoice_inquiry (Inquiry_Id)
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS corporate_invoice_payment (
          Id INT AUTO_INCREMENT PRIMARY KEY,
          Invoice_Id INT NOT NULL,
          Payment_Date DATE NOT NULL,
          Amount DECIMAL(12,2) NOT NULL,
          TDS_Amount DECIMAL(12,2) NOT NULL DEFAULT 0,
          Mode VARCHAR(30) NULL,
          Reference_No VARCHAR(100) NULL,
          Remarks VARCHAR(500) NULL,
          Created_By INT NULL,
          Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
          KEY idx_corp_payment_invoice (Invoice_Id)
        )
      `);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Validation / business-rule error, surfaced to the user as HTTP 400. */
const bad = (message: string) => Object.assign(new Error(message), { status: 400 });

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Indian financial year (Apr–Mar) for a YYYY-MM-DD date, e.g. "2026-27". */
export function finYearOf(date: string): string {
  const [y, m] = date.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

function computeAmounts(taxable: number, gstPercent: number) {
  const t = round2(Math.max(0, Number(taxable) || 0));
  const gst = round2((t * (Number(gstPercent) || 0)) / 100);
  return { taxable: t, gst, total: round2(t + gst) };
}

function validateInvoice(input: CorporateInvoiceInput) {
  if (!Number.isInteger(input.Inquiry_Id) || input.Inquiry_Id <= 0) throw bad('Corporate inquiry is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.Invoice_Date || '')) throw bad('Invoice date is required');
  if (input.Due_Date && !/^\d{4}-\d{2}-\d{2}$/.test(input.Due_Date)) throw bad('Invalid due date');
  if (!input.Bill_To_Name?.trim()) throw bad('Bill-to name is required');
  if (!input.Description?.trim()) throw bad('Description is required');
  if (!(Number(input.Taxable_Amount) > 0)) throw bad('Amount must be greater than 0');
  const pct = Number(input.GST_Percent);
  if (!(pct >= 0 && pct <= 28)) throw bad('GST % must be between 0 and 28');
}

export function statusOf(row: { Total_Amount: any; Paid_Amount: any; Due_Date: any; Cancelled: any }): InvoiceStatus {
  if (Number(row.Cancelled)) return 'Cancelled';
  const total = Number(row.Total_Amount) || 0;
  const paid = Number(row.Paid_Amount) || 0;
  if (paid >= total - 0.5) return 'Paid';
  const due = row.Due_Date ? String(row.Due_Date).slice(0, 10) : null;
  const today = new Date().toISOString().slice(0, 10);
  if (due && due < today) return 'Overdue';
  return paid > 0 ? 'Partly Paid' : 'Unpaid';
}

// Paid = cash received + TDS deducted by the client (TDS counts towards settling the invoice).
const PAID_SUBQUERY = `(SELECT COALESCE(SUM(p.Amount + p.TDS_Amount),0) FROM corporate_invoice_payment p WHERE p.Invoice_Id = ci.Id)`;

function decorate(row: any) {
  const paid = round2(Number(row.Paid_Amount) || 0);
  const total = round2(Number(row.Total_Amount) || 0);
  return {
    ...row,
    Taxable_Amount: Number(row.Taxable_Amount),
    GST_Percent: Number(row.GST_Percent),
    GST_Amount: Number(row.GST_Amount),
    Total_Amount: total,
    Paid_Amount: paid,
    Balance: Number(row.Cancelled) ? 0 : round2(Math.max(0, total - paid)),
    Status: statusOf(row),
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listCorporateInvoices(opts: { search?: string; status?: string; inquiryId?: number }) {
  await ensureCorporateInvoiceSchema();
  const pool = getPool();
  const where: string[] = ['1=1'];
  const params: any[] = [];
  if (opts.inquiryId) { where.push('ci.Inquiry_Id = ?'); params.push(opts.inquiryId); }
  if (opts.search) {
    where.push('(ci.Invoice_No LIKE ? OR ci.Bill_To_Name LIKE ? OR q.CompanyName LIKE ?)');
    const s = `%${opts.search}%`;
    params.push(s, s, s);
  }
  const [rows] = await pool.query<any[]>(
    `SELECT ci.*, q.CompanyName, ${PAID_SUBQUERY} AS Paid_Amount
     FROM corporate_invoice ci
     LEFT JOIN corporate_inquiry q ON q.Id = ci.Inquiry_Id
     WHERE ${where.join(' AND ')}
     ORDER BY ci.Invoice_Date DESC, ci.Id DESC
     LIMIT 1000`,
    params
  );
  let invoices = (rows || []).map(decorate);
  const summary = invoices.reduce(
    (acc, r) => {
      if (r.Status === 'Cancelled') return acc;
      acc.invoiced += r.Total_Amount;
      acc.received += r.Paid_Amount;
      acc.outstanding += r.Balance;
      if (r.Status === 'Overdue') { acc.overdue += r.Balance; acc.overdueCount += 1; }
      return acc;
    },
    { invoiced: 0, received: 0, outstanding: 0, overdue: 0, overdueCount: 0 }
  );
  if (opts.status) invoices = invoices.filter((r) => r.Status === opts.status);
  return { invoices, summary: Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, round2(Number(v))])) };
}

export async function getCorporateInvoice(id: number) {
  await ensureCorporateInvoiceSchema();
  const pool = getPool();
  const [rows] = await pool.query<any[]>(
    `SELECT ci.*, q.CompanyName, q.FullName AS ContactName, q.Email AS ContactEmail, q.Mobile AS ContactMobile,
            ${PAID_SUBQUERY} AS Paid_Amount
     FROM corporate_invoice ci
     LEFT JOIN corporate_inquiry q ON q.Id = ci.Inquiry_Id
     WHERE ci.Id = ? LIMIT 1`,
    [id]
  );
  if (!rows?.[0]) return null;
  const [payments] = await pool.query<any[]>(
    `SELECT * FROM corporate_invoice_payment WHERE Invoice_Id = ? ORDER BY Payment_Date, Id`,
    [id]
  );
  return {
    ...decorate(rows[0]),
    payments: (payments || []).map((p: any) => ({ ...p, Amount: Number(p.Amount), TDS_Amount: Number(p.TDS_Amount) })),
  };
}

/** Values to pre-fill a new invoice from the corporate inquiry and its saved proposal quotation. */
export async function getInvoicePrefill(inquiryId: number) {
  const pool = getPool();
  const [inq] = await pool.query<any[]>(
    `SELECT Id, CompanyName, FullName, Address, City, State, Pin FROM corporate_inquiry WHERE Id = ? LIMIT 1`,
    [inquiryId]
  );
  const q = inq?.[0];
  if (!q) return null;
  let taxable = 0;
  let gstPercent = 18;
  let description = '';
  let billTo = q.CompanyName || q.FullName || '';
  let address = [q.Address, q.City, q.State, q.Pin].filter((v: any) => String(v ?? '').trim()).join(', ');
  try {
    const [prop] = await pool.query<any[]>(
      `SELECT ProposalTitle, QuotationData FROM corporate_proposal WHERE Inquiry_Id = ? LIMIT 1`,
      [inquiryId]
    );
    const p = prop?.[0];
    if (p) {
      description = p.ProposalTitle ? `Corporate Training on ${p.ProposalTitle}` : '';
      const qd = p.QuotationData ? JSON.parse(String(p.QuotationData)) : null;
      if (qd) {
        for (const sec of qd.sections || []) {
          for (const item of sec.items || []) {
            const t = Number(item.total) || 0;
            taxable += t > 0 ? t : (Number(item.days) || 0) * (Number(item.perDay) || 0);
          }
        }
        if (qd.gstPercent !== undefined && qd.gstPercent !== '') gstPercent = Number(qd.gstPercent) || 0;
        if (qd.recipientCompany) billTo = qd.recipientCompany;
        if (qd.recipientAddress) address = qd.recipientAddress;
      }
    }
  } catch { /* proposal table may not exist yet */ }
  const [existing] = await pool.query<any[]>(
    `SELECT COALESCE(SUM(Taxable_Amount),0) AS billed FROM corporate_invoice WHERE Inquiry_Id = ? AND Cancelled = 0`,
    [inquiryId]
  ).catch(() => [[{ billed: 0 }]] as any);
  const alreadyBilled = Number(existing?.[0]?.billed) || 0;
  return {
    Inquiry_Id: inquiryId,
    CompanyName: q.CompanyName || '',
    Bill_To_Name: billTo,
    Bill_To_Address: address,
    Description: description || 'Corporate Training',
    Quoted_Taxable: round2(taxable),
    Already_Billed: round2(alreadyBilled),
    Taxable_Amount: round2(Math.max(0, taxable - alreadyBilled)),
    GST_Percent: gstPercent,
  };
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createCorporateInvoice(input: CorporateInvoiceInput, userId: number | null) {
  validateInvoice(input);
  await ensureCorporateInvoiceSchema();
  const amounts = computeAmounts(input.Taxable_Amount, input.GST_Percent);
  const fy = finYearOf(input.Invoice_Date);
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    // Lock the FY's rows so two people saving at once can't take the same number.
    const [seqRows] = await conn.query<any[]>(
      `SELECT COALESCE(MAX(Seq),0) AS s FROM corporate_invoice WHERE Fin_Year = ? FOR UPDATE`,
      [fy]
    );
    const seq = Number(seqRows?.[0]?.s || 0) + 1;
    const invoiceNo = `SIT/CT/${fy}/${String(seq).padStart(4, '0')}`;
    const [res] = await conn.query<any>(
      `INSERT INTO corporate_invoice
        (Inquiry_Id, Invoice_No, Fin_Year, Seq, Invoice_Date, Due_Date, Bill_To_Name, Bill_To_Address,
         Bill_To_GSTIN, Place_Of_Supply, Description, Taxable_Amount, GST_Percent, Interstate,
         GST_Amount, Total_Amount, Notes, Created_By)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        input.Inquiry_Id, invoiceNo, fy, seq, input.Invoice_Date, input.Due_Date || null,
        input.Bill_To_Name.trim(), input.Bill_To_Address?.trim() || null,
        input.Bill_To_GSTIN?.trim().toUpperCase() || null, input.Place_Of_Supply?.trim() || null,
        input.Description.trim(), amounts.taxable, Number(input.GST_Percent) || 0, input.Interstate ? 1 : 0,
        amounts.gst, amounts.total, input.Notes?.trim() || null, userId,
      ]
    );
    await conn.commit();
    return { id: Number(res.insertId), invoiceNo };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateCorporateInvoice(id: number, input: CorporateInvoiceInput) {
  validateInvoice(input);
  await ensureCorporateInvoiceSchema();
  const amounts = computeAmounts(input.Taxable_Amount, input.GST_Percent);
  const pool = getPool();
  const [paidRows] = await pool.query<any[]>(
    `SELECT COALESCE(SUM(Amount + TDS_Amount),0) AS paid FROM corporate_invoice_payment WHERE Invoice_Id = ?`,
    [id]
  );
  if (Number(paidRows?.[0]?.paid || 0) > amounts.total + 0.5) {
    throw bad('Invoice total cannot be less than the amount already received');
  }
  // Invoice number and FY never change after creation.
  await pool.query(
    `UPDATE corporate_invoice SET
       Invoice_Date=?, Due_Date=?, Bill_To_Name=?, Bill_To_Address=?, Bill_To_GSTIN=?, Place_Of_Supply=?,
       Description=?, Taxable_Amount=?, GST_Percent=?, Interstate=?, GST_Amount=?, Total_Amount=?, Notes=?
     WHERE Id=?`,
    [
      input.Invoice_Date, input.Due_Date || null, input.Bill_To_Name.trim(), input.Bill_To_Address?.trim() || null,
      input.Bill_To_GSTIN?.trim().toUpperCase() || null, input.Place_Of_Supply?.trim() || null,
      input.Description.trim(), amounts.taxable, Number(input.GST_Percent) || 0, input.Interstate ? 1 : 0,
      amounts.gst, amounts.total, input.Notes?.trim() || null, id,
    ]
  );
}

export async function setInvoiceCancelled(id: number, cancelled: boolean) {
  await ensureCorporateInvoiceSchema();
  const pool = getPool();
  if (cancelled) {
    const [rows] = await pool.query<any[]>(`SELECT COUNT(*) AS n FROM corporate_invoice_payment WHERE Invoice_Id = ?`, [id]);
    if (Number(rows?.[0]?.n || 0) > 0) throw bad('Remove the payments before cancelling this invoice');
  }
  await pool.query(`UPDATE corporate_invoice SET Cancelled = ? WHERE Id = ?`, [cancelled ? 1 : 0, id]);
}

export async function addInvoicePayment(invoiceId: number, input: CorporatePaymentInput, userId: number | null) {
  await ensureCorporateInvoiceSchema();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.Payment_Date || '')) throw bad('Payment date is required');
  const amount = round2(Number(input.Amount) || 0);
  const tds = round2(Math.max(0, Number(input.TDS_Amount) || 0));
  if (!(amount > 0) && !(tds > 0)) throw bad('Amount must be greater than 0');
  const inv = await getCorporateInvoice(invoiceId);
  if (!inv) throw bad('Invoice not found');
  if (inv.Status === 'Cancelled') throw bad('Invoice is cancelled');
  if (amount + tds > inv.Balance + 0.5) throw bad(`Amount exceeds the balance of ₹${inv.Balance.toLocaleString('en-IN')}`);
  await getPool().query(
    `INSERT INTO corporate_invoice_payment (Invoice_Id, Payment_Date, Amount, TDS_Amount, Mode, Reference_No, Remarks, Created_By)
     VALUES (?,?,?,?,?,?,?,?)`,
    [invoiceId, input.Payment_Date, amount, tds, input.Mode?.trim() || null, input.Reference_No?.trim() || null,
     input.Remarks?.trim() || null, userId]
  );
}

export async function deleteInvoicePayment(invoiceId: number, paymentId: number) {
  await ensureCorporateInvoiceSchema();
  await getPool().query(`DELETE FROM corporate_invoice_payment WHERE Id = ? AND Invoice_Id = ?`, [paymentId, invoiceId]);
}
