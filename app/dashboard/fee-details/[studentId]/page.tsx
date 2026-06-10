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
      } else {
        setParticular(d.particulars?.[0]?.label ?? '');
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

  const handlePrint = (kind: 'Receipt' | 'Invoice') => {
    if (!data) return;
    const w = window.open('', '_blank', 'width=700,height=900');
    if (!w) return;
    const taxLine = taxType ? `<tr><td>${taxType}</td><td style="text-align:right">${fmt(Number(amount) * 0.09)}</td></tr>` : '';
    w.document.write(`
      <html><head><title>${kind} - ${data.record?.Fees_Code ?? data.nextReceiptNo}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#1e293b;}
        h1{font-size:18px;margin-bottom:4px;}
        table{width:100%;border-collapse:collapse;margin-top:16px;}
        td,th{border:1px solid #cbd5e1;padding:6px 10px;font-size:12px;text-align:left;}
        .muted{color:#64748b;font-size:11px;}
      </style></head><body>
      <h1>${kind}</h1>
      <div class="muted">Receipt No: ${data.record?.Fees_Code ?? data.nextReceiptNo} &nbsp;|&nbsp; Date: ${fmtDate(receiptDate)}</div>
      <table>
        <tr><th>Student Name</th><td>${data.student.Student_Name}</td></tr>
        <tr><th>Student ID</th><td>${data.student.Student_Id}</td></tr>
        <tr><th>Course</th><td>${data.student.Course_Name ?? ''}</td></tr>
        <tr><th>Batch Code</th><td>${data.student.Batch_Code ?? ''}</td></tr>
        <tr><th>Particular</th><td>${particular}</td></tr>
        <tr><th>Payment Type</th><td>${paymentType}</td></tr>
        <tr><th>Amount</th><td style="text-align:right">₹ ${fmt(amount ? Number(amount) : 0)}</td></tr>
        ${taxLine}
      </table>
      <script>window.onload = () => window.print();</script>
      </body></html>
    `);
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
        <div className="relative z-10">
          <h2 className="text-sm font-black text-white tracking-tight leading-none">Add / Edit Fees Details</h2>
          <p className="text-[11px] text-white/60 mt-0.5">{data.student.Student_Name} — Student ID {data.student.Student_Id}</p>
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
            <input className={`${ctrl} font-mono font-semibold text-[#2E3093]`} value={data.record?.Fees_Code ?? data.nextReceiptNo} disabled />
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
          <button
            onClick={handleSave}
            disabled={saving || !canUpdate}
            className="h-9 px-4 rounded-lg bg-[#2E3093] text-white text-xs font-bold hover:bg-[#252875] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Update'}
          </button>
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
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Date</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Particular</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Payment Type</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Receipt No</th>
                <th className="text-right py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Debit</th>
                <th className="text-right py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Credit</th>
              </tr>
            </thead>
            <tbody>
              {!data.ledger.length && (
                <tr><td colSpan={6} className="py-6 text-center text-xs text-slate-400">No transactions yet</td></tr>
              )}
              {data.ledger.map((r) => (
                <tr key={r.Fees_Id} className="hover:bg-slate-50/60">
                  <td className="py-2 px-3 text-xs border-b border-slate-100">{fmtDate(r.Date)}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100">{r.Particular || '—'}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100">{r.Payment_Type || '—'}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100 font-mono">{r.Fees_Code || '—'}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100 text-right font-mono">{r.Debit ? fmt(r.Debit) : ''}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100 text-right font-mono">{r.Credit ? fmt(r.Credit) : ''}</td>
                </tr>
              ))}
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
