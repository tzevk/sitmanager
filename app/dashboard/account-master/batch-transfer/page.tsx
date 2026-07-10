'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

/* ── Types ─────────────────────────────────────────────────────────── */
interface CourseOption { Course_Id: number; Course_Name: string }
interface BatchOption  { Batch_Id: number; Batch_code: string }
interface ReportRow {
  Student_Id: number;
  Roll_No?: string;
  Student_Name: string;
  Present_Mobile?: string;
  Email?: string;
  Course_Name?: string;
  Batch_Code?: string;
  Admission_Date?: string | null;
  Status_Name?: string;
  Moved_From_Batch_Code?: string;
  Moved_To_Batch_Code?: string;
}

type ReportType = 'transferred' | 'cancelled';

const TABS: { id: ReportType; label: string }[] = [
  { id: 'transferred', label: 'Batch Transfer' },
  { id: 'cancelled',   label: 'Cancelled Students' },
];

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
};

/* ── Page ──────────────────────────────────────────────────────────── */
export default function BatchTransferReportPage() {
  const { canView, loading: permLoading } = useResourcePermissions('student');
  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view this report." />;
  return <BatchTransferReportContent />;
}

function BatchTransferReportContent() {
  const router = useRouter();
  const initialTab: ReportType = (() => {
    if (typeof window === 'undefined') return 'transferred';
    const t = new URLSearchParams(window.location.search).get('type');
    return t === 'cancelled' ? 'cancelled' : 'transferred';
  })();
  const [tab, setTab] = useState<ReportType>(initialTab);
  const [courseId, setCourseId] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] transition-colors';

  useEffect(() => {
    fetch('/api/reports/student?action=courses')
      .then(r => r.json()).then(d => setCourses(d.courses ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    setBatchCode('');
    const url = courseId
      ? `/api/reports/student?action=batches&courseId=${courseId}`
      : `/api/reports/student?action=batches`;
    fetch(url).then(r => r.json()).then(d => setBatches(d.batches ?? [])).catch(() => {});
  }, [courseId]);

  const fetchReport = useCallback(async (t: ReportType) => {
    abortRef.current?.abort();
    const c = new AbortController();
    abortRef.current = c;
    setLoading(true); setError(''); setRows([]);
    try {
      const p = new URLSearchParams({ type: t });
      if (courseId) p.set('courseId', courseId);
      if (batchCode) p.set('batchCode', batchCode);
      const res = await fetch(`/api/reports/student?${p}`, { signal: c.signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load report');
      setRows(data.rows ?? []);
      setSearched(true);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [courseId, batchCode]);

  const handleShow = () => fetchReport(tab);
  const handleTabChange = (t: ReportType) => {
    setTab(t); setRows([]); setSearched(false); setError('');
  };

  const extraHeader = tab === 'transferred' ? 'Moved From → To' : 'Status';
  const extraValue = (r: ReportRow): string => {
    if (tab === 'transferred') {
      const from = r.Moved_From_Batch_Code || '';
      const to = r.Moved_To_Batch_Code || '';
      if (!from && !to) return '—';
      return `${from || '?'} → ${to || '?'}`;
    }
    return r.Status_Name || '—';
  };

  const activeLabel = TABS.find(t => t.id === tab)?.label ?? 'Batch Transfer';
  const courseLabel = courses.find(c => String(c.Course_Id) === courseId)?.Course_Name ?? 'All Courses';

  const handlePrint = () => {
    if (!rows.length) return;
    const w = window.open('', '_blank', 'width=1000,height=800');
    if (!w) return;
    const head = ['Sr', 'Roll No', 'Student Name', 'Course', 'Batch', 'Mobile', 'Admission Date', extraHeader];
    const bodyRows = rows.map((r, i) => {
      const cells = [
        String(i + 1), r.Roll_No || '—', r.Student_Name || '—', r.Course_Name || '—',
        r.Batch_Code || '—', r.Present_Mobile || '—', fmtDate(r.Admission_Date), extraValue(r),
      ];
      return `<tr>${cells.map(c => `<td>${String(c).replace(/</g, '&lt;')}</td>`).join('')}</tr>`;
    }).join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${activeLabel}</title><style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}
      body{padding:24px;color:#111}
      h1{font-size:18px;color:#2E3093;margin-bottom:2px}
      .sub{font-size:12px;color:#555;margin-bottom:14px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}
      th{background:#2E3093;color:#fff;font-size:10px;text-transform:uppercase}
      tr:nth-child(even) td{background:#f4f5fb}
      @media print{@page{size:A4 landscape;margin:10mm}}
    </style></head><body>
      <h1>Suvidya Institute of Technology — ${activeLabel}</h1>
      <div class="sub">${courseLabel}${batchCode ? ` · Batch ${batchCode}` : ''} · ${rows.length} record(s) · ${new Date().toLocaleString('en-IN')}</div>
      <table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${bodyRows}</tbody></table>
      <script>window.onload=()=>{setTimeout(()=>window.print(),400)}<\/script>
    </body></html>`);
    w.document.close();
  };

  const TH = 'text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 whitespace-nowrap';
  const TD = 'py-2 px-3 text-xs text-slate-700 border-b border-slate-100';

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-3 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10">
          <h2 className="text-sm font-black text-white tracking-tight leading-none">Batch Transfer / Cancelled Students</h2>
          <p className="text-[11px] text-white/60 mt-0.5">Pick a category to view transferred or cancelled students with full details</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Report type tabs */}
        <div className="flex flex-wrap border-b border-slate-200">
          {TABS.map(t => (
            <button key={t.id} onClick={() => handleTabChange(t.id)}
              className={`px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'text-[#2E3093] border-b-2 border-[#2E3093] bg-[#2E3093]/5'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Course</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)} className={`${ctrl} w-[220px]`}>
              <option value="">All Courses</option>
              {courses.map(c => <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Batch</label>
            <select value={batchCode} onChange={e => setBatchCode(e.target.value)} className={`${ctrl} w-[170px]`}>
              <option value="">All Batches</option>
              {batches.map(b => <option key={b.Batch_Id} value={b.Batch_code}>{b.Batch_code}</option>)}
            </select>
          </div>

          <button onClick={handleShow} disabled={loading}
            className="flex items-center gap-1.5 bg-[#2E3093] text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-[#252880] disabled:opacity-60 transition-colors self-end"
          >
            {loading ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> Loading…</> : <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg> Show</>}
          </button>
          <button onClick={handlePrint} disabled={!rows.length}
            className="flex items-center gap-1.5 bg-rose-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-700 disabled:opacity-40 transition-colors self-end"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a1 1 0 001-1v-4a1 1 0 00-1-1H9a1 1 0 00-1 1v4a1 1 0 001 1zm8-12V5a2 2 0 00-2-2H7a2 2 0 00-2 2v4h14z" /></svg>
            Print
          </button>
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 border border-slate-300 text-slate-700 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors self-end"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
        )}

        {/* Results */}
        {!searched && !loading ? (
          <div className="py-16 text-center">
            <svg className="w-10 h-10 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <p className="text-xs text-slate-400">Choose a category and click <span className="font-semibold">Show</span> to load results</p>
          </div>
        ) : loading ? (
          <div className="py-16 flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500">Loading report…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">No records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="px-5 py-2 text-[11px] text-slate-500 border-b border-slate-100">
              <span className="font-semibold text-slate-700">{rows.length}</span> record(s) · {activeLabel}
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={TH}>Sr</th>
                  <th className={TH}>Roll No</th>
                  <th className={TH}>Student Name</th>
                  <th className={TH}>Course</th>
                  <th className={TH}>Batch</th>
                  <th className={TH}>Mobile</th>
                  <th className={TH}>Admission Date</th>
                  <th className={TH}>{extraHeader}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.Student_Id}-${i}`} className="hover:bg-slate-50/60 transition-colors">
                    <td className={`${TD} text-slate-400`}>{i + 1}</td>
                    <td className={`${TD} font-mono text-[11px]`}>{r.Roll_No || '—'}</td>
                    <td className={`${TD} font-medium`}>{r.Student_Name || '—'}</td>
                    <td className={TD}>{r.Course_Name || '—'}</td>
                    <td className={`${TD} font-mono text-[11px]`}>{r.Batch_Code || '—'}</td>
                    <td className={TD}>{r.Present_Mobile || '—'}</td>
                    <td className={TD}>{fmtDate(r.Admission_Date)}</td>
                    <td className={TD}>{extraValue(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
