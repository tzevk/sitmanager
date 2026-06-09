'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

type PendingDraftRow = {
  inquiryId: number;
  studentName: string;
  email: string;
  mobile: string;
  currentStep: number;
  autosavedAt: string;
  draftUrl: string;
};

export default function PendingAdmissionsPage() {
  const router = useRouter();
  const { canView, loading: permLoading } = useResourcePermissions('online_admission');

  const [rows, setRows] = useState<PendingDraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('search', search.trim());

        const res = await fetch(`/api/online-admission/pending?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setRows(Array.isArray(data.rows) ? data.rows : []);
        }
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [search]);

  const visibleRows = useMemo(() => rows, [rows]);

  return (
    <div className="flex flex-col gap-2">
      {permLoading ? <PermissionLoading /> : !canView ? <AccessDenied message="You do not have permission to view pending admissions." /> : (
        <>
          <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-2.5 flex items-center justify-between relative overflow-hidden">
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
            <div className="relative z-10 flex items-center gap-3">
              <h2 className="text-sm font-black text-white tracking-tight">Pending Admission Drafts</h2>
              <span className="text-[11px] text-white/60">{visibleRows.length.toLocaleString()} records</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-2.5">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, mobile, inquiry id..."
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors flex-1 min-w-[180px]"
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-bold">Inquiry Id</th>
                    <th className="text-left py-2 px-3 font-bold">Student Name</th>
                    <th className="text-left py-2 px-3 font-bold">Email</th>
                    <th className="text-left py-2 px-3 font-bold">Mobile</th>
                    <th className="text-left py-2 px-3 font-bold">Saved Step</th>
                    <th className="text-left py-2 px-3 font-bold">Last Saved</th>
                    <th className="text-center py-2 px-3 font-bold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center">
                        <div className="inline-flex flex-col items-center gap-1.5">
                          <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-slate-400">Loading drafts…</span>
                        </div>
                      </td>
                    </tr>
                  ) : visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-xs text-slate-400">No pending drafts found</td>
                    </tr>
                  ) : visibleRows.map((row) => (
                    <tr key={row.inquiryId} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-1.5 px-3 font-mono text-slate-700">{row.inquiryId}</td>
                      <td className="py-1.5 px-3 font-semibold text-slate-700">{row.studentName}</td>
                      <td className="py-1.5 px-3 text-slate-700">{row.email || '—'}</td>
                      <td className="py-1.5 px-3 text-slate-700">{row.mobile || '—'}</td>
                      <td className="py-1.5 px-3 text-slate-700">Step {row.currentStep || 1}</td>
                      <td className="py-1.5 px-3 text-slate-700 whitespace-nowrap">
                        {row.autosavedAt ? new Date(row.autosavedAt).toLocaleString('en-IN') : '—'}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => router.push(row.draftUrl)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-[#2A6BB5]/30 text-[#2E3093] hover:bg-[#2A6BB5]/10 transition-colors"
                        >
                          Open Draft
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
