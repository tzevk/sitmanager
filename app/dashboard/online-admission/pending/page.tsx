'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
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
  details?: Record<string, unknown>;
  onlineState?: number | null;
};

// Turn a camelCase / snake_case key into a readable label
function labelize(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function renderValue(value: unknown): string {
  if (value == null) return '—';
  if (Array.isArray(value)) {
    return value
      .map((v) => (v && typeof v === 'object' ? Object.values(v).filter(Boolean).join(' · ') : String(v)))
      .filter(Boolean)
      .join(' | ') || '—';
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${labelize(k)}: ${v}`)
      .join(', ') || '—';
  }
  return String(value);
}

export default function PendingAdmissionsPage() {
  const router = useRouter();
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('online_admission');

  const [rows, setRows] = useState<PendingDraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
  }, [search, reloadKey]);

  const handleDecision = async (inquiryId: number, action: 'accept' | 'reject') => {
    const verb = action === 'accept' ? 'grant' : 'reject';
    if (!confirm(`Are you sure you want to ${verb} this admission?`)) return;
    setBusyId(inquiryId);
    try {
      const res = await fetch(`/api/online-admission/${inquiryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusAction: action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to ${verb} admission`);
      }
      // Row leaves the pending list once decided — drop it locally and refresh.
      setRows((prev) => prev.filter((r) => r.inquiryId !== inquiryId));
      setReloadKey((k) => k + 1);
    } catch (e) {
      alert(e instanceof Error ? e.message : `Failed to ${verb} admission`);
    } finally {
      setBusyId(null);
    }
  };

  const visibleRows = useMemo(() => rows, [rows]);

  return (
    <div className="flex flex-col gap-2">
      {permLoading ? <PermissionLoading /> : !canView ? <AccessDenied message="You do not have permission to view pending admissions." /> : (
        <>
          <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-2.5 flex items-center justify-between relative overflow-hidden">
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
            <div className="relative z-10 flex items-center gap-3">
              <h2 className="text-sm font-black text-white tracking-tight">Pending Admissions</h2>
              <span className="text-[11px] text-white/60">{visibleRows.length.toLocaleString()} records</span>
            </div>
            <button
              type="button"
              onClick={() => router.push('/dashboard/online-admission')}
              className="relative z-10 flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Online Admission
            </button>
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
                    <Fragment key={row.inquiryId}>
                    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-1.5 px-3 font-mono text-slate-700">{row.inquiryId}</td>
                      <td className="py-1.5 px-3 font-semibold text-slate-700">{row.studentName || `Inquiry #${row.inquiryId}`}</td>
                      <td className="py-1.5 px-3 text-slate-700">{row.email || '—'}</td>
                      <td className="py-1.5 px-3 text-slate-700">{row.mobile || '—'}</td>
                      <td className="py-1.5 px-3 text-slate-700">{row.currentStep > 1 ? `Step ${row.currentStep}` : 'Filled form'}</td>
                      <td className="py-1.5 px-3 text-slate-700 whitespace-nowrap">
                        {row.autosavedAt ? new Date(row.autosavedAt).toLocaleString('en-IN') : '—'}
                      </td>
                      <td className="py-1.5 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setExpandedId((id) => (id === row.inquiryId ? null : row.inquiryId))}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            {expandedId === row.inquiryId ? 'Hide' : 'Details'}
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(row.draftUrl)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-[#2A6BB5]/30 text-[#2E3093] hover:bg-[#2A6BB5]/10 transition-colors"
                          >
                            Open
                          </button>
                          {canUpdate && (
                            <>
                              <button
                                type="button"
                                disabled={busyId === row.inquiryId}
                                onClick={() => handleDecision(row.inquiryId, 'accept')}
                                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                Grant
                              </button>
                              <button
                                type="button"
                                disabled={busyId === row.inquiryId}
                                onClick={() => handleDecision(row.inquiryId, 'reject')}
                                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === row.inquiryId && (
                      <tr className="bg-slate-50/70 border-b border-slate-200">
                        <td colSpan={7} className="py-3 px-4">
                          {row.details && Object.keys(row.details).length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
                              {Object.entries(row.details).map(([k, v]) => (
                                <div key={k} className="flex flex-col">
                                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{labelize(k)}</span>
                                  <span className="text-xs text-slate-700 break-words">{renderValue(v)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 text-center">No details captured yet.</p>
                          )}
                        </td>
                      </tr>
                    )}
                    </Fragment>
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
