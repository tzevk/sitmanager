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
  Transfered: string;
  Moved_To_Batch_Code: string;
  Cancelled: number;
}

const StatusTag = ({ row }: { row: Pick<StudentRow, 'Transfered' | 'Moved_To_Batch_Code' | 'Cancelled'> }) => {
  if (Number(row.Cancelled) === 1)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-700 whitespace-nowrap shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />Cancelled
      </span>
    );
  if (row.Transfered?.toLowerCase() === 'yes')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 whitespace-nowrap shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Transferred{row.Moved_To_Batch_Code ? <span className="font-mono">→ {row.Moved_To_Batch_Code}</span> : null}
      </span>
    );
  return null;
};

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

const PAYMENT_TYPES = ['Cash', 'Cheque', 'DD', 'Online', 'UPI', 'Razorpay', 'NEFT', 'PDC'];
const TAX_TYPES = ['CGST', 'SGST', 'IGST'];
const todayISO = () => new Date().toISOString().slice(0, 10);

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors w-full';
const ctrlReadOnly = 'bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 w-full';
const lbl = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5';

const fmt = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
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
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
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
  const [receiptNo, setReceiptNo] = useState('');
  const [suggestedReceiptNo, setSuggestedReceiptNo] = useState('');

  const [saving, setSaving] = useState(false);
  const [deletingFeeId, setDeletingFeeId] = useState<number | null>(null);
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
    setReceiptNo('');
    setSuggestedReceiptNo('');
    try {
      const res = await fetch(`/api/fee-details/${sid}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setData(d);
      const nextReceiptNo = d.nextReceiptNo ?? '';
      setReceiptNo(nextReceiptNo);
      setSuggestedReceiptNo(nextReceiptNo);
      setParticular(d.particulars?.[0]?.label ?? '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load form details');
    } finally {
      setLoadingForm(false);
    }
  }, []);

  const selectStudent = (s: StudentRow) => {
    setStudentId(String(s.Student_Id));
    setSelectedStudent(s);
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
      const needsTransactionNo = paymentType !== 'Cash';
      if (needsTransactionNo && !chequeNo.trim()) {
        setError('Transaction number is required for this payment type.');
        return;
      }
      const body = {
        Type: type,
        Payment_Type: paymentType,
        Cheque_Bank: ['Cheque', 'DD', 'PDC'].includes(paymentType) ? bank || null : null,
        Cheque_No: needsTransactionNo ? chequeNo.trim() : null,
        Transaction_No: needsTransactionNo ? chequeNo.trim() : null,
        PaymentId: needsTransactionNo ? chequeNo.trim() : null,
        Cheque_Date: chequeDate || null,
        Cheque_Branch: ['Cheque', 'DD', 'PDC'].includes(paymentType) ? branch || null : null,
        Amount: amount,
        Particular: particular,
        RDate: receiptDate,
        TaxType: taxType,
        GenerateReceipt: generateReceipt,
        Fees_Code: receiptNo.trim() && receiptNo.trim() !== suggestedReceiptNo.trim() ? receiptNo.trim() : null,
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

  const handleDeleteFee = async (feesId: number) => {
    if (!studentId || !canUpdate) return;
    if (!window.confirm('Delete this fee receipt?')) return;
    setError('');
    setMessage('');
    setDeletingFeeId(feesId);
    try {
      const res = await fetch(`/api/fee-details/${studentId}/${feesId}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to delete receipt');
      setMessage('Receipt deleted successfully');
      await loadFormData(studentId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete receipt');
    } finally {
      setDeletingFeeId(null);
    }
  };

  const handlePrint = (kind: 'Receipt' | 'Invoice') => {
    if (!data) return;
    const w = window.open('', '_blank', 'width=780,height=1100');
    if (!w) return;
    const receiptNoVal = receiptNo || data.nextReceiptNo || '';
    const amtNum = Number(amount) || 0;
    const logo = `${window.location.origin}/sit.png`;

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

    const fmtDate2 = (d: string | null | undefined) => {
      if (!d) return '';
      const s = String(d).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(d);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const [y, m, dy] = s.split('-');
      const day = parseInt(dy, 10);
      const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
      return `${day}${suffix} ${months[parseInt(m, 10) - 1]}-${y}`;
    };

    const amtWords = amountToWords(amtNum);
    const receiptDateFmt = fmtDate2(receiptDate);
    const chequeDateFmt = fmtDate2(chequeDate);
    const showCheque = ['Cheque', 'DD', 'PDC'].includes(paymentType);

    const refNo = chequeNo || '';
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
          <div>Receipt No.: <span class="strong">${receiptNoVal}</span></div>
          <div>Date : <span class="strong">${receiptDateFmt}</span></div>
        </div>
        <div class="body">
          <div class="line-row">Received with thanks from <span class="fill name">${data.student.Student_Name}</span></div>
          <div class="line-row">the sum of rupees <span class="fill words">${amtWords}</span> as</div>
          <div class="course-row">
            <span>Course fees for</span><span class="fill course">${data.student.Course_Name || particular || ''}</span>
            <span>by</span><span class="fill mode">${paymentType}</span>
            <span>No.</span><span class="fill ref">${refNo}</span>
          </div>
          <div class="course-row second">
            <span>Dated</span><span class="fill dated">${showCheque ? chequeDateFmt : receiptDateFmt}</span>
            <span>drawn on</span><span class="fill drawn">${showCheque ? bank : ''}</span>
          </div>
          <div class="note-row">
            <span>Note :</span><span class="fill note">${particular || ''}</span>
            <span>Branch</span><span class="fill branch">${showCheque ? branch : ''}</span>
            <span class="amount-box">RS. ${fmt(amtNum)}</span>
          </div>
          <div class="notes-title">Notes:</div>
          <ul class="notes-list"><li>Payment by cheque shall be subject to realization of cheque.</li><li>In case cheque bounces, receipt will be automatically cancelled.</li><li>Payment strictly not refundable or transferable.</li></ul>
        </div>
        <div class="footer-text">This is computer generated receipt signature does not required.</div>
        <div class="cut-line"></div>
      </div>`;

    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${kind} ${receiptNoVal}</title><style>
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
      @media print { @page { size: A4 landscape; margin: 8mm; } .receipt { width: 100%; padding: 28px 28px 12px; } }
    </style></head><body>${copy('Student Copy')}<script>window.onload = () => { setTimeout(() => window.print(), 500); };<\/script></body></html>`);
    w.document.close();
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied />;

  const showChequeFields = ['Cheque', 'DD', 'PDC'].includes(paymentType);
  const showTransactionField = paymentType !== 'Cash';
  const transactionLabel = showChequeFields ? 'Cheque / DD No. *' : 'Transaction No. *';

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
                    <span className="flex items-center gap-1.5 shrink-0">
                      <StatusTag row={s} />
                      <span className="text-slate-400">{s.Student_Id}{s.Batch_code ? ` · ${s.Batch_code}` : ''}</span>
                    </span>
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/40">
            <h3 className="text-xs font-bold text-slate-700 mb-3">Student Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <label className={lbl}>Student Name</label>
                  {selectedStudent && <StatusTag row={selectedStudent} />}
                </div>
                <input className={ctrlReadOnly} value={data?.student.Student_Name || ''} readOnly />
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>Student Id</label>
                <input className={ctrlReadOnly} value={data?.student.Student_Id || ''} readOnly />
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>Course Name</label>
                <input className={ctrlReadOnly} value={data?.student.Course_Name || ''} readOnly />
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>Batch Code</label>
                <input className={ctrlReadOnly} value={data?.student.Batch_Code || ''} readOnly />
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>Contact No.</label>
                <input className={ctrlReadOnly} value={data?.student.Present_Mobile || ''} readOnly />
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>Email Address</label>
                <input className={ctrlReadOnly} value={data?.student.Email || ''} readOnly />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className={lbl}>Due Date</label>
                <input className={ctrlReadOnly} value={fmtDate(data?.dueDate)} readOnly />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-bold text-slate-700 mb-3">Transaction Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={lbl}>Type *</label>
                <select className={ctrl} value={type} onChange={e => setType(e.target.value as 'Credit' | 'Debit')} disabled={!studentId}>
                  <option value="Credit">Credit</option>
                  <option value="Debit">Debit</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>Receipt No</label>
                <input type="text" className={ctrl} value={receiptNo} onChange={e => setReceiptNo(e.target.value)} disabled={!studentId} placeholder="e.g. R-06/052" />
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>Payment Type</label>
                <select className={ctrl} value={paymentType} onChange={e => setPaymentType(e.target.value)} disabled={!studentId}>
                  {PAYMENT_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>{showTransactionField ? transactionLabel : 'Transaction No.'}</label>
                <input className={ctrl} value={chequeNo} onChange={e => setChequeNo(e.target.value)} disabled={!studentId || !showTransactionField} placeholder={showChequeFields ? 'Enter cheque / DD number' : 'Enter transaction number'} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>Bank</label>
                <select className={ctrl} value={bank} onChange={e => setBank(e.target.value)} disabled={!studentId || !showChequeFields}>
                  <option value="">Select Bank Name</option>
                  {(data?.banks || []).map(b => <option key={b.Id} value={b.Bank_Name}>{b.Bank_Name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>Cheque Date</label>
                <input type="date" className={ctrl} value={chequeDate} onChange={e => setChequeDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>Branch</label>
                <input className={ctrl} value={branch} onChange={e => setBranch(e.target.value)} disabled={!studentId || !showChequeFields} placeholder="Branch" />
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>Amount (Rs.) *</label>
                <input type="number" className={ctrl} value={amount} onChange={e => setAmount(e.target.value)} disabled={!studentId} placeholder="0" />
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
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className={lbl}>Tax Type</label>
                <div className="flex gap-5 mt-1 flex-wrap">
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
                  <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Transaction No</th>
                  <th className="text-right py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Debit Amount</th>
                  <th className="text-right py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Credit Amount</th>
                </tr>
              </thead>
              <tbody>
                {!data.ledger.length && (
                  <tr><td colSpan={7} className="py-6 text-center text-xs text-slate-400">No transactions yet</td></tr>
                )}
                {data.ledger.map(r => (
                  <tr key={r.Fees_Id} className="group hover:bg-slate-50/60">
                    <td className="py-2 px-3 text-xs border-b border-slate-100">{fmtDate(r.Date)}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100">{r.Particular || ''}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100">{r.Payment_Type || ''}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 font-mono">{r.Fees_Code || ''}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 font-mono">{r.Transaction_No || ''}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 text-right font-mono">{r.Debit ? fmt(r.Debit) : ''}</td>
                    <td className="relative py-2 px-3 text-xs border-b border-slate-100 text-right font-mono overflow-visible">
                      {r.Credit ? fmt(r.Credit) : ''}
                      {r.Fees_Id > 0 ? (
                        <div className="absolute right-0 top-1/2 z-10 flex -translate-y-1/2 translate-x-[calc(100%-0.35rem)] items-center gap-1 rounded-l-lg border border-slate-200 bg-white px-1.5 py-1 shadow-md opacity-75 transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100">
                            <span className="h-6 w-1 rounded-full bg-slate-300" aria-hidden />
                            <button
                              onClick={() => router.push(`/dashboard/fee-details/${studentId}?feesId=${r.Fees_Id}`)}
                              disabled={!canUpdate}
                              className="h-6 px-2 rounded-md border border-slate-200 text-[10px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteFee(r.Fees_Id)}
                              disabled={!canUpdate || deletingFeeId === r.Fees_Id}
                              className="h-6 px-2 rounded-md border border-red-200 text-[10px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
                            >
                              {deletingFeeId === r.Fees_Id ? 'Deleting' : 'Delete'}
                            </button>
                        </div>
                      ) : (
                        null
                      )}
                    </td>
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
