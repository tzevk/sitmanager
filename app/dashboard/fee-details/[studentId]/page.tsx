'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface Student {
  Student_Id: number;
  Student_Name: string;
  Course_Id: number | null;
  Course_Name: string | null;
  Batch_Code: string | null;
  Batch_Id: number | null;
  Present_Mobile: string | null;
  Email: string | null;
  Admission_Id: number | null;
  Transfered: string;
  Moved_To_Batch_Code: string;
  Moved_To_Course_Name: string;
  Cancel: boolean;
}

interface Bank { Id: number; Bank_Name: string; }
interface Particular { label: string; amount: number | null; fixed: boolean; }
interface LedgerRow {
  Fees_Id: number;
  Date: string | null;
  Particular: string;
  Payment_Type: string | null;
  Transaction_No: string | null;
  Fees_Code: string | null;
  Debit: number;
  Credit: number;
}

interface FeeDetailsData {
  student: Student;
  dueDate: string | null;
  banks: Bank[];
  particulars: Particular[];
  ledger: LedgerRow[];
  totals: { debit: number; credit: number; balance: number };
  nextReceiptNo: string;
  record: {
    Fees_Id: number;
    Type: string;
    Fees_Code: string;
    Payment_Type: string | null;
    Cheque_Bank: string | null;
    Cheque_No: string | null;
    PaymentId: string | null;
    Transaction_No: string | null;
    Cheque_Date: string | null;
    Cheque_Branch: string | null;
    Amount: number | null;
    Particular: string;
    TaxType: string;
    RDate: string | null;
  } | null;
}

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors w-full';
const ctrlReadOnly = 'bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 w-full';
const label = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider';
const PAYMENT_TYPES = ['Cash', 'Cheque', 'DD', 'Online', 'UPI', 'Razorpay', 'NEFT', 'PDC'];
const TAX_TYPES = ['CGST', 'SGST', 'IGST'];

const fmt = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function FeeDetailsEditPage() {
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('finance');
  const params = useParams<{ studentId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const feesId = searchParams.get('feesId');

  const [data, setData] = useState<FeeDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [rowActionFeeId, setRowActionFeeId] = useState<number | null>(null);
  const [rowActionType, setRowActionType] = useState<'email' | 'download' | 'delete' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [type, setType] = useState<'Credit' | 'Debit'>('Credit');
  const [paymentType, setPaymentType] = useState('Cash');
  const [bank, setBank] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [branch, setBranch] = useState('');
  const [amount, setAmount] = useState('');
  const [particular, setParticular] = useState('');
  const [receiptDate, setReceiptDate] = useState(todayISO());
  const [taxType, setTaxType] = useState('');
  const [receiptNo, setReceiptNo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const url = `/api/fee-details/${params.studentId}${feesId ? `?feesId=${feesId}` : ''}`;
      const res = await fetch(url);
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'Failed to load'); return; }
      setData(d);

      if (d.record) {
        setType(d.record.Type === 'Debit' ? 'Debit' : 'Credit');
        setPaymentType(d.record.Payment_Type ?? 'Cash');
        setBank(d.record.Cheque_Bank ?? '');
        setChequeNo(d.record.Transaction_No ?? d.record.PaymentId ?? d.record.Cheque_No ?? '');
        setChequeDate(d.record.Cheque_Date ? String(d.record.Cheque_Date).slice(0, 10) : '');
        setBranch(d.record.Cheque_Branch ?? '');
        setAmount(d.record.Amount != null ? String(d.record.Amount) : '');
        setParticular(d.record.Particular ?? '');
        setReceiptDate(d.record.RDate ? String(d.record.RDate).slice(0, 10) : todayISO());
        setTaxType(d.record.TaxType ?? '');
        setReceiptNo(d.record.Fees_Code ?? '');
      } else {
        setParticular(d.particulars?.[0]?.label ?? '');
        setReceiptNo(d.nextReceiptNo ?? '');
      }
    } finally {
      setLoading(false);
    }
  }, [params.studentId, feesId]);

  useEffect(() => { load(); }, [load]);

  const handleParticularChange = (val: string) => {
    setParticular(val);
    const p = data?.particulars.find((x) => x.label === val);
    if (p?.fixed && p.amount != null) setAmount(String(p.amount));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const isChequePayment = ['Cheque', 'DD', 'PDC'].includes(paymentType);
      const needsTransactionNo = paymentType !== 'Cash';
      if (needsTransactionNo && !chequeNo.trim()) {
        setError('Transaction number is required for this payment type.');
        return;
      }
      const body = {
        Type: type,
        Payment_Type: paymentType,
        Cheque_Bank: isChequePayment ? bank : null,
        Cheque_No: needsTransactionNo ? chequeNo.trim() : null,
        Transaction_No: needsTransactionNo ? chequeNo.trim() : null,
        PaymentId: needsTransactionNo ? chequeNo.trim() : null,
        Cheque_Date: isChequePayment ? chequeDate : null,
        Cheque_Branch: isChequePayment ? branch : null,
        Amount: amount,
        Particular: particular,
        RDate: receiptDate,
        TaxType: taxType,
        Fees_Code: receiptNo.trim() || null,
      };

      const url = data?.record
        ? `/api/fee-details/${params.studentId}/${data.record.Fees_Id}`
        : `/api/fee-details/${params.studentId}`;
      const res = await fetch(url, {
        method: data?.record ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'Failed to save'); return; }
      setMessage('Saved successfully');
      if (!data?.record && d.Fees_Id) {
        router.replace(`/dashboard/fee-details/${params.studentId}?feesId=${d.Fees_Id}`);
      }
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleEmailReceipt = async (feesId?: number) => {
    const targetFeesId = feesId ?? data?.record?.Fees_Id;
    if (!targetFeesId) return;
    setError('');
    setMessage('');
    if (feesId) {
      setRowActionFeeId(targetFeesId);
      setRowActionType('email');
    } else {
      setEmailing(true);
    }
    try {
      const res = await fetch(`/api/fee-details/${params.studentId}/${targetFeesId}/email`, {
        method: 'POST',
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'Failed to send email'); return; }
      setMessage(`Receipt emailed to ${d.email}`);
    } finally {
      if (feesId) {
        setRowActionFeeId(null);
        setRowActionType(null);
      } else {
        setEmailing(false);
      }
    }
  };

  const handleDeleteFee = async (targetFeesId: number) => {
    if (!canUpdate) return;
    if (!window.confirm('Delete this fee receipt?')) return;
    setError('');
    setMessage('');
    setRowActionFeeId(targetFeesId);
    setRowActionType('delete');
    try {
      const res = await fetch(`/api/fee-details/${params.studentId}/${targetFeesId}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'Failed to delete receipt'); return; }
      setMessage('Receipt deleted successfully');
      if (data?.record?.Fees_Id === targetFeesId) {
        router.replace(`/dashboard/fee-details/${params.studentId}`);
      }
      await load();
    } finally {
      setRowActionFeeId(null);
      setRowActionType(null);
    }
  };

  const formatReceiptDate = (d: string | null | undefined) => {
    if (!d) return '';
    const s = String(d).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(d);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [y, m, dy] = s.split('-');
    const day = parseInt(dy, 10);
    const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
    return `${day}${suffix} ${months[parseInt(m, 10) - 1]}-${y}`;
  };

  const numToWords = (n: number): string => {
    const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    if (n === 0) return 'ZERO';
    const b100 = (x: number) => (x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ` ${ones[x % 10]}` : ''}`);
    const b1000 = (x: number) => (x < 100 ? b100(x) : `${ones[Math.floor(x / 100)]} HUNDRED${x % 100 ? ` ${b100(x % 100)}` : ''}`);
    let r = '';
    let num = n;
    if (num >= 10000000) { r += `${b1000(Math.floor(num / 10000000))} CRORE `; num %= 10000000; }
    if (num >= 100000) { r += `${b1000(Math.floor(num / 100000))} LAKH `; num %= 100000; }
    if (num >= 1000) { r += `${b100(Math.floor(num / 1000))} THOUSAND `; num %= 1000; }
    if (num > 0) r += b1000(num);
    return r.trim();
  };

  const amountToWords = (a: number) => {
    const cents = Math.round(a * 100);
    const rs = Math.floor(cents / 100);
    const ps = cents % 100;
    return `${numToWords(rs)} RUPEES${ps > 0 ? ` AND ${numToWords(ps)} PAISE` : ''} ONLY`;
  };

  const renderReceipt = (receiptInput: {
    receiptNoVal: string;
    amountValue: number;
    receiptDateValue: string | null | undefined;
    chequeDateValue: string | null | undefined;
    paymentTypeValue: string;
    particularValue: string;
    chequeNoValue: string;
    bankValue: string;
    branchValue: string;
  }) => {
    if (!data) return;
    const w = window.open('', '_blank', 'width=780,height=1100');
    if (!w) return;
    const logo = `${window.location.origin}/sit.png`;

    const amtWords = amountToWords(receiptInput.amountValue);
    const receiptDateFmt = formatReceiptDate(receiptInput.receiptDateValue);
    const chequeDateFmt = formatReceiptDate(receiptInput.chequeDateValue);
    const showCheque = ['Cheque', 'DD', 'PDC'].includes(receiptInput.paymentTypeValue);
    const refNo = receiptInput.chequeNoValue || '';

    const copy = (label: string) => `
      <div class="receipt">
        <div class="top-row">
          <img src="${logo}" alt="SIT" class="logo" />
          <div class="copy-tag">${label}</div>
        </div>
        <div class="header">
          <div class="receipt-label">PAYMENT RECEIPT</div>
          <div class="org-name">Suvidya Institute of Technology Private Limited</div>
          <div class="org-addr">Regd. Office : 18/140 Anand Nagar, Nehru Road, Vakola, Santacruz (E),<br />Mumbai - 400 055. Tel.: 022 26682290, 9821569885</div>
        </div>
        <div class="meta-line">
          <div>Receipt No.: <span class="strong">${receiptInput.receiptNoVal}</span></div>
          <div>Date : <span class="strong">${receiptDateFmt}</span></div>
        </div>
        <div class="body">
          <div class="line-row">Received with thanks from <span class="fill name">${data.student.Student_Name}</span></div>
          <div class="line-row">the sum of rupees <span class="fill words">${amtWords}</span> as</div>
          <div class="course-row">
            <span>Course fees for</span><span class="fill course">${data.student.Course_Name || receiptInput.particularValue || ''}</span>
            <span>by</span><span class="fill mode">${receiptInput.paymentTypeValue}</span>
            <span>No.</span><span class="fill ref">${refNo}</span>
          </div>
          <div class="course-row second">
            <span>Dated</span><span class="fill dated">${showCheque ? chequeDateFmt : receiptDateFmt}</span>
            <span>drawn on</span><span class="fill drawn">${showCheque ? (receiptInput.bankValue || '') : ''}</span>
          </div>
          <div class="note-row">
            <span>Note :</span><span class="fill note">${receiptInput.particularValue || ''}</span>
            <span>Branch</span><span class="fill branch">${showCheque ? (receiptInput.branchValue || '') : ''}</span>
            <span class="amount-box">RS. ${fmt(receiptInput.amountValue)}</span>
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

    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Receipt ${receiptInput.receiptNoVal}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #000; background: #fff; font-size: 14px; }
  .receipt { width: 980px; margin: 0 auto; padding: 48px 52px 22px; background: #fff; page-break-after: always; }
  .top-row { display: flex; align-items: flex-start; justify-content: space-between; }
  .logo { width: 235px; height: auto; object-fit: contain; }
  .copy-tag { margin-top: 58px; margin-right: 55px; font-size: 14px; }
  .header { text-align: center; margin-top: 0; }
  .receipt-label { font-size: 18px; font-weight: 700; margin-bottom: 18px; }
  .org-name { font-size: 24px; font-weight: 700; margin-bottom: 6px; }
  .org-addr { font-size: 12px; line-height: 1.4; }
  .meta-line { display: flex; justify-content: space-between; margin-top: 44px; font-size: 14px; }
  .strong { font-size: 16px; font-weight: 400; margin-left: 24px; }
  .body { margin-top: 24px; }
  .line-row, .course-row, .note-row { display: flex; align-items: baseline; gap: 8px; margin-top: 24px; white-space: nowrap; }
  .fill { display: inline-block; border-bottom: 2px dotted #222; text-align: center; min-height: 20px; font-size: 16px; }
  .name { width: 650px; }
  .words { width: 630px; }
  .course { width: 340px; }
  .mode { width: 120px; }
  .ref { width: 170px; }
  .dated { width: 145px; }
  .drawn { width: 455px; }
  .note { width: 380px; }
  .branch { width: 160px; }
  .amount-box { margin-left: auto; border: 3px solid #111; padding: 10px 46px; font-size: 18px; font-weight: 700; }
  .notes-title { margin-top: 22px; font-size: 16px; }
  .notes-list { margin-top: 0; padding-left: 18px; font-size: 12px; line-height: 1.15; }
  .footer-text { margin-top: 28px; text-align: center; font-size: 18px; font-weight: 700; }
  .cut-line { margin-top: 22px; border-top: 4px dashed #111; }

  @media print {
    @page { size: A4 landscape; margin: 8mm; }
    .receipt { width: 100%; padding: 28px 28px 12px; }
  }
</style></head><body>
${copy('Student Copy')}
<script>window.onload = () => { setTimeout(() => window.print(), 500); };<\/script>
</body></html>`);
    w.document.close();
  };

  const handlePrint = () => {
    renderReceipt({
      receiptNoVal: data?.record?.Fees_Code ?? receiptNo ?? data?.nextReceiptNo ?? '',
      amountValue: Number(amount) || 0,
      receiptDateValue: receiptDate,
      chequeDateValue: chequeDate,
      paymentTypeValue: paymentType,
      particularValue: particular,
      chequeNoValue: chequeNo,
      bankValue: bank,
      branchValue: branch,
    });
  };

  const handleDownloadReceiptForFee = async (feesId: number) => {
    if (!data) return;
    setRowActionFeeId(feesId);
    setRowActionType('download');
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/fee-details/${params.studentId}?feesId=${feesId}`);
      const payload = await res.json();
      if (!res.ok || !payload?.record) {
        setError(payload?.error ?? 'Unable to load transaction for receipt download');
        return;
      }
      renderReceipt({
        receiptNoVal: payload.record.Fees_Code ?? data.nextReceiptNo ?? '',
        amountValue: Number(payload.record.Amount) || 0,
        receiptDateValue: payload.record.RDate,
        chequeDateValue: payload.record.Cheque_Date,
        paymentTypeValue: payload.record.Payment_Type ?? 'Cash',
        particularValue: payload.record.Particular ?? '',
        chequeNoValue: payload.record.Transaction_No ?? payload.record.PaymentId ?? payload.record.Cheque_No ?? '',
        bankValue: payload.record.Cheque_Bank ?? '',
        branchValue: payload.record.Cheque_Branch ?? '',
      });
    } finally {
      setRowActionFeeId(null);
      setRowActionType(null);
    }
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view fee details." />;

  if (loading) {
    return <div className="p-6 text-xs text-slate-400">Loading…</div>;
  }

  if (error && !data) {
    return <div className="p-6 text-xs text-red-600">{error}</div>;
  }

  if (!data) return null;

  const showChequeFields = ['Cheque', 'DD', 'PDC'].includes(paymentType);
  const showTransactionField = paymentType !== 'Cash';
  const transactionLabel = showChequeFields ? 'Cheque / DD No. *' : 'Transaction No. *';

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-3 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-white tracking-tight leading-none">Add / Edit Fees Details</h2>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <p className="text-[11px] text-white/60">{data.student.Student_Name} — Student ID {data.student.Student_Id}</p>
              {data.student.Cancel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 border border-red-400/40 px-2 py-0.5 text-[10px] font-bold text-red-200 uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  Cancelled
                </span>
              )}
              {data.student.Transfered.toLowerCase() === 'yes' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 border border-amber-300/40 px-2 py-0.5 text-[10px] font-bold text-amber-200 uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shrink-0" />
                  Transferred
                  {data.student.Moved_To_Batch_Code && (
                    <span className="font-mono normal-case font-semibold">→ {data.student.Moved_To_Batch_Code}</span>
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/dashboard/fee-details')}
              className="h-9 px-4 rounded-lg border border-white/40 bg-white/10 text-white text-xs font-bold hover:bg-white/20"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !canUpdate}
              className="h-9 px-4 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 disabled:opacity-50"
            >
              {saving ? 'Saving…' : (data.record ? 'Update' : 'Add')}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2">{error}</div>}
      {message && <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3 py-2">{message}</div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/40">
            <h3 className="text-xs font-bold text-slate-700 mb-3">Student Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={label}>Student Name</label>
                <input className={ctrlReadOnly} value={data.student.Student_Name || ''} readOnly />
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Student Id</label>
                <input className={ctrlReadOnly} value={data.student.Student_Id || ''} readOnly />
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Course Name</label>
                <input className={ctrlReadOnly} value={data.student.Course_Name || ''} readOnly />
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Batch Code</label>
                <input className={ctrlReadOnly} value={data.student.Batch_Code || ''} readOnly />
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Contact No.</label>
                <input className={ctrlReadOnly} value={data.student.Present_Mobile || ''} readOnly />
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Email Address</label>
                <input className={ctrlReadOnly} value={data.student.Email || ''} readOnly />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className={label}>Due Date</label>
                <input className={ctrlReadOnly} value={fmtDate(data.dueDate)} readOnly />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-bold text-slate-700 mb-3">Transaction Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={label}>Type *</label>
                <select className={ctrl} value={type} onChange={(e) => setType(e.target.value as 'Credit' | 'Debit')}>
                  <option value="Credit">Credit</option>
                  <option value="Debit">Debit</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Receipt No</label>
                <input type="text" className={ctrl} value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} placeholder="e.g. R-06/052" />
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Payment Type</label>
                <select className={ctrl} value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                  {PAYMENT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>{showTransactionField ? transactionLabel : 'Transaction No.'}</label>
                <input className={ctrl} value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} disabled={!showTransactionField} placeholder={showChequeFields ? 'Enter cheque / DD number' : 'Enter transaction number'} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Bank</label>
                <select className={ctrl} value={bank} onChange={(e) => setBank(e.target.value)} disabled={!showChequeFields}>
                  <option value="">Select Bank Name</option>
                  {data.banks.map((b) => <option key={b.Id} value={b.Bank_Name}>{b.Bank_Name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Cheque Date</label>
                <input type="date" className={ctrl} value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} disabled={!showChequeFields} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Branch</label>
                <input className={ctrl} value={branch} onChange={(e) => setBranch(e.target.value)} disabled={!showChequeFields} placeholder="Branch" />
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Amount (Rs.) *</label>
                <input type="number" className={ctrl} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Particular</label>
                <select className={ctrl} value={particular} onChange={(e) => handleParticularChange(e.target.value)}>
                  <option value="">Select Particular Type</option>
                  {data.particulars.map((p) => (
                    <option key={p.label} value={p.label}>
                      {p.label}{p.fixed && p.amount != null ? ` (₹${p.amount})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Receipt Date *</label>
                <input type="date" className={ctrl} value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className={label}>Tax Type</label>
                <div className="flex gap-5 mt-1 flex-wrap">
              {TAX_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="radio"
                    name="taxType"
                    checked={taxType === t}
                    onChange={() => setTaxType(t)}
                    className="accent-[#2E3093]"
                  />
                  {t}
                </label>
              ))}
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="radio"
                  name="taxType"
                  checked={taxType === ''}
                  onChange={() => setTaxType('')}
                  className="accent-[#2E3093]"
                />
                None
              </label>
                </div>
            </div>
          </div>
        </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !canUpdate}
            className="h-9 px-5 rounded-lg bg-[#2E3093] text-white text-xs font-bold hover:bg-[#252880] disabled:opacity-50"
          >
            {saving ? 'Saving…' : (data.record ? 'Update' : 'Add')}
          </button>
          <button onClick={handlePrint} className="h-9 px-4 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50">
            Print Receipt
          </button>
          <button onClick={handlePrint} className="h-9 px-4 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50">
            Invoice
          </button>
          {data.record && (
            <button
              onClick={() => handleEmailReceipt()}
              disabled={emailing || !data.student.Email}
              title={!data.student.Email ? 'Student does not have an email address on file' : undefined}
              className="h-9 px-4 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {emailing ? 'Sending…' : 'Email Receipt'}
            </button>
          )}
          <button onClick={() => router.push('/dashboard/fee-details')} className="h-9 px-4 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50">
            Close
          </button>
        </div>
      </div>

      {/* Student Account Details */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
          <h3 className="text-xs font-bold text-slate-700">Student Account Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border border-slate-300 bg-slate-50">
                <th className="text-center py-2 px-3 font-bold text-[11px] text-slate-700 border border-slate-300 w-28">Date</th>
                <th className="text-center py-2 px-3 font-bold text-[11px] text-slate-700 border border-slate-300">Description</th>
                <th className="text-center py-2 px-3 font-bold text-[11px] text-slate-700 border border-slate-300 w-32">Receipt No</th>
                <th className="text-center py-2 px-3 font-bold text-[11px] text-slate-700 border border-slate-300 w-44">Transaction</th>
                <th className="text-center py-2 px-3 font-bold text-[11px] text-slate-700 border border-slate-300 w-32">Debit Amount</th>
                <th className="text-center py-2 px-3 font-bold text-[11px] text-slate-700 border border-slate-300 w-32">Credit Amount</th>
                <th className="text-center py-2 px-3 font-bold text-[11px] text-slate-700 border border-slate-300 w-36">Balance Payment</th>
              </tr>
            </thead>
            <tbody>
              {!data.ledger.length && (
                <tr><td colSpan={7} className="py-6 text-center text-xs text-slate-400 border border-slate-300">No transactions yet</td></tr>
              )}
              {(() => {
                let running = 0;
                return data.ledger.map((r) => {
                  running = running + r.Debit - r.Credit;
                  const desc = r.Credit > 0
                    ? `Payment Received${r.Particular ? ` - ${r.Particular}` : ''}`
                    : (r.Particular || '—');
                  return (
                    <tr key={r.Fees_Id} className="group hover:bg-slate-50/40">
                      <td className="py-2 px-3 text-xs border border-slate-300 text-center">{fmtDate(r.Date)}</td>
                      <td className="py-2 px-3 text-xs border border-slate-300">{desc}</td>
                      <td className="py-2 px-3 text-xs border border-slate-300 text-center font-mono">{r.Fees_Code || '—'}</td>
                      <td className="py-2 px-3 text-xs border border-slate-300">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{r.Payment_Type || '—'}</span>
                          <span className="font-mono text-[10px] text-slate-500">{r.Transaction_No || '—'}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-xs border border-slate-300 text-right font-mono">{r.Debit ? fmt(r.Debit) : ''}</td>
                      <td className="py-2 px-3 text-xs border border-slate-300 text-right font-mono">{r.Credit ? fmt(r.Credit) : ''}</td>
                      <td className="relative py-2 px-3 text-xs border border-slate-300 text-right font-mono font-semibold overflow-visible">
                        {fmt(running)}
                        {r.Fees_Id > 0 ? (
                          <div className="absolute right-0 top-1/2 z-10 flex -translate-y-1/2 translate-x-[calc(100%-0.35rem)] items-center gap-1 rounded-l-lg border border-slate-200 bg-white px-1.5 py-1 shadow-md opacity-75 transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100">
                              <span className="h-6 w-1 rounded-full bg-slate-300" aria-hidden />
                              <button
                                onClick={() => router.push(`/dashboard/fee-details/${params.studentId}?feesId=${r.Fees_Id}`)}
                                disabled={!canUpdate}
                                className="h-6 px-2 rounded-md border border-slate-200 text-[10px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteFee(r.Fees_Id)}
                                disabled={!canUpdate || (rowActionFeeId === r.Fees_Id && rowActionType === 'delete')}
                                className="h-6 px-2 rounded-md border border-red-200 text-[10px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
                              >
                                {rowActionFeeId === r.Fees_Id && rowActionType === 'delete' ? 'Deleting' : 'Delete'}
                              </button>
                              {r.Credit > 0 && (
                                <>
                                  <button
                                    onClick={() => handleDownloadReceiptForFee(r.Fees_Id)}
                                    disabled={rowActionFeeId === r.Fees_Id && rowActionType === 'download'}
                                    className="h-6 px-2 rounded-md border border-slate-200 text-[10px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                                  >
                                    {rowActionFeeId === r.Fees_Id && rowActionType === 'download' ? 'Saving' : 'Save'}
                                  </button>
                                  <button
                                    onClick={() => handleEmailReceipt(r.Fees_Id)}
                                    disabled={!data.student.Email || (rowActionFeeId === r.Fees_Id && rowActionType === 'email')}
                                    className="h-6 px-2 rounded-md border border-slate-200 text-[10px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                                  >
                                    {rowActionFeeId === r.Fees_Id && rowActionType === 'email' ? 'Sending' : 'Email'}
                                  </button>
                                </>
                              )}
                          </div>
                        ) : (
                          null
                        )}
                      </td>
                    </tr>
                  );
                });
              })()}
              {data.ledger.length > 0 && (
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-400">
                  <td colSpan={4} className="py-2 px-3 text-xs border border-slate-300 text-right">Total &gt;&gt;&gt;</td>
                  <td className="py-2 px-3 text-xs border border-slate-300 text-right font-mono">{fmt(data.totals.debit)}</td>
                  <td className="py-2 px-3 text-xs border border-slate-300 text-right font-mono">{fmt(data.totals.credit)}</td>
                  <td className="py-2 px-3 text-xs border border-slate-300 text-right font-mono">{fmt(data.totals.balance)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Balance Details */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
        <h3 className="text-xs font-bold text-slate-700 mb-3">Balance Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className={label}>Debit *</label>
            <input className={`${ctrl} text-right font-mono`} value={fmt(data.totals.debit)} disabled />
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Credit *</label>
            <input className={`${ctrl} text-right font-mono`} value={fmt(data.totals.credit)} disabled />
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Balance *</label>
            <input className={`${ctrl} text-right font-mono font-bold ${data.totals.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`} value={fmt(data.totals.balance)} disabled />
          </div>
        </div>
      </div>
    </div>
  );
}
