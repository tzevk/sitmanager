'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface RecentReceiptRow {
  Fees_Id: number;
  Student_Id: number;
  Student_Name: string;
  Course_Name: string | null;
  Batch_code: string | null;
  Fees_Code: string | null;
  Receipt_Date: string | null;
  Payment_Type: string | null;
  Amount: number | null;
  Transfered: string;
  Moved_To_Batch_Code: string;
  Cancelled: number;
}

interface StudentSearchRow {
  Student_Id: number;
  Student_Name: string;
  Present_Mobile: string | null;
  Email: string | null;
  Course_Name: string | null;
  Batch_code: string | null;
  Total_Fees: number | null;
  Total_Paid: number | null;
  Transfered: string;
  Moved_To_Batch_Code: string;
  Cancelled: number;
}

const StatusTag = ({ row }: { row: Pick<RecentReceiptRow, 'Transfered' | 'Moved_To_Batch_Code' | 'Cancelled'> }) => {
  if (Number(row.Cancelled) === 1)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-700 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />Cancelled
      </span>
    );
  if (row.Transfered?.toLowerCase() === 'yes')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
        Transferred{row.Moved_To_Batch_Code ? <span className="font-mono font-semibold">→ {row.Moved_To_Batch_Code}</span> : null}
      </span>
    );
  return null;
};

const fmt = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
};

export default function FeeDetailsPage() {
  const { canView, loading: permLoading } = useResourcePermissions('finance');
  const [recentRows, setRecentRows] = useState<RecentReceiptRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<StudentSearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const loadRecent = async () => {
      setRecentLoading(true);
      try {
        const res = await fetch('/api/fee-details?mode=recent');
        const data = await res.json();
        setRecentRows(data.rows ?? []);
      } finally {
        setRecentLoading(false);
      }
    };
    loadRecent();
  }, []);

  // Debounced student search (by name, id, or batch).
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/fee-details?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        setResults(data.rows ?? []);
        setSearched(true);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setResults([]);
        setSearched(true);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [search]);

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied />;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-3 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-white tracking-tight leading-none">Fee Details</h2>
            <p className="text-[11px] text-white/60 mt-0.5">Search a student to view or edit fee receipts and account ledger</p>
          </div>
          <Link
            href="/dashboard/fee-details/add"
            className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Add
          </Link>
        </div>
      </div>

      {/* Student search */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 flex items-center gap-2">
          <div className="relative flex-1">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student by name, ID or batch code…"
              className="w-full pl-9 pr-9 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                title="Clear"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>

        {(searching || searched) && (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Student</th>
                  <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Mobile</th>
                  <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Course</th>
                  <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Batch</th>
                  <th className="text-right py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Total Fees</th>
                  <th className="text-right py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Paid</th>
                  <th className="text-right py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Balance</th>
                  <th className="text-center py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Action</th>
                </tr>
              </thead>
              <tbody>
                {searching && (
                  <tr><td colSpan={8} className="py-6 text-center text-xs text-slate-400">Searching…</td></tr>
                )}
                {!searching && searched && !results.length && (
                  <tr><td colSpan={8} className="py-6 text-center text-xs text-slate-400">No students found</td></tr>
                )}
                {!searching && results.map((r) => (
                  <tr key={r.Student_Id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-3 text-xs border-b border-slate-100">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">{r.Student_Name || '—'}</span>
                        <span className="font-mono text-[10px] text-slate-400">#{r.Student_Id}</span>
                        <StatusTag row={r} />
                      </div>
                    </td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 font-mono">{r.Present_Mobile || '—'}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100">{r.Course_Name || '—'}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 font-mono">{r.Batch_code || '—'}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 text-right font-mono">{fmt(r.Total_Fees)}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 text-right font-mono text-emerald-700">{fmt(r.Total_Paid)}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 text-right font-mono text-red-600">{fmt((Number(r.Total_Fees) || 0) - (Number(r.Total_Paid) || 0))}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 text-center">
                      <Link
                        href={`/dashboard/fee-details/${r.Student_Id}`}
                        className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#2E3093]/10 text-[#2E3093] text-[11px] font-semibold hover:bg-[#2E3093]/20"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-[#f8fafc]">
          <h3 className="text-xs font-bold text-slate-700">Recent Fee Receipts</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Latest posted receipts across students</p>
        </div>
        <div className="overflow-x-auto border-b border-slate-100">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">#</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Receipt No</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Date</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Student</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Course</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Batch</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Payment Type</th>
                <th className="text-right py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Amount</th>
                <th className="text-center py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Action</th>
              </tr>
            </thead>
            <tbody>
              {recentLoading && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-xs text-slate-400">Loading recent receipts…</td>
                </tr>
              )}
              {!recentLoading && !recentRows.length && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-xs text-slate-400">No recent fee receipts found</td>
                </tr>
              )}
              {!recentLoading && recentRows.map((r, i) => (
                <tr key={r.Fees_Id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2 px-3 text-xs text-slate-400 border-b border-slate-100">{i + 1}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100 font-mono">{r.Fees_Code || ''}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100">{fmtDate(r.Receipt_Date)}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium">{r.Student_Name || '—'}</span>
                      <StatusTag row={r} />
                    </div>
                  </td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100">{r.Course_Name || '—'}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100 font-mono">{r.Batch_code || '—'}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100">{r.Payment_Type || '—'}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100 text-right font-mono">{fmt(r.Amount)}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100 text-center">
                    <Link
                      href={`/dashboard/fee-details/${r.Student_Id}?feesId=${r.Fees_Id}`}
                      className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#2E3093]/10 text-[#2E3093] text-[11px] font-semibold hover:bg-[#2E3093]/20"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
