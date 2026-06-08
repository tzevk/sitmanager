'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

/* ── Types ─────────────────────────────────────────────────────────── */
interface FeesRow {
  Fees_Id: number;
  Fees_Code: string | null;
  Date_Added: string | null;
  RDate: string | null;
  Payment_Type: string | null;
  Cheque_No: string | null;
  Cheque_Bank: string | null;
  Cheque_Branch: string | null;
  Cheque_Date: string | null;
  Amount: number | null;
  Service_Tax: number | null;
  Total_Amt: number | null;
  UnPaid_Amt: number | null;
  Amt_Word: string | null;
  Notes: string | null;
  FeesMonth: number | null;
  FeesYear: number | null;
  Print: number | null;
  InvoiceCode: string | null;
  InvoiceDate: string | null;
  Student_Name: string;
  Present_Mobile: string;
  Email: string;
  Course_Name: string;
  Batch_Code: string;
}

interface BatchWiseFeesRow {
  Batch_Code: string;
  Course_Name: string;
  Batch_Start: string | null;
  Batch_End: string | null;
  Student_Name: string;
  Present_Mobile: string;
  Fees_Id: number;
  Fees_Code: string | null;
  Date_Added: string | null;
  RDate: string | null;
  Payment_Type: string | null;
  Cheque_No: string | null;
  Cheque_Bank: string | null;
  Cheque_Branch: string | null;
  Cheque_Date: string | null;
  Amount: number | null;
  Service_Tax: number | null;
  Total_Amt: number | null;
  UnPaid_Amt: number | null;
  Amt_Word: string | null;
  Notes: string | null;
  FeesMonth: number | null;
  FeesYear: number | null;
  Print: number | null;
}

interface BatchWiseFacultyRow {
  Batch_Code: string;
  Course_Name: string;
  Batch_Start: string | null;
  Batch_End: string | null;
  Faculty_Name: string;
  Faculty_Type: string | null;
  Salary_struct: string | null;
  Sal_Month: string | null;
  Sal_Year: string | null;
  Total_Hours: number | null;
  Rate: number | null;
  Salary: number | null;
  Tot_Inc: number | null;
  TDS: number | null;
  Total_Ded: number | null;
  Net_Payment: number | null;
  Payment_Type: string | null;
  Cheque_No: number | null;
  NEFT_No: string | null;
  Payment_Dt: string | null;
  Date_Added: string | null;
}

interface FacultyRow {
  Salary_Id: number;
  Faculty_Id: number;
  Faculty_Name: string;
  Sal_Month: string | null;
  Sal_Year: string | null;
  Faculty_Type: string | null;
  Salary_struct: string | null;
  Rate: number | null;
  Total_Hours: number | null;
  Salary: number | null;
  Bonus: number | null;
  Award: number | null;
  Other_Inc: number | null;
  Tot_Inc: number | null;
  TDS_Per: number | null;
  TDS: number | null;
  Advance: number | null;
  Other_Ded: number | null;
  Total_Ded: number | null;
  Net_Payment: number | null;
  Payment_Type: string | null;
  Cheque_No: number | null;
  NEFT_No: string | null;
  Payment_Dt: string | null;
  Date_Added: string | null;
  Remark: string | null;
}

interface FacultyOption { Faculty_Id: number; Faculty_Name: string; }
interface CourseOption  { Course_Id: number; Course_Name: string; }
interface BatchOption   { Batch_Id: number; Batch_code: string; }

const AMOUNT_TYPES = ['Cash', 'Cheque', 'NEFT', 'PDC', 'Online', 'DD'];

type Tab    = 'cheque-pdc' | 'fees-details' | 'faculty-payment';
type SubTab = 'batch-wise-fees' | 'fees-record' | 'batch-wise-faculty';

const TABS: { id: Tab; label: string }[] = [
  { id: 'cheque-pdc',      label: 'Cheque / PDC and Receipts' },
  { id: 'fees-details',    label: 'Fees Details' },
  { id: 'faculty-payment', label: 'Faculty Payment Detail Report' },
];

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'batch-wise-fees',     label: 'Batch Wise Fees Details New' },
  { id: 'fees-record',         label: 'Fees Record New' },
  { id: 'batch-wise-faculty',  label: 'Batch Wise Faculty Payment' },
];

/* ── Helpers ─────────────────────────────────────────────────────────── */
const fmt = (n: number | null | undefined) =>
  n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
};

const payBadge = (type: string | null) => {
  if (!type) return 'bg-slate-100 text-slate-500';
  const t = type.toLowerCase();
  if (t.includes('cheque') || t.includes('chq')) return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (t.includes('pdc'))  return 'bg-orange-50 text-orange-700 border border-orange-200';
  if (t.includes('neft') || t.includes('online')) return 'bg-blue-50 text-blue-700 border border-blue-200';
  if (t.includes('cash')) return 'bg-green-50 text-green-700 border border-green-200';
  return 'bg-slate-50 text-slate-600 border border-slate-200';
};

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function FeesReportPage() {
  const { canView, loading } = useResourcePermissions('report_fees');
  if (loading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view the fees report." />;
  return <FeesReportContent />;
}

function FeesReportContent() {
  const [activeTab, setActiveTab]         = useState<Tab>('cheque-pdc');
  const [subTab, setSubTab]               = useState<SubTab>('batch-wise-fees');
  const [fromDate, setFromDate]           = useState('');
  const [toDate, setToDate]               = useState('');
  const [printDetails, setPrintDetails]   = useState(false);
  const [facultyId, setFacultyId]         = useState('');
  const [faculties, setFaculties]         = useState<FacultyOption[]>([]);
  const [courseId,  setCourseId]          = useState('');
  const [batchId,   setBatchId]           = useState('');
  const [amountType, setAmountType]       = useState('');
  const [courses,   setCourses]           = useState<CourseOption[]>([]);
  const [batches,   setBatches]           = useState<BatchOption[]>([]);

  const [feesRows,           setFeesRows]           = useState<FeesRow[]>([]);
  const [batchWiseFeesRows,  setBatchWiseFeesRows]  = useState<BatchWiseFeesRow[]>([]);
  const [batchWiseFacRows,   setBatchWiseFacRows]   = useState<BatchWiseFacultyRow[]>([]);
  const [facultyRows,        setFacultyRows]        = useState<FacultyRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [searched, setSearched] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';

  // Load courses once
  useEffect(() => {
    fetch('/api/reports/fees?tab=fees-details&action=courses')
      .then(r => r.json()).then(d => setCourses(d.courses ?? [])).catch(() => {});
  }, []);

  // Reload batches when course changes
  useEffect(() => {
    setBatchId('');
    if (!courseId) { setBatches([]); return; }
    fetch(`/api/reports/fees?tab=fees-details&action=batches&courseId=${courseId}`)
      .then(r => r.json()).then(d => setBatches(d.batches ?? [])).catch(() => {});
  }, [courseId]);

  const clearResults = () => {
    setFeesRows([]); setBatchWiseFeesRows([]); setBatchWiseFacRows([]); setFacultyRows([]);
    setSearched(false); setError('');
  };

  const fetchData = useCallback(async (tab: Tab, st: SubTab) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setError('');
    setFeesRows([]); setBatchWiseFeesRows([]); setBatchWiseFacRows([]); setFacultyRows([]);
    try {
      const p = new URLSearchParams({ tab });
      if (tab === 'fees-details') p.set('subTab', st);
      if (fromDate) p.set('fromDate', fromDate);
      if (toDate)   p.set('toDate',   toDate);
      if (printDetails && tab !== 'faculty-payment') p.set('printDetails', '1');
      if (tab === 'faculty-payment' && facultyId) p.set('facultyId', facultyId);
      if (tab === 'fees-details') {
        if (courseId)   p.set('courseId',   courseId);
        if (batchId)    p.set('batchId',    batchId);
        if (amountType) p.set('amountType', amountType);
      }

      const res  = await fetch(`/api/reports/fees?${p}`, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch');

      const rows = data.rows ?? [];
      if (tab === 'faculty-payment')                                   setFacultyRows(rows);
      else if (tab === 'fees-details' && st === 'batch-wise-fees')     setBatchWiseFeesRows(rows);
      else if (tab === 'fees-details' && st === 'batch-wise-faculty')  setBatchWiseFacRows(rows);
      else setFeesRows(rows);

      setSearched(true);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, printDetails, facultyId, courseId, batchId, amountType]);

  const handleShow = () => fetchData(activeTab, subTab);

  const handleTabChange = useCallback(async (tab: Tab) => {
    setActiveTab(tab); clearResults();
    if (tab === 'faculty-payment' && faculties.length === 0) {
      try {
        const res = await fetch('/api/reports/fees?tab=faculty-payment&action=faculties');
        const data = await res.json();
        setFaculties(data.faculties ?? []);
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faculties.length]);

  const handleSubTabChange = (st: SubTab) => { setSubTab(st); clearResults(); };

  /* summary totals */
  const totalAmt      = feesRows.reduce((s, r) => s + (r.Amount ?? 0), 0);
  const totalTax      = feesRows.reduce((s, r) => s + (r.Service_Tax ?? 0), 0);
  const totalNet      = feesRows.reduce((s, r) => s + (r.Total_Amt ?? 0), 0);
  const totalBwNet    = batchWiseFeesRows.reduce((s, r) => s + (r.Total_Amt ?? 0), 0);
  const totalBwFacNet = batchWiseFacRows.reduce((s, r) => s + (r.Net_Payment ?? 0), 0);
  const totalFacNet   = facultyRows.reduce((s, r) => s + (r.Net_Payment ?? 0), 0);

  const showPrintToggle = activeTab !== 'faculty-payment' &&
    activeTab !== 'fees-details';

  /* Excel export for fees-details */
  const exportExcel = () => {
    const buildCsv = (headers: string[], rowsFn: () => string[][]): string =>
      [headers.join(','), ...rowsFn().map(r => r.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(','))].join('\n');

    let csv = '';
    const fname = `fees-${subTab}-${new Date().toISOString().slice(0,10)}.csv`;

    if (subTab === 'batch-wise-fees') {
      csv = buildCsv(['#','Batch Code','Course Name','Batch Start','Batch End','Student Name','Mobile','Receipt No','Date','Payment Type','Cheque No','Bank/Branch','Month/Year','Amount','Tax','Total','Unpaid','Notes'],
        () => batchWiseFeesRows.map((r,i) => [String(i+1), r.Batch_Code, r.Course_Name, fmtDate(r.Batch_Start), fmtDate(r.Batch_End),
          r.Student_Name, r.Present_Mobile, r.Fees_Code ?? '', fmtDate(r.RDate || r.Date_Added),
          r.Payment_Type ?? '', r.Cheque_No ?? '', [r.Cheque_Bank, r.Cheque_Branch].filter(Boolean).join(' / '),
          r.FeesMonth && r.FeesYear ? `${r.FeesMonth}/${r.FeesYear}` : '',
          String(r.Amount ?? ''), String(r.Service_Tax ?? ''), String(r.Total_Amt ?? ''), String(r.UnPaid_Amt ?? ''), r.Notes ?? '']));
    } else if (subTab === 'fees-record') {
      csv = buildCsv(['#','Receipt No','Date','Student Name','Mobile','Course','Batch','Payment Type','Month/Year','Amount','Tax','Total','Notes'],
        () => feesRows.map((r,i) => [String(i+1), r.Fees_Code ?? '', fmtDate(r.RDate || r.Date_Added), r.Student_Name, r.Present_Mobile,
          r.Course_Name, r.Batch_Code, r.Payment_Type ?? '', r.FeesMonth && r.FeesYear ? `${r.FeesMonth}/${r.FeesYear}` : '',
          String(r.Amount ?? ''), String(r.Service_Tax ?? ''), String(r.Total_Amt ?? ''), r.Notes ?? '']));
    } else if (subTab === 'batch-wise-faculty') {
      csv = buildCsv(['#','Batch Code','Course Name','Faculty Name','Type','Month/Year','Hours','Rate','Gross','TDS','Deductions','Net Payment','Payment Type','Cheque/NEFT','Payment Date'],
        () => batchWiseFacRows.map((r,i) => [String(i+1), r.Batch_Code, r.Course_Name, r.Faculty_Name, r.Faculty_Type ?? '',
          r.Sal_Month && r.Sal_Year ? `${r.Sal_Month} ${r.Sal_Year}` : '', String(r.Total_Hours ?? ''), String(r.Rate ?? ''),
          String(r.Salary ?? ''), String(r.TDS ?? ''), String(r.Total_Ded ?? ''), String(r.Net_Payment ?? ''),
          r.Payment_Type ?? '', r.NEFT_No || String(r.Cheque_No ?? ''), fmtDate(r.Payment_Dt)]));
    }
    if (!csv) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = fname; a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex flex-col gap-3">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-3 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10">
          <h2 className="text-sm font-black text-white tracking-tight leading-none">Fees Report</h2>
          <p className="text-[11px] text-white/60 mt-0.5">View cheque / PDC receipts, fee details, and faculty payment reports</p>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Tab bar */}
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => handleTabChange(t.id)}
              className={`flex-shrink-0 px-5 py-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? 'text-[#2E3093] border-b-2 border-[#2E3093] bg-[#2E3093]/5'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Sub-tab radio buttons — only for Fees Details */}
        {activeTab === 'fees-details' && (
          <div className="px-5 py-3 border-b border-slate-100 bg-white">
            <div className="flex flex-wrap gap-5">
              {SUB_TABS.map((st) => (
                <label key={st.id} className="flex items-center gap-2 cursor-pointer group">
                  <div
                    onClick={() => handleSubTabChange(st.id)}
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      subTab === st.id
                        ? 'border-[#2E3093] bg-[#2E3093]'
                        : 'border-slate-300 group-hover:border-[#2E3093]/50'
                    }`}
                  >
                    {subTab === st.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span
                    onClick={() => handleSubTabChange(st.id)}
                    className={`text-xs font-medium select-none transition-colors ${
                      subTab === st.id ? 'text-[#2E3093]' : 'text-slate-600 group-hover:text-slate-800'
                    }`}
                  >
                    {st.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
          {activeTab === 'fees-details' ? (
            /* ── Fees Details filter bar ── */
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Course <span className="text-red-500">*</span></label>
                <select value={courseId} onChange={e => setCourseId(e.target.value)} className={`${ctrl} w-[200px]`}>
                  <option value="">Select Course</option>
                  {courses.map(c => <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Batch <span className="text-red-500">*</span></label>
                <select value={batchId} onChange={e => setBatchId(e.target.value)} className={`${ctrl} w-[150px]`} disabled={!courseId}>
                  <option value="">Select Batch</option>
                  {batches.map(b => <option key={b.Batch_Id} value={b.Batch_Id}>{b.Batch_code}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Amount Type</label>
                <select value={amountType} onChange={e => setAmountType(e.target.value)} className={`${ctrl} w-[150px]`}>
                  <option value="">All</option>
                  {AMOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <button onClick={exportExcel} disabled={!searched || loading}
                className="flex items-center gap-1.5 bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-end"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Excel
              </button>

              <button onClick={handleShow} disabled={loading}
                className="flex items-center gap-1.5 bg-[#2E3093] text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-[#252880] disabled:opacity-60 disabled:cursor-not-allowed transition-colors self-end"
              >
                {loading ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> Loading…</> : <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> Show</>}
              </button>
            </div>
          ) : (
            /* ── Generic filter bar (cheque-pdc & faculty-payment) ── */
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">From Date <span className="text-red-500">*</span></label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={`${ctrl} w-[140px]`} />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">To Date <span className="text-red-500">*</span></label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={`${ctrl} w-[140px]`} />
              </div>

              {activeTab === 'faculty-payment' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Faculty <span className="text-red-500">*</span></label>
                  <select value={facultyId} onChange={e => setFacultyId(e.target.value)} className={`${ctrl} w-[200px]`}>
                    <option value="">All Faculties</option>
                    {faculties.map(f => <option key={f.Faculty_Id} value={f.Faculty_Id}>{f.Faculty_Name}</option>)}
                  </select>
                </div>
              )}

              {showPrintToggle && (
                <label className="flex items-center gap-2 cursor-pointer pb-1.5">
                  <div onClick={() => setPrintDetails(v => !v)}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${printDetails ? 'bg-[#2E3093]' : 'bg-slate-200'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${printDetails ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-xs font-medium text-slate-700 select-none">Print Receipt Details</span>
                </label>
              )}

              <button onClick={handleShow} disabled={loading}
                className="flex items-center gap-1.5 bg-[#2E3093] text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-[#252880] disabled:opacity-60 disabled:cursor-not-allowed transition-colors self-end"
              >
                {loading ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> Loading…</> : <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> Show</>}
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            {error}
          </div>
        )}

        {/* Results */}
        {!searched && !loading ? (
          <div className="py-16 text-center">
            <svg className="w-10 h-10 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <p className="text-xs text-slate-400">Select a date range and click <span className="font-semibold">Show</span> to load the report</p>
          </div>
        ) : loading ? (
          <div className="py-16 flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500">Loading report…</p>
          </div>
        ) : (
          <>
            {activeTab === 'cheque-pdc' && (
              <ChequePdcTable rows={feesRows} totalAmt={totalAmt} totalTax={totalTax} totalNet={totalNet} />
            )}
            {activeTab === 'fees-details' && subTab === 'batch-wise-fees' && (
              <BatchWiseFeesTable rows={batchWiseFeesRows} totalNet={totalBwNet} />
            )}
            {activeTab === 'fees-details' && subTab === 'fees-record' && (
              <FeesDetailsTable rows={feesRows} totalAmt={totalAmt} totalTax={totalTax} totalNet={totalNet} />
            )}
            {activeTab === 'fees-details' && subTab === 'batch-wise-faculty' && (
              <BatchWiseFacultyTable rows={batchWiseFacRows} totalNet={totalBwFacNet} />
            )}
            {activeTab === 'faculty-payment' && (
              <FacultyPaymentTable rows={facultyRows} totalNet={totalFacNet} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Shared helpers ──────────────────────────────────────────────────── */
const TH = 'text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 whitespace-nowrap';
const THR = 'text-right py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 whitespace-nowrap';
const TD = 'py-2 px-3 text-xs text-slate-700 border-b border-slate-100 whitespace-nowrap';

function EmptyState() {
  return (
    <div className="py-16 text-center">
      <svg className="w-10 h-10 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
      <p className="text-xs text-slate-400">No records found for the selected date range</p>
    </div>
  );
}

/* ── Cheque / PDC table ──────────────────────────────────────────────── */
function ChequePdcTable({ rows, totalAmt, totalTax, totalNet }: {
  rows: FeesRow[]; totalAmt: number; totalTax: number; totalNet: number;
}) {
  if (!rows.length) return <EmptyState />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className={TH}>#</th><th className={TH}>Receipt No</th><th className={TH}>Date</th>
            <th className={TH}>Student Name</th><th className={TH}>Course</th><th className={TH}>Batch</th>
            <th className={TH}>Payment Type</th><th className={TH}>Cheque No</th><th className={TH}>Bank</th>
            <th className={TH}>Branch</th><th className={TH}>Cheque Date</th>
            <th className={THR}>Amount</th><th className={THR}>Tax</th><th className={THR}>Total</th>
            <th className={TH}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.Fees_Id} className="hover:bg-slate-50/60 transition-colors">
              <td className={`${TD} text-slate-400`}>{i + 1}</td>
              <td className={TD}><span className="font-mono text-[11px] font-semibold text-[#2E3093]">{r.Fees_Code || '—'}</span></td>
              <td className={TD}>{fmtDate(r.RDate || r.Date_Added)}</td>
              <td className={`${TD} font-medium max-w-[160px] truncate`}>{r.Student_Name || '—'}</td>
              <td className={`${TD} max-w-[140px] truncate`}>{r.Course_Name || '—'}</td>
              <td className={TD}><span className="font-mono text-[11px]">{r.Batch_Code || '—'}</span></td>
              <td className={TD}><span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${payBadge(r.Payment_Type)}`}>{r.Payment_Type || '—'}</span></td>
              <td className={`${TD} font-mono`}>{r.Cheque_No || '—'}</td>
              <td className={TD}>{r.Cheque_Bank || '—'}</td>
              <td className={TD}>{r.Cheque_Branch || '—'}</td>
              <td className={TD}>{fmtDate(r.Cheque_Date)}</td>
              <td className={`${TD} text-right font-mono`}>{fmt(r.Amount)}</td>
              <td className={`${TD} text-right font-mono`}>{r.Service_Tax ? fmt(r.Service_Tax) : '—'}</td>
              <td className={`${TD} text-right font-mono font-semibold`}>{fmt(r.Total_Amt)}</td>
              <td className={`${TD} max-w-[180px] truncate text-slate-500`}>{r.Notes || '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 border-t-2 border-slate-200">
            <td colSpan={11} className="py-2 px-3 text-xs text-slate-600 text-right font-bold">Total ({rows.length} records)</td>
            <td className="py-2 px-3 text-xs text-right font-mono font-bold">{fmt(totalAmt)}</td>
            <td className="py-2 px-3 text-xs text-right font-mono font-bold">{fmt(totalTax)}</td>
            <td className="py-2 px-3 text-xs text-right font-mono font-bold text-[#2E3093]">{fmt(totalNet)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ── Batch Wise Fees Details table ───────────────────────────────────── */
function BatchWiseFeesTable({ rows, totalNet }: { rows: BatchWiseFeesRow[]; totalNet: number }) {
  if (!rows.length) return <EmptyState />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className={TH}>#</th>
            <th className={TH}>Batch Code</th>
            <th className={TH}>Course Name</th>
            <th className={TH}>Batch Start</th>
            <th className={TH}>Batch End</th>
            <th className={TH}>Student Name</th>
            <th className={TH}>Mobile</th>
            <th className={TH}>Receipt No</th>
            <th className={TH}>Date</th>
            <th className={TH}>Payment Type</th>
            <th className={TH}>Cheque No</th>
            <th className={TH}>Bank / Branch</th>
            <th className={TH}>Month / Year</th>
            <th className={THR}>Amount</th>
            <th className={THR}>Tax</th>
            <th className={THR}>Total</th>
            <th className={THR}>Unpaid</th>
            <th className={TH}>Notes</th>
            <th className="text-center py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 whitespace-nowrap">Printed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isNewBatch = i === 0 || rows[i - 1].Batch_Code !== r.Batch_Code;
            return (
              <React.Fragment key={`${r.Batch_Code}-${r.Fees_Id ?? 'np'}-${i}`}>
                {isNewBatch && (
                  <tr className="bg-[#2E3093]/5 border-y border-[#2E3093]/10">
                    <td colSpan={19} className="py-1.5 px-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold text-[#2E3093] font-mono">{r.Batch_Code || '—'}</span>
                        <span className="text-[11px] text-slate-600">{r.Course_Name}</span>
                        {r.Batch_Start && <span className="text-[10px] text-slate-400">{fmtDate(r.Batch_Start)} – {fmtDate(r.Batch_End)}</span>}
                      </div>
                    </td>
                  </tr>
                )}
                <tr className={`hover:bg-slate-50/60 transition-colors ${!r.Fees_Id ? 'bg-red-50/40' : ''}`}>
                  <td className={`${TD} text-slate-400`}>{i + 1}</td>
                  <td className={TD}><span className="font-mono text-[11px] text-[#2E3093]">{r.Batch_Code || '—'}</span></td>
                  <td className={`${TD} max-w-[140px] truncate`}>{r.Course_Name || '—'}</td>
                  <td className={TD}>{fmtDate(r.Batch_Start)}</td>
                  <td className={TD}>{fmtDate(r.Batch_End)}</td>
                  <td className={`${TD} font-medium max-w-[160px] truncate`}>{r.Student_Name || '—'}</td>
                  <td className={TD}>{r.Present_Mobile || '—'}</td>
                  {!r.Fees_Id ? (
                    <td colSpan={12} className="py-2 px-3 text-xs text-center border-b border-slate-100">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold border border-red-200">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        No Payment Recorded
                      </span>
                    </td>
                  ) : (
                    <>
                      <td className={TD}><span className="font-mono text-[11px] font-semibold text-[#2E3093]">{r.Fees_Code || '—'}</span></td>
                      <td className={TD}>{fmtDate(r.RDate || r.Date_Added)}</td>
                      <td className={TD}><span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${payBadge(r.Payment_Type)}`}>{r.Payment_Type || '—'}</span></td>
                      <td className={`${TD} font-mono`}>{r.Cheque_No || '—'}</td>
                      <td className={TD}>{[r.Cheque_Bank, r.Cheque_Branch].filter(Boolean).join(' / ') || '—'}</td>
                      <td className={TD}>{r.FeesMonth && r.FeesYear ? `${r.FeesMonth}/${r.FeesYear}` : '—'}</td>
                      <td className={`${TD} text-right font-mono`}>{fmt(r.Amount)}</td>
                      <td className={`${TD} text-right font-mono`}>{r.Service_Tax ? fmt(r.Service_Tax) : '—'}</td>
                      <td className={`${TD} text-right font-mono font-semibold text-emerald-700`}>{fmt(r.Total_Amt)}</td>
                      <td className={`${TD} text-right font-mono text-amber-600`}>{r.UnPaid_Amt ? fmt(r.UnPaid_Amt) : '—'}</td>
                      <td className={`${TD} max-w-[160px] truncate text-slate-500`}>{r.Notes || '—'}</td>
                      <td className="py-2 px-3 text-xs text-center border-b border-slate-100">
                        {r.Print
                          ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200"><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Yes</span>
                          : <span className="text-slate-300 text-[10px]">No</span>}
                      </td>
                    </>
                  )}
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 border-t-2 border-slate-200">
            <td colSpan={15} className="py-2 px-3 text-xs text-slate-600 text-right font-bold">Total ({rows.length} records)</td>
            <td className="py-2 px-3 text-xs text-right font-mono font-bold text-[#2E3093]">{fmt(totalNet)}</td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ── Fees Record table ───────────────────────────────────────────────── */
function FeesDetailsTable({ rows, totalAmt, totalTax, totalNet }: {
  rows: FeesRow[]; totalAmt: number; totalTax: number; totalNet: number;
}) {
  if (!rows.length) return <EmptyState />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className={TH}>#</th><th className={TH}>Receipt No</th><th className={TH}>Date</th>
            <th className={TH}>Student Name</th><th className={TH}>Mobile</th><th className={TH}>Course</th>
            <th className={TH}>Batch</th><th className={TH}>Payment Type</th><th className={TH}>Month/Year</th>
            <th className={THR}>Amount</th><th className={THR}>Tax</th><th className={THR}>Total</th>
            <th className={THR}>Unpaid</th><th className={TH}>Notes</th>
            <th className="text-center py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 whitespace-nowrap">Printed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.Fees_Id} className="hover:bg-slate-50/60 transition-colors">
              <td className={`${TD} text-slate-400`}>{i + 1}</td>
              <td className={TD}><span className="font-mono text-[11px] font-semibold text-[#2E3093]">{r.Fees_Code || '—'}</span></td>
              <td className={TD}>{fmtDate(r.RDate || r.Date_Added)}</td>
              <td className={`${TD} font-medium max-w-[160px] truncate`}>{r.Student_Name || '—'}</td>
              <td className={TD}>{r.Present_Mobile || '—'}</td>
              <td className={`${TD} max-w-[140px] truncate`}>{r.Course_Name || '—'}</td>
              <td className={TD}><span className="font-mono text-[11px]">{r.Batch_Code || '—'}</span></td>
              <td className={TD}><span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${payBadge(r.Payment_Type)}`}>{r.Payment_Type || '—'}</span></td>
              <td className={TD}>{r.FeesMonth && r.FeesYear ? `${r.FeesMonth}/${r.FeesYear}` : '—'}</td>
              <td className={`${TD} text-right font-mono`}>{fmt(r.Amount)}</td>
              <td className={`${TD} text-right font-mono`}>{r.Service_Tax ? fmt(r.Service_Tax) : '—'}</td>
              <td className={`${TD} text-right font-mono font-semibold`}>{fmt(r.Total_Amt)}</td>
              <td className={`${TD} text-right font-mono text-amber-600`}>{r.UnPaid_Amt ? fmt(r.UnPaid_Amt) : '—'}</td>
              <td className={`${TD} max-w-[160px] truncate text-slate-500`}>{r.Notes || '—'}</td>
              <td className="py-2 px-3 text-xs text-center border-b border-slate-100">
                {r.Print
                  ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200"><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Yes</span>
                  : <span className="text-slate-300 text-[10px]">No</span>}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 border-t-2 border-slate-200">
            <td colSpan={9} className="py-2 px-3 text-xs text-slate-600 text-right font-bold">Total ({rows.length} records)</td>
            <td className="py-2 px-3 text-xs text-right font-mono font-bold">{fmt(totalAmt)}</td>
            <td className="py-2 px-3 text-xs text-right font-mono font-bold">{fmt(totalTax)}</td>
            <td className="py-2 px-3 text-xs text-right font-mono font-bold text-[#2E3093]">{fmt(totalNet)}</td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ── Batch Wise Faculty Payment table ────────────────────────────────── */
function BatchWiseFacultyTable({ rows, totalNet }: { rows: BatchWiseFacultyRow[]; totalNet: number }) {
  if (!rows.length) return <EmptyState />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className={TH}>#</th>
            <th className={TH}>Batch Code</th>
            <th className={TH}>Course Name</th>
            <th className={TH}>Faculty Name</th>
            <th className={TH}>Type</th>
            <th className={TH}>Month / Year</th>
            <th className={THR}>Hours</th>
            <th className={THR}>Rate</th>
            <th className={THR}>Gross</th>
            <th className={THR}>TDS</th>
            <th className={THR}>Deductions</th>
            <th className={THR}>Net Payment</th>
            <th className={TH}>Payment Type</th>
            <th className={TH}>Cheque / NEFT</th>
            <th className={TH}>Payment Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50/60 transition-colors">
              <td className={`${TD} text-slate-400`}>{i + 1}</td>
              <td className={TD}><span className="font-mono text-[11px] font-semibold text-[#2E3093]">{r.Batch_Code || '—'}</span></td>
              <td className={`${TD} max-w-[160px] truncate`}>{r.Course_Name || '—'}</td>
              <td className={`${TD} font-medium`}>{r.Faculty_Name || '—'}</td>
              <td className={TD}>
                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  r.Faculty_Type === 'Permanent' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-600 border border-slate-200'
                }`}>{r.Faculty_Type || '—'}</span>
              </td>
              <td className={TD}>{r.Sal_Month && r.Sal_Year ? `${r.Sal_Month} ${r.Sal_Year}` : '—'}</td>
              <td className={`${TD} text-right font-mono`}>{r.Total_Hours ?? '—'}</td>
              <td className={`${TD} text-right font-mono`}>{r.Rate != null ? `₹${Number(r.Rate).toLocaleString('en-IN')}` : '—'}</td>
              <td className={`${TD} text-right font-mono`}>{fmt(r.Salary)}</td>
              <td className={`${TD} text-right font-mono text-red-600`}>{r.TDS ? fmt(r.TDS) : '—'}</td>
              <td className={`${TD} text-right font-mono text-red-600`}>{r.Total_Ded ? fmt(r.Total_Ded) : '—'}</td>
              <td className={`${TD} text-right font-mono font-bold text-emerald-700`}>{fmt(r.Net_Payment)}</td>
              <td className={TD}>
                {r.Payment_Type && r.Payment_Type !== 'Select Type'
                  ? <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${payBadge(r.Payment_Type)}`}>{r.Payment_Type}</span>
                  : <span className="text-slate-300 text-[10px]">—</span>}
              </td>
              <td className={`${TD} font-mono text-[11px]`}>{r.NEFT_No || (r.Cheque_No ? String(r.Cheque_No) : '—')}</td>
              <td className={TD}>{fmtDate(r.Payment_Dt)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 border-t-2 border-slate-200">
            <td colSpan={11} className="py-2 px-3 text-xs text-slate-600 text-right font-bold">Net Total ({rows.length} records)</td>
            <td className="py-2 px-3 text-xs text-right font-mono font-bold text-[#2E3093]">{fmt(totalNet)}</td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ── Faculty Payment Detail Report table ─────────────────────────────── */
function FacultyPaymentTable({ rows, totalNet }: { rows: FacultyRow[]; totalNet: number }) {
  if (!rows.length) return <EmptyState />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className={TH}>#</th><th className={TH}>Faculty Name</th><th className={TH}>Type</th>
            <th className={TH}>Structure</th><th className={TH}>Month / Year</th>
            <th className={THR}>Rate</th><th className={THR}>Hours</th><th className={THR}>Gross</th>
            <th className={THR}>Bonus</th><th className={THR}>Other Inc</th><th className={THR}>Total Inc</th>
            <th className={THR}>TDS %</th><th className={THR}>TDS</th><th className={THR}>Deductions</th>
            <th className={THR}>Net Payment</th>
            <th className={TH}>Payment Type</th><th className={TH}>Cheque / NEFT</th>
            <th className={TH}>Payment Date</th><th className={TH}>Remark</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.Salary_Id} className="hover:bg-slate-50/60 transition-colors">
              <td className={`${TD} text-slate-400`}>{i + 1}</td>
              <td className={`${TD} font-medium`}>{r.Faculty_Name || '—'}</td>
              <td className={TD}><span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${r.Faculty_Type === 'Permanent' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>{r.Faculty_Type || '—'}</span></td>
              <td className={TD}>{r.Salary_struct || '—'}</td>
              <td className={TD}>{r.Sal_Month && r.Sal_Year ? `${r.Sal_Month} ${r.Sal_Year}` : '—'}</td>
              <td className={`${TD} text-right font-mono`}>{r.Rate != null ? `₹${Number(r.Rate).toLocaleString('en-IN')}` : '—'}</td>
              <td className={`${TD} text-right font-mono`}>{r.Total_Hours ?? '—'}</td>
              <td className={`${TD} text-right font-mono`}>{fmt(r.Salary)}</td>
              <td className={`${TD} text-right font-mono`}>{r.Bonus ? fmt(r.Bonus) : '—'}</td>
              <td className={`${TD} text-right font-mono`}>{r.Other_Inc ? fmt(r.Other_Inc) : '—'}</td>
              <td className={`${TD} text-right font-mono`}>{fmt(r.Tot_Inc)}</td>
              <td className={`${TD} text-right font-mono`}>{r.TDS_Per != null ? `${r.TDS_Per}%` : '—'}</td>
              <td className={`${TD} text-right font-mono text-red-600`}>{r.TDS ? fmt(r.TDS) : '—'}</td>
              <td className={`${TD} text-right font-mono text-red-600`}>{r.Total_Ded ? fmt(r.Total_Ded) : '—'}</td>
              <td className={`${TD} text-right font-mono font-bold text-emerald-700`}>{fmt(r.Net_Payment)}</td>
              <td className={TD}>{r.Payment_Type && r.Payment_Type !== 'Select Type' ? <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${payBadge(r.Payment_Type)}`}>{r.Payment_Type}</span> : <span className="text-slate-300 text-[10px]">—</span>}</td>
              <td className={`${TD} font-mono text-[11px]`}>{r.NEFT_No || (r.Cheque_No ? String(r.Cheque_No) : '—')}</td>
              <td className={TD}>{fmtDate(r.Payment_Dt)}</td>
              <td className={`${TD} max-w-[140px] truncate text-slate-500`}>{r.Remark || '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 border-t-2 border-slate-200">
            <td colSpan={14} className="py-2 px-3 text-xs text-slate-600 text-right font-bold">Net Total ({rows.length} records)</td>
            <td className="py-2 px-3 text-xs text-right font-mono font-bold text-[#2E3093]">{fmt(totalNet)}</td>
            <td colSpan={4} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
