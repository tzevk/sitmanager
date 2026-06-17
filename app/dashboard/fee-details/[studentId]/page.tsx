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
    Cheque_Date: string | null;
    Cheque_Branch: string | null;
    Amount: number | null;
    Particular: string;
    TaxType: string;
    RDate: string | null;
  } | null;
}

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors w-full';
const label = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider';
const PAYMENT_TYPES = ['Cash', 'Cheque', 'DD', 'Online', 'NEFT', 'PDC'];
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
        setChequeNo(d.record.Cheque_No ?? '');
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
      const body = {
        Type: type,
        Payment_Type: paymentType,
        Cheque_Bank: ['Cheque', 'DD', 'PDC'].includes(paymentType) ? bank : null,
        Cheque_No: ['Cheque', 'DD', 'PDC'].includes(paymentType) ? chequeNo : null,
        Cheque_Date: ['Cheque', 'DD', 'PDC'].includes(paymentType) ? chequeDate : null,
        Cheque_Branch: ['Cheque', 'DD', 'PDC'].includes(paymentType) ? branch : null,
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

  const handleEmailReceipt = async () => {
    if (!data?.record) return;
    setEmailing(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/fee-details/${params.studentId}/${data.record.Fees_Id}/email`, {
        method: 'POST',
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'Failed to send email'); return; }
      setMessage(`Receipt emailed to ${d.email}`);
    } finally {
      setEmailing(false);
    }
  };

  const handlePrint = (_kind: 'Receipt' | 'Invoice') => {
    if (!data) return;
    const w = window.open('', '_blank', 'width=780,height=1100');
    if (!w) return;

    const receiptNoVal = data.record?.Fees_Code ?? receiptNo ?? data.nextReceiptNo ?? '';
    const amtNum = Number(amount) || 0;
    const logo = `${window.location.origin}/sit.png`;

    function numToWords(n: number): string {
      const ones = ['','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE',
                    'TEN','ELEVEN','TWELVE','THIRTEEN','FOURTEEN','FIFTEEN','SIXTEEN',
                    'SEVENTEEN','EIGHTEEN','NINETEEN'];
      const tens = ['','','TWENTY','THIRTY','FORTY','FIFTY','SIXTY','SEVENTY','EIGHTY','NINETY'];
      if (n === 0) return 'ZERO';
      function b100(x: number) { return x < 20 ? ones[x] : tens[Math.floor(x/10)] + (x%10 ? ' '+ones[x%10] : ''); }
      function b1000(x: number) { return x < 100 ? b100(x) : ones[Math.floor(x/100)]+' HUNDRED'+(x%100?' '+b100(x%100):''); }
      let r = '';
      if (n >= 10000000) { r += b1000(Math.floor(n/10000000))+' CRORE '; n %= 10000000; }
      if (n >= 100000)   { r += b1000(Math.floor(n/100000))+' LAKH '; n %= 100000; }
      if (n >= 1000)     { r += b100(Math.floor(n/1000))+' THOUSAND '; n %= 1000; }
      if (n > 0)         { r += b1000(n); }
      return r.trim();
    }
    function amountToWords(a: number) {
      const cents = Math.round(a * 100);
      const rs = Math.floor(cents / 100), ps = cents % 100;
      return numToWords(rs) + ' RUPEES' + (ps > 0 ? ' AND ' + numToWords(ps) + ' PAISE' : '') + ' ONLY';
    }

    const amtWords = amountToWords(amtNum);
    const fmtDate2 = (d: string | null | undefined) => {
      if (!d) return '';
      const s = String(d).slice(0,10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return d;
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const [y,m,dy] = s.split('-');
      return `${parseInt(dy)}${['st','nd','rd'][parseInt(dy)-1]||'th'} ${months[parseInt(m)-1]}-${y}`;
    };

    const receiptDateFmt = fmtDate2(receiptDate);
    const chequeDateFmt = fmtDate2(chequeDate);
    const showCheque = ['Cheque','DD','PDC'].includes(paymentType);

    const refNo = chequeNo || '';
    const copy = (label: string) => `
      <div class="receipt">
        <!-- Watermark -->
        <img src="${logo}" alt="" class="watermark" />

        <!-- Header band -->
        <div class="header-band">
          <div class="copy-tag">${label}</div>
          <div class="receipt-label">PAYMENT RECEIPT</div>
          <div class="org-name">Suvidya Institute of Technology Private Limited</div>
          <div class="org-addr">18/140 Anand Nagar, Nehru Road, Vakola, Santacruz (E), Mumbai – 400 055 &nbsp;|&nbsp; Tel: 022 26682290 / 9821569885</div>
        </div>

        <!-- Yellow accent stripe -->
        <div class="accent-stripe"></div>

        <!-- Receipt meta row -->
        <div class="meta-bar">
          <div class="meta-pill">
            <span class="meta-key">Receipt No.</span>
            <span class="meta-val">${receiptNoVal}</span>
          </div>
          <div class="meta-pill">
            <span class="meta-key">Date</span>
            <span class="meta-val">${receiptDateFmt}</span>
          </div>
        </div>

        <!-- Body -->
        <div class="body">
          <!-- Info grid -->
          <div class="info-grid">
            <div class="info-row">
              <div class="info-cell full">
                <div class="info-key">Received with thanks from</div>
                <div class="info-val highlight">${data.student.Student_Name}</div>
              </div>
            </div>
            <div class="info-row">
              <div class="info-cell">
                <div class="info-key">Course</div>
                <div class="info-val">${data.student.Course_Name ?? '—'}</div>
              </div>
              <div class="info-cell">
                <div class="info-key">Batch Code</div>
                <div class="info-val">${data.student.Batch_Code ?? '—'}</div>
              </div>
            </div>
            <div class="info-row">
              <div class="info-cell">
                <div class="info-key">Particular</div>
                <div class="info-val">${particular || '—'}</div>
              </div>
              <div class="info-cell">
                <div class="info-key">Payment Mode</div>
                <div class="info-val">${paymentType}</div>
              </div>
            </div>
                        <div class="info-row">
              <div class="info-cell full amount-hero">
                <div class="amount-label">Amount Received</div>
                <div class="amount-figure">₹ ${fmt(amtNum)}</div>
                <div class="amount-words">${amtWords}</div>
              </div>
            </div>
            ${refNo ? `
            <div class="info-row">
              <div class="info-cell">
                <div class="info-key">${showCheque ? 'Cheque / DD No.' : 'Reference No.'}</div>
                <div class="info-val mono">${refNo}</div>
              </div>
              <div class="info-cell">
                <div class="info-key">${showCheque ? 'Cheque Date' : 'Transaction Date'}</div>
                <div class="info-val">${showCheque ? chequeDateFmt : receiptDateFmt}</div>
              </div>
            </div>` : ''}
            ${(showCheque && bank) ? `
            <div class="info-row">
              <div class="info-cell">
                <div class="info-key">Bank</div>
                <div class="info-val">${bank}</div>
              </div>
              ${branch ? `<div class="info-cell"><div class="info-key">Branch</div><div class="info-val">${branch}</div></div>` : '<div class="info-cell"></div>'}
            </div>` : ''}
          </div>

          <!-- Notes -->
          <div class="notes-box">
            <div class="notes-title">Notes</div>
            <ul class="notes-list">
              <li>Payment by cheque is subject to realization of cheque.</li>
              <li>In case of cheque bounce, this receipt will be automatically cancelled.</li>
              <li>Course fee is strictly non-refundable and non-transferable.</li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <div class="footer-line"></div>
          <div class="footer-text">This is a computer generated receipt — signature not required.</div>
        </div>
      </div>`;

    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Receipt ${receiptNoVal}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: 'Inter', Arial, sans-serif; font-size: 12px; color: #1e293b;
    background: #f1f5f9;
    display: flex; align-items: center; justify-content: center; min-height: 100%;
  }

  .receipt {
    width: min(740px, 96vw); margin: 20px auto; background: #fff;
    border-radius: 12px; overflow: hidden;
    box-shadow: 0 6px 32px rgba(46,48,147,0.15);
    border: 1px solid #e2e8f0;
    position: relative;
    page-break-after: always;
  }

  /* Watermark */
  .watermark {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    width: 340px; height: 340px; object-fit: contain;
    opacity: 0.045; pointer-events: none; z-index: 0;
  }

  /* Header */
  .header-band {
    background: linear-gradient(135deg, #1e2080 0%, #2E3093 60%, #2A6BB5 100%);
    padding: 18px 20px 16px;
    text-align: center;
    position: relative;
  }
  .receipt-label { font-size: 10px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: #FAE452; margin-bottom: 5px; }
  .org-name { font-size: 15px; font-weight: 800; color: #fff; line-height: 1.3; margin-bottom: 4px; }
  .org-addr { font-size: 9.5px; color: rgba(255,255,255,0.72); line-height: 1.5; }
  .copy-tag {
    font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
    color: #1e2080; background: #FAE452; padding: 3px 8px; border-radius: 20px;
    position: absolute; top: 14px; right: 16px;
  }

  /* Accent stripe */
  .accent-stripe { height: 4px; background: linear-gradient(90deg, #FAE452 0%, #f59e0b 100%); }

  /* Meta bar */
  .meta-bar {
    display: flex; gap: 0; border-bottom: 1px solid #e2e8f0;
  }
  .meta-pill {
    flex: 1; padding: 8px 16px; display: flex; align-items: center; gap: 8px;
    border-right: 1px solid #e2e8f0;
  }
  .meta-pill:last-child { border-right: none; }
  .meta-key { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta-val { font-size: 13px; font-weight: 700; color: #2E3093; font-variant-numeric: tabular-nums; }

  /* Body */
  .body { padding: 16px 20px 12px; }

  /* Amount hero */
  .amount-hero {
    background: linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%);
    border: 1px solid #c7d2fe; border-radius: 8px;
    padding: 12px 18px; margin-bottom: 14px;
    display: flex; align-items: center; gap: 14px;
  }
  .amount-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6366f1; writing-mode: horizontal-tb; }
  .amount-figure { font-size: 22px; font-weight: 800; color: #2E3093; letter-spacing: -0.5px; flex-shrink: 0; }
  .amount-words { font-size: 9.5px; font-weight: 500; color: #475569; font-style: italic; flex: 1; line-height: 1.4; border-left: 2px solid #c7d2fe; padding-left: 12px; }

  /* Info grid */
  .info-grid { display: flex; flex-direction: column; gap: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 12px; }
  .info-row { display: flex; border-bottom: 1px solid #e2e8f0; }
  .info-row:last-child { border-bottom: none; }
  .info-cell { flex: 1; padding: 8px 12px; border-right: 1px solid #e2e8f0; }
  .info-cell:last-child { border-right: none; }
  .info-cell.full { flex: 2; }
  .info-key { font-size: 9px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .info-val { font-size: 11.5px; font-weight: 600; color: #1e293b; }
  .info-val.highlight { font-size: 13px; font-weight: 700; color: #2E3093; }
  .info-val.mono { font-family: 'Courier New', monospace; font-size: 11px; }

  /* Notes */
  .notes-box { background: #fafafa; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; }
  .notes-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 4px; }
  .notes-list { padding-left: 14px; }
  .notes-list li { font-size: 9.5px; color: #64748b; line-height: 1.6; }

  /* Footer */
  .footer { padding: 8px 20px 12px; }
  .footer-line { border-top: 1.5px dashed #cbd5e1; margin-bottom: 6px; }
  .footer-text { font-size: 9.5px; color: #94a3b8; text-align: center; font-style: italic; }

  @media print {
    body { background: #fff; display: block; }
    .receipt { margin: 0; box-shadow: none; border: none; border-radius: 0; width: 100%; max-width: 100%; min-height: 100vh; }
  }
</style></head><body>
${copy('Student Copy')}
<script>window.onload = () => { setTimeout(() => window.print(), 500); };<\/script>
</body></html>`);
    w.document.close();
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
          <button
            onClick={handleSave}
            disabled={saving || !canUpdate}
            className="h-9 px-4 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 disabled:opacity-50"
          >
            {saving ? 'Saving…' : (data.record ? 'Update' : 'Add')}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2">{error}</div>}
      {message && <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3 py-2">{message}</div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
        {/* Student info (read-only) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="flex flex-col gap-1">
            <label className={label}>Student Name</label>
            <input className={ctrl} value={data.student.Student_Name} disabled />
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Student Id</label>
            <input className={ctrl} value={data.student.Student_Id} disabled />
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Course Name</label>
            <input className={ctrl} value={data.student.Course_Name ?? ''} disabled />
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Batch Code</label>
            <input className={ctrl} value={data.student.Batch_Code ?? ''} disabled />
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Contact No.</label>
            <input className={ctrl} value={data.student.Present_Mobile ?? ''} disabled />
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Email Address</label>
            <input className={ctrl} value={data.student.Email ?? ''} disabled />
          </div>
        </div>

        <div className="border-t border-slate-100 my-4" />

        {/* Receipt fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="flex flex-col gap-1">
            <label className={label}>Type *</label>
            <select className={ctrl} value={type} onChange={(e) => setType(e.target.value as 'Credit' | 'Debit')}>
              <option value="Credit">Credit</option>
              <option value="Debit">Debit</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Receipt No.</label>
            <input
              className={`${ctrl} font-mono font-semibold text-[#2E3093]`}
              value={receiptNo}
              onChange={(e) => setReceiptNo(e.target.value)}
              placeholder="e.g. R-06/052"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Payment Type</label>
            <select className={ctrl} value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
              {PAYMENT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={label}>Receipt Date *</label>
            <input type="date" className={ctrl} value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
          </div>

          {showChequeFields && (
            <>
              <div className="flex flex-col gap-1">
                <label className={label}>Bank</label>
                <select className={ctrl} value={bank} onChange={(e) => setBank(e.target.value)}>
                  <option value="">Select Bank Name</option>
                  {data.banks.map((b) => <option key={b.Id} value={b.Bank_Name}>{b.Bank_Name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Cheque/D.D. No. *</label>
                <input className={ctrl} value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} placeholder="Cheque/D.D.No." />
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Cheque Date</label>
                <input type="date" className={ctrl} value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={label}>Branch</label>
                <input className={ctrl} value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Branch" />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1">
            <label className={label}>Amount (Rs.)</label>
            <input type="number" className={ctrl} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="flex flex-col gap-1 lg:col-span-2">
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
            <label className={label}>Due Date</label>
            <input className={ctrl} value={fmtDate(data.dueDate)} disabled />
          </div>

          <div className="flex flex-col gap-1 lg:col-span-4">
            <label className={label}>Tax Type</label>
            <div className="flex gap-5 mt-1">
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

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mb-2">
          <button onClick={() => handlePrint('Receipt')} className="h-9 px-4 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50">
            Print Receipt
          </button>
          <button onClick={() => handlePrint('Invoice')} className="h-9 px-4 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50">
            Invoice
          </button>
          {data.record && (
            <button
              onClick={handleEmailReceipt}
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
                <th className="text-center py-2 px-3 font-bold text-[11px] text-slate-700 border border-slate-300 w-32">Amount</th>
                <th className="text-center py-2 px-3 font-bold text-[11px] text-slate-700 border border-slate-300 w-32">Amount</th>
                <th className="text-center py-2 px-3 font-bold text-[11px] text-slate-700 border border-slate-300 w-36">Balance Payment</th>
              </tr>
            </thead>
            <tbody>
              {!data.ledger.length && (
                <tr><td colSpan={5} className="py-6 text-center text-xs text-slate-400 border border-slate-300">No transactions yet</td></tr>
              )}
              {(() => {
                let running = 0;
                return data.ledger.map((r) => {
                  running = running + r.Debit - r.Credit;
                  const desc = r.Credit > 0
                    ? `Payment Received${r.Fees_Code ? ` - ${r.Fees_Code}` : r.Particular ? ` - ${r.Particular}` : ''}`
                    : (r.Particular || '—');
                  return (
                    <tr key={r.Fees_Id} className="hover:bg-slate-50/40">
                      <td className="py-2 px-3 text-xs border border-slate-300 text-center">{fmtDate(r.Date)}</td>
                      <td className="py-2 px-3 text-xs border border-slate-300">{desc}</td>
                      <td className="py-2 px-3 text-xs border border-slate-300 text-right font-mono">{r.Debit ? fmt(r.Debit) : ''}</td>
                      <td className="py-2 px-3 text-xs border border-slate-300 text-right font-mono">{r.Credit ? fmt(r.Credit) : ''}</td>
                      <td className="py-2 px-3 text-xs border border-slate-300 text-right font-mono font-semibold">{fmt(running)}</td>
                    </tr>
                  );
                });
              })()}
              {data.ledger.length > 0 && (
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-400">
                  <td colSpan={2} className="py-2 px-3 text-xs border border-slate-300 text-right">Total &gt;&gt;&gt;</td>
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
