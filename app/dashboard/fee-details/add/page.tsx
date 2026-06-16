'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface StudentRow {
  Student_Id: number;
  Student_Name: string;
  Course_Name: string | null;
  Batch_code: string | null;
  Present_Mobile: string | null;
  Email: string | null;
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
  student: {
    Student_Id: number;
    Student_Name: string;
    Course_Name: string | null;
    Batch_Code: string | null;
    Present_Mobile: string | null;
    Email: string | null;
  };
  dueDate: string | null;
  banks: Bank[];
  particulars: Particular[];
  ledger: LedgerRow[];
  totals: { debit: number; credit: number; balance: number };
  nextReceiptNo: string;
}

const PAYMENT_TYPES = ['Cash', 'Cheque', 'DD', 'Online', 'NEFT', 'PDC'];
const TAX_TYPES = ['CGST', 'SGST', 'IGST'];
const todayISO = () => new Date().toISOString().slice(0, 10);

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors w-full';
const ctrlReadOnly = 'bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 w-full';
const lbl = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5';

const fmt = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
};

export default function AddFeeDetailsPage() {
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('finance');
  const router = useRouter();

  // Student search
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Selected student data
  const [studentId, setStudentId] = useState('');
  const [data, setData] = useState<FeeDetailsData | null>(null);
  const [loadingForm, setLoadingForm] = useState(false);

  // Form state
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
  const [generateReceipt, setGenerateReceipt] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Load student list
  useEffect(() => {
    setLoadingStudents(true);
    fetch('/api/fee-details?mode=students')
      .then(r => r.json())
      .then(d => setStudents(d.rows ?? []))
      .finally(() => setLoadingStudents(false));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Filter students by search term
  const filteredStudents = search.trim().length >= 1
    ? students.filter(s =>
        s.Student_Name.toLowerCase().includes(search.toLowerCase()) ||
        String(s.Student_Id).includes(search.trim())
      ).slice(0, 20)
    : [];

  // Load form data when student changes
  const loadFormData = useCallback(async (sid: string) => {
    if (!sid) { setData(null); return; }
    setLoadingForm(true);
    setError('');
    setData(null);
    setAmount('');
    setTaxType('');
    setChequeNo('');
    setChequeDate('');
    setBranch('');
    setBank('');
    setType('Credit');
    setPaymentType('Cash');
    setReceiptDate(todayISO());
    setGenerateReceipt(false);
    try {
      const res = await fetch(`/api/fee-details/${sid}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setData(d);
      setParticular(d.particulars?.[0]?.label ?? '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load form details');
    } finally {
      setLoadingForm(false);
    }
  }, []);

  const selectStudent = (s: StudentRow) => {
    setStudentId(String(s.Student_Id));
    setSearch(`${s.Student_Name} (${s.Student_Id})`);
    setShowDropdown(false);
    loadFormData(String(s.Student_Id));
  };

  const handleParticularChange = (val: string) => {
    setParticular(val);
    const p = data?.particulars.find((x) => x.label === val);
    if (p?.fixed && p.amount != null) setAmount(String(p.amount));
  };

  const handleSave = async () => {
    if (!studentId) { setError('Select a student first.'); return; }
    if (!amount || !receiptDate) { setError('Amount and receipt date are required.'); return; }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const body = {
        Type: type,
        Payment_Type: paymentType,
        Cheque_Bank: bank || null,
        Cheque_No: chequeNo || null,
        Cheque_Date: chequeDate || null,
        Cheque_Branch: branch || null,
        Amount: amount,
        Particular: particular,
        RDate: receiptDate,
        TaxType: taxType,
        GenerateReceipt: generateReceipt,
      };
      const res = await fetch(`/api/fee-details/${studentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to save receipt');
      setMessage('Saved successfully');
      router.push(`/dashboard/fee-details/${studentId}?feesId=${d.Fees_Id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save receipt');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = (kind: 'Receipt' | 'Invoice') => {
    if (!data) return;
    const w = window.open('', '_blank', 'width=700,height=900');
    if (!w) return;
    const taxLine = taxType ? `<tr><td>${taxType}</td><td style="text-align:right">${fmt(Number(amount) * 0.09)}</td></tr>` : '';
    w.document.write(`
      <html><head><title>${kind} - ${data.nextReceiptNo}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#1e293b;}h1{font-size:18px;margin-bottom:4px;}table{width:100%;border-collapse:collapse;margin-top:16px;}td,th{border:1px solid #cbd5e1;padding:6px 10px;font-size:12px;text-align:left;}.muted{color:#64748b;font-size:11px;}</style></head><body>
      <h1>${kind}</h1>
      <div class="muted">Receipt No: ${data.nextReceiptNo} &nbsp;|&nbsp; Date: ${fmtDate(receiptDate)}</div>
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
  if (!canView) return <AccessDenied />;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-3 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10">
          <h2 className="text-sm font-black text-white tracking-tight leading-none">Add Fees Details</h2>
          <p className="text-[11px] text-white/60 mt-0.5">Search for a student below to begin entering fee details.</p>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2">{error}</div>}
      {message && <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3 py-2">{message}</div>}

      {/* Main form card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">

        {/* ── Student search ── */}
        <div className="mb-5" ref={searchRef}>
          <label className={lbl}>Search Student</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => search.trim().length >= 1 && setShowDropdown(true)}
              placeholder={loadingStudents ? 'Loading students…' : 'Search by name or student ID…'}
              disabled={loadingStudents}
              className={`${ctrl} pl-8`}
            />
            {showDropdown && filteredStudents.length > 0 && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {filteredStudents.map(s => (
                  <button
                    key={s.Student_Id}
                    type="button"
                    onMouseDown={() => selectStudent(s)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[#2E3093]/5 flex items-center justify-between gap-3 border-b border-slate-100 last:border-0"
                  >
                    <span className="font-medium text-slate-800 truncate">{s.Student_Name}</span>
                    <span className="text-slate-400 shrink-0">{s.Student_Id}{s.Batch_code ? ` · ${s.Batch_code}` : ''}</span>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && search.trim().length >= 1 && filteredStudents.length === 0 && !loadingStudents && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-3 text-xs text-slate-400">
                No students found for &ldquo;{search}&rdquo;
              </div>
            )}
          </div>
        </div>

        {loadingForm && <div className="mb-4 text-xs text-slate-400">Loading student details…</div>}

        {/* ── Form fields ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">

          {/* Row 1: Student Name | Student Id | Payment Type | Bank */}
          <div className="flex flex-col gap-1">
            <label className={lbl}>Student Name</label>
            <input className={ctrlReadOnly} value={data?.student.Student_Name || ''} readOnly />
          </div>
          <div className="flex flex-col gap-1">
            <label className={lbl}>Student Id</label>
            <input className={ctrlReadOnly} value={data?.student.Student_Id || ''} readOnly />
          </div>
          <div className="flex flex-col gap-1">
            <label className={lbl}>Payment Type</label>
            <select className={ctrl} value={paymentType} onChange={e => setPaymentType(e.target.value)} disabled={!studentId}>
              {PAYMENT_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={lbl}>Bank</label>
            <select className={ctrl} value={bank} onChange={e => setBank(e.target.value)} disabled={!studentId}>
              <option value="">Select Bank Name</option>
              {(data?.banks || []).map(b => <option key={b.Id} value={b.Bank_Name}>{b.Bank_Name}</option>)}
            </select>
          </div>

          {/* Row 2: Course Name | Batch Code | Cheque/D.D.No. | Cheque Date */}
          <div className="flex flex-col gap-1">
            <label className={lbl}>Course Name</label>
            <input className={ctrlReadOnly} value={data?.student.Course_Name || ''} readOnly />
          </div>
          <div className="flex flex-col gap-1">
            <label className={lbl}>Batch Code</label>
            <input className={ctrlReadOnly} value={data?.student.Batch_Code || ''} readOnly />
          </div>
          <div className="flex flex-col gap-1">
            <label className={lbl}>Cheque/D.D.No.</label>
            <input className={ctrl} value={chequeNo} onChange={e => setChequeNo(e.target.value)} disabled={!studentId} placeholder="Ref / Cheque No." />
          </div>
          <div className="flex flex-col gap-1">
            <label className={lbl}>Cheque Date</label>
            <input type="date" className={ctrl} value={chequeDate} onChange={e => setChequeDate(e.target.value)} disabled={!studentId} />
          </div>

          {/* Row 3: Contact No. | Email Address | Branch | Amount */}
          <div className="flex flex-col gap-1">
            <label className={lbl}>Contact No.</label>
            <input className={ctrlReadOnly} value={data?.student.Present_Mobile || ''} readOnly />
          </div>
          <div className="flex flex-col gap-1">
            <label className={lbl}>Email Address</label>
            <input className={ctrlReadOnly} value={data?.student.Email || ''} readOnly />
          </div>
          <div className="flex flex-col gap-1">
            <label className={lbl}>Branch</label>
            <input className={ctrl} value={branch} onChange={e => setBranch(e.target.value)} disabled={!studentId} placeholder="Branch" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={lbl}>Amount (Rs.) *</label>
            <input type="number" className={ctrl} value={amount} onChange={e => setAmount(e.target.value)} disabled={!studentId} placeholder="0" />
          </div>

          {/* Row 4: Type | Generate Receipt | Particular | Receipt Date */}
          <div className="flex flex-col gap-1">
            <label className={lbl}>Type *</label>
            <select className={ctrl} value={type} onChange={e => setType(e.target.value as 'Credit' | 'Debit')} disabled={!studentId}>
              <option value="Credit">Credit</option>
              <option value="Debit">Debit</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={lbl}>Generate Receipt</label>
            <div className="flex items-center h-[30px]">
              <input
                type="checkbox"
                id="generateReceipt"
                checked={generateReceipt}
                onChange={e => setGenerateReceipt(e.target.checked)}
                disabled={!studentId}
                className="w-4 h-4 accent-[#2E3093] cursor-pointer"
              />
              <label htmlFor="generateReceipt" className="ml-2 text-xs text-slate-600 cursor-pointer select-none">
                {data?.nextReceiptNo || ''}
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className={lbl}>Particular</label>
            <select className={ctrl} value={particular} onChange={e => handleParticularChange(e.target.value)} disabled={!studentId}>
              <option value="">Select Particular Type</option>
              {(data?.particulars || []).map(p => (
                <option key={p.label} value={p.label}>
                  {p.label}{p.fixed && p.amount != null ? ` (₹${p.amount})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={lbl}>Receipt Date *</label>
            <input type="date" className={ctrl} value={receiptDate} onChange={e => setReceiptDate(e.target.value)} disabled={!studentId} />
          </div>

          {/* Row 5: Due Date */}
          <div className="flex flex-col gap-1">
            <label className={lbl}>Due Date</label>
            <input className={ctrlReadOnly} value={fmtDate(data?.dueDate)} readOnly />
          </div>

          {/* Tax Type (full row) */}
          <div className="flex flex-col gap-1 lg:col-span-4">
            <label className={lbl}>Tax Type</label>
            <div className="flex gap-5 mt-1">
              {TAX_TYPES.map(t => (
                <label key={t} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input type="radio" name="taxType" checked={taxType === t} onChange={() => setTaxType(t)} disabled={!studentId} className="accent-[#2E3093]" />
                  {t}
                </label>
              ))}
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input type="radio" name="taxType" checked={taxType === ''} onChange={() => setTaxType('')} disabled={!studentId} className="accent-[#2E3093]" />
                None
              </label>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canUpdate || !studentId || saving}
            className="h-9 px-5 rounded-lg bg-[#2E3093] text-white text-xs font-bold hover:bg-[#252880] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => handlePrint('Receipt')}
            disabled={!studentId}
            className="h-9 px-4 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Print Receipt
          </button>
          <button
            type="button"
            onClick={() => handlePrint('Invoice')}
            disabled={!studentId}
            className="h-9 px-4 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Invoice
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/fee-details')}
            className="h-9 px-4 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>

      {/* Student Account Details */}
      {data && (
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
                {data.ledger.map(r => (
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
      )}

      {/* Balance Details */}
      {data && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
          <h3 className="text-xs font-bold text-slate-700 mb-3">Balance Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className={lbl}>Debit *</label>
              <input className={`${ctrlReadOnly} text-right font-mono`} value={fmt(data.totals.debit)} readOnly />
            </div>
            <div className="flex flex-col gap-1">
              <label className={lbl}>Credit *</label>
              <input className={`${ctrlReadOnly} text-right font-mono`} value={fmt(data.totals.credit)} readOnly />
            </div>
            <div className="flex flex-col gap-1">
              <label className={lbl}>Balance *</label>
              <input
                className={`${ctrlReadOnly} text-right font-mono font-bold ${data.totals.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}
                value={fmt(data.totals.balance)}
                readOnly
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
