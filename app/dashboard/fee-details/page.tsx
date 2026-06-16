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
}

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

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied />;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-3 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10">
          <h2 className="text-sm font-black text-white tracking-tight leading-none">Fee Details</h2>
          <p className="text-[11px] text-white/60 mt-0.5">Search a student to view or edit fee receipts and account ledger</p>
        </div>
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
                  <td className="py-2 px-3 text-xs border-b border-slate-100 font-medium">{r.Student_Name || '—'}</td>
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

        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex justify-end">
          <Link
            href="/dashboard/fee-details/add"
            className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 self-end"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Add
          </Link>
        </div>
      </div>
    </div>
  );
}
