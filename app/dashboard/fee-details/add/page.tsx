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
    setReceiptNo('');
    try {
      const res = await fetch(`/api/fee-details/${sid}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setData(d);
      setReceiptNo(d.nextReceiptNo ?? '');
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
        Fees_Code: receiptNo.trim() || null,
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
        <img src="${logo}" alt="" class="watermark" />
        <div class="header-band">
          <div class="copy-tag">${label}</div>
          <div class="receipt-label">PAYMENT RECEIPT</div>
          <div class="org-name">Suvidya Institute of Technology Private Limited</div>
          <div class="org-addr">18/140 Anand Nagar, Nehru Road, Vakola, Santacruz (E), Mumbai – 400 055 &nbsp;|&nbsp; Tel: 022 26682290 / 9821569885</div>
        </div>
        <div class="accent-stripe"></div>
        <div class="meta-bar">
          <div class="meta-pill"><span class="meta-key">Receipt No.</span><span class="meta-val">${receiptNoVal}</span></div>
          <div class="meta-pill"><span class="meta-key">Date</span><span class="meta-val">${receiptDateFmt}</span></div>
        </div>
        <div class="body">
          <div class="info-grid">
            <div class="info-row"><div class="info-cell full"><div class="info-key">Received with thanks from</div><div class="info-val highlight">${data.student.Student_Name}</div></div></div>
            <div class="info-row">
              <div class="info-cell"><div class="info-key">Course</div><div class="info-val">${data.student.Course_Name ?? '—'}</div></div>
              <div class="info-cell"><div class="info-key">Batch Code</div><div class="info-val">${data.student.Batch_Code ?? '—'}</div></div>
            </div>
            <div class="info-row">
              <div class="info-cell"><div class="info-key">Particular</div><div class="info-val">${particular || '—'}</div></div>
              <div class="info-cell"><div class="info-key">Payment Mode</div><div class="info-val">${paymentType}</div></div>
            </div>
            <div class="info-row"><div class="info-cell full amount-hero"><div class="amount-label">Amount Received</div><div class="amount-figure">₹ ${fmt(amtNum)}</div><div class="amount-words">${amtWords}</div></div></div>
            ${refNo ? `<div class="info-row"><div class="info-cell"><div class="info-key">${showCheque ? 'Cheque / DD No.' : 'Reference No.'}</div><div class="info-val mono">${refNo}</div></div><div class="info-cell"><div class="info-key">${showCheque ? 'Cheque Date' : 'Transaction Date'}</div><div class="info-val">${showCheque ? chequeDateFmt : receiptDateFmt}</div></div></div>` : ''}
            ${(showCheque && bank) ? `<div class="info-row"><div class="info-cell"><div class="info-key">Bank</div><div class="info-val">${bank}</div></div>${branch ? `<div class="info-cell"><div class="info-key">Branch</div><div class="info-val">${branch}</div></div>` : '<div class="info-cell"></div>'}</div>` : ''}
          </div>
          <div class="notes-box"><div class="notes-title">Notes</div><ul class="notes-list"><li>Payment by cheque is subject to realization of cheque.</li><li>In case of cheque bounce, this receipt will be automatically cancelled.</li><li>Course fee is strictly non-refundable and non-transferable.</li></ul></div>
        </div>
        <div class="footer"><div class="footer-line"></div><div class="footer-text">This is a computer generated receipt — signature not required.</div></div>
      </div>`;

    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${kind} ${receiptNoVal}</title><style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { height: 100%; }
      body { font-family: 'Inter', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100%; }
      .receipt { width: min(740px, 96vw); margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 6px 32px rgba(46,48,147,0.15); border: 1px solid #e2e8f0; position: relative; page-break-after: always; }
      .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); width: 340px; height: 340px; object-fit: contain; opacity: 0.045; pointer-events: none; z-index: 0; }
      .header-band { background: linear-gradient(135deg, #1e2080 0%, #2E3093 60%, #2A6BB5 100%); padding: 18px 20px 16px; text-align: center; position: relative; }
      .receipt-label { font-size: 10px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: #FAE452; margin-bottom: 5px; }
      .org-name { font-size: 15px; font-weight: 800; color: #fff; line-height: 1.3; margin-bottom: 4px; }
      .org-addr { font-size: 9.5px; color: rgba(255,255,255,0.72); line-height: 1.5; }
      .copy-tag { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #1e2080; background: #FAE452; padding: 3px 8px; border-radius: 20px; position: absolute; top: 14px; right: 16px; }
      .accent-stripe { height: 4px; background: linear-gradient(90deg, #FAE452 0%, #f59e0b 100%); }
      .meta-bar { display: flex; gap: 0; border-bottom: 1px solid #e2e8f0; }
      .meta-pill { flex: 1; padding: 8px 16px; display: flex; align-items: center; gap: 8px; border-right: 1px solid #e2e8f0; }
      .meta-pill:last-child { border-right: none; }
      .meta-key { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
      .meta-val { font-size: 13px; font-weight: 700; color: #2E3093; font-variant-numeric: tabular-nums; }
      .body { padding: 16px 20px 12px; }
      .amount-hero { background: linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%); border: 1px solid #c7d2fe; border-radius: 8px; padding: 12px 18px; margin-bottom: 14px; display: flex; align-items: center; gap: 14px; }
      .amount-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6366f1; writing-mode: horizontal-tb; }
      .amount-figure { font-size: 22px; font-weight: 800; color: #2E3093; letter-spacing: -0.5px; flex-shrink: 0; }
      .amount-words { font-size: 9.5px; font-weight: 500; color: #475569; font-style: italic; flex: 1; line-height: 1.4; border-left: 2px solid #c7d2fe; padding-left: 12px; }
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
      .notes-box { background: #fafafa; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; }
      .notes-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 4px; }
      .notes-list { padding-left: 14px; }
      .notes-list li { font-size: 9.5px; color: #64748b; line-height: 1.6; }
      .footer { padding: 8px 20px 12px; }
      .footer-line { border-top: 1.5px dashed #cbd5e1; margin-bottom: 6px; }
      .footer-text { font-size: 9.5px; color: #94a3b8; text-align: center; font-style: italic; }
      @media print { body { background: #fff; display: block; } .receipt { margin: 0; box-shadow: none; border: none; border-radius: 0; width: 100%; max-width: 100%; min-height: 100vh; } }
    </style></head><body>${copy('Student Copy')}<script>window.onload = () => { setTimeout(() => window.print(), 500); };<\/script></body></html>`);
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

        {/* ── Form fields ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">

          {/* Row 1: Student Name | Student Id | Payment Type | Bank */}
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
            <label className={lbl}>Receipt No</label>
            <input
              type="text"
              className={ctrl}
              value={receiptNo}
              onChange={e => setReceiptNo(e.target.value)}
              disabled={!studentId}
              placeholder="e.g. R-06/052"
            />
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
