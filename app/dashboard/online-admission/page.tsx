'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

// ── Types ──────────────────────────────────────────────────────────────────────

type AdmissionTab = '' | 'in_progress' | 'pending' | 'completed' | 'rejected';

interface AdmissionRow {
  Inquiry_Id: number;
  Admission_Id: number;
  Student_Name: string | null;
  Email: string | null;
  Present_Mobile: string | null;
  Batch_code: string | null;
  Admission_Date: string | null;
  LastActivityAt: string | null;
  PayloadUpdatedAt: string | null;
  PayloadCreatedAt: string | null;
  Status_id: number | null;
  StatusLabel: string;
  StatusCategory: 'pending' | 'completed' | 'rejected';
  RazorpayPaid: boolean;
  RazorpayPaymentId: string;
  RazorpayOrderId: string;
  RazorpayAmount: number | null;
  IsDraft: 0 | 1;
  DraftStep: number;
}

interface Pagination { page: number; limit: number; total: number; totalPages: number }

// ── Constants ──────────────────────────────────────────────────────────────────

const TABS: { id: AdmissionTab; label: string }[] = [
  { id: 'in_progress', label: 'In Progress' },
  { id: 'pending',     label: 'Pending' },
  { id: 'completed',   label: 'Completed' },
  { id: 'rejected',    label: 'Rejected' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return s; }
}

function fmtCurrency(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}



// ── Main Page ──────────────────────────────────────────────────────────────────

export default function OnlineAdmissionPage() {
  const router = useRouter();
  const { canView, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('online_admission');

  const [rows, setRows]             = useState<AdmissionRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading]       = useState(true);
  const [busyId, setBusyId]         = useState<number | null>(null);

  // Filters
  const [tab, setTab]       = useState<AdmissionTab>('pending');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [page, setPage]           = useState(1);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set('page', String(page));
      p.set('limit', '25');
      if (search)   p.set('search', search);
      if (tab)      p.set('tab', tab);
      if (dateFrom) p.set('dateFrom', dateFrom);
      if (dateTo)   p.set('dateTo', dateTo);
      const res  = await fetch(`/api/online-admission?${p}`, { signal: ctrl.signal });
      const data = await res.json();
      setRows(data.rows ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
    } finally {
      setLoading(false);
    }
  }, [page, fetchTrigger, search, tab, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  const refresh = () => { setPage(1); setFetchTrigger(t => t + 1); };

  const handleTabChange = (t: AdmissionTab) => {
    setTab(t);
    setPage(1);
    setFetchTrigger(t2 => t2 + 1);
  };

  const handleAction = async (inquiryId: number, action: 'accept' | 'reject' | 'delete') => {
    const verb = action === 'accept' ? 'grant' : action === 'reject' ? 'reject' : 'delete';
    if (!confirm(`Are you sure you want to ${verb} this admission?`)) return;
    setBusyId(inquiryId);
    try {
      const res = await fetch(`/api/online-admission/${inquiryId}`, {
        method: action === 'delete' ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        ...(action !== 'delete' && { body: JSON.stringify({ statusAction: action }) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || `Failed to ${verb}`);
      }
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : `Failed to ${verb}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = () => {
    const headers = ['Inquiry Id', 'Name', 'Email', 'Mobile', 'Batch', 'Payment Status', 'Payment Amount', 'Payment ID', 'Status', 'Last Updated'];
    const csvRows = [
      headers.join(','),
      ...rows.map(r => [
        r.Inquiry_Id,
        `"${(r.Student_Name || '').replace(/"/g, '""')}"`,
        `"${(r.Email || '').replace(/"/g, '""')}"`,
        r.Present_Mobile || '',
        r.Batch_code || '',
        r.RazorpayPaid ? 'Paid' : (r.RazorpayPaymentId ? 'Payment Logged' : ''),
        r.RazorpayAmount != null ? String(r.RazorpayAmount) : '',
        `"${(r.RazorpayPaymentId || '').replace(/"/g, '""')}"`,
        `"${r.StatusLabel}"`,
        r.LastActivityAt ? new Date(r.LastActivityAt).toLocaleDateString('en-IN') : '',
      ].join(',')),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `online-admissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Style helpers ──────────────────────────────────────────────────────────

  const statusBadgeCls = (cat: string) =>
    cat === 'completed'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : cat === 'rejected'
        ? 'bg-red-50 text-red-600 border-red-200'
        : 'bg-amber-50 text-amber-700 border-amber-200';

  const inp = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2">
      {permLoading ? <PermissionLoading /> : !canView ? (
        <AccessDenied message="You do not have permission to view online admissions." />
      ) : (
        <>
          {/* ── Header ── */}
          <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-2.5 flex items-center justify-between relative overflow-hidden">
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
            <div className="relative z-10 flex items-center gap-3">
              <h2 className="text-sm font-black text-white tracking-tight">Online Admission</h2>
              <span className="text-[11px] text-white/60">{pagination.total.toLocaleString()} records</span>
            </div>
            <button
              onClick={handleExport}
              className="relative z-10 flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
          </div>

          {/* ── Tabs + Filters ── */}
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 flex flex-wrap items-center gap-2">
            {/* Tabs */}
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTabChange(t.id)}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    tab === t.id
                      ? 'bg-[#2E3093] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-slate-200" />
            <input
              type="text" value={search}
              placeholder="Search name, email, mobile, id…"
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && refresh()}
              className={`${inp} flex-1 min-w-[180px]`}
            />
            <input type="date" value={dateFrom} title="From date" onChange={e => setDateFrom(e.target.value)} className={`${inp} w-[130px]`} />
            <input type="date" value={dateTo}   title="To date"   onChange={e => setDateTo(e.target.value)}   className={`${inp} w-[130px]`} />
            <button
              onClick={refresh}
              className="flex items-center gap-1 bg-[#2E3093] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#252880] transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </button>
            <button
              onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); refresh(); }}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
            >
              Clear
            </button>
          </div>

          {/* ── Table ── */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-bold w-16">Id</th>
                    <th className="text-left py-2 px-3 font-bold">Name</th>
                    <th className="text-left py-2 px-3 font-bold">Email</th>
                    <th className="text-left py-2 px-3 font-bold">Mobile</th>
                    <th className="text-left py-2 px-3 font-bold">Batch</th>
                    <th className="text-left py-2 px-3 font-bold">Payment</th>
                    <th className="text-left py-2 px-3 font-bold">Form</th>
                    <th className="text-left py-2 px-3 font-bold">Status</th>
                    <th className="text-left py-2 px-3 font-bold whitespace-nowrap">Last Updated</th>
                    <th className="text-center py-2 px-3 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center">
                        <div className="inline-flex flex-col items-center gap-1.5">
                          <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-slate-400">Loading…</span>
                        </div>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-xs text-slate-400">No admissions found</td>
                    </tr>
                  ) : rows.map(r => {
                    // Grant/Reject only make sense on a finally-submitted form that is
                    // still awaiting a decision — never on a draft the applicant is still filling.
                    const isPending  = r.StatusCategory === 'pending' && !r.IsDraft;
                    const busy       = busyId === r.Inquiry_Id;
                    return (
                      <tr key={r.Inquiry_Id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                          <td className="py-1.5 px-3 font-mono text-slate-500 text-[11px]">{r.Inquiry_Id}</td>
                          <td className="py-1.5 px-3 font-semibold text-slate-700 max-w-[160px]">
                            <span className="truncate block">{r.Student_Name || '—'}</span>
                          </td>
                          <td className="py-1.5 px-3 text-slate-600 max-w-[170px]">
                            <span className="truncate block">{r.Email || '—'}</span>
                          </td>
                          <td className="py-1.5 px-3 font-mono text-slate-600 whitespace-nowrap">{r.Present_Mobile || '—'}</td>
                          <td className="py-1.5 px-3 text-slate-600 whitespace-nowrap font-semibold">{r.Batch_code || '—'}</td>
                          <td className="py-1.5 px-3">
                            {r.RazorpayPaid || r.RazorpayPaymentId ? (
                              <div className="flex flex-col leading-tight">
                                <span className={`inline-flex w-fit items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${r.RazorpayPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                  {r.RazorpayPaid ? 'Paid' : 'Payment Logged'}
                                </span>
                                <span className="text-[10px] text-slate-500 mt-0.5">{fmtCurrency(r.RazorpayAmount)}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-1.5 px-3">
                            {r.IsDraft ? (
                              <span
                                title={r.DraftStep ? `Filling — reached step ${r.DraftStep}` : 'Filling the form'}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-sky-50 text-sky-700 border-sky-200 whitespace-nowrap"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                                Filling{r.DraftStep ? ` · Step ${r.DraftStep}` : ''}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-indigo-50 text-indigo-700 border-indigo-200 whitespace-nowrap">
                                Submitted
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadgeCls(r.StatusCategory)}`}>
                              {r.StatusLabel}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                            {fmtDateTime(r.LastActivityAt)}
                          </td>
                          <td className="py-1.5 px-3">
                            <div className="flex items-center justify-center gap-0.5">

                              {/* View — opens the admission form (in-progress draft or filled submission) */}
                              <button
                                title={r.IsDraft ? 'View in-progress admission form' : 'View filled admission form'}
                                onClick={() => window.open(`/admission/${r.Inquiry_Id}`, '_blank')}
                                className="p-1 rounded transition-colors text-slate-400 hover:bg-blue-50 hover:text-[#2E3093]"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>

                              {/* Edit form */}
                              {canUpdate && (
                                <button
                                  title="Edit form data"
                                  onClick={() => router.push(`/dashboard/online-admission/edit/${r.Inquiry_Id}`)}
                                  className="p-1 rounded text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              )}

                              {/* Grant — submitted-pending or still-filling (in-progress) forms */}
                              {canUpdate && (isPending || r.IsDraft === 1) && (
                                <button
                                  title={r.IsDraft ? 'Grant admission from in-progress form → converts to student' : 'Grant admission → converts to student'}
                                  disabled={busy}
                                  onClick={() => handleAction(r.Inquiry_Id, 'accept')}
                                  className="p-1 rounded text-slate-400 hover:bg-green-50 hover:text-green-600 transition-colors disabled:opacity-40"
                                >
                                  {busy ? (
                                    <div className="w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              )}

                              {/* Reject — pending only */}
                              {canUpdate && isPending && (
                                <button
                                  title="Reject admission"
                                  disabled={busy}
                                  onClick={() => handleAction(r.Inquiry_Id, 'reject')}
                                  className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}

                              {/* Delete */}
                              {canDelete && (
                                <button
                                  title="Delete submission"
                                  disabled={busy}
                                  onClick={() => handleAction(r.Inquiry_Id, 'delete')}
                                  className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50">
                <p className="text-[11px] text-slate-400">
                  {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(1)} disabled={pagination.page <= 1}
                    className="px-2 py-0.5 text-[11px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 font-semibold text-slate-600">First</button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pagination.page <= 1}
                    className="px-1.5 py-0.5 rounded border border-slate-200 hover:bg-white disabled:opacity-30 text-slate-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  {(() => {
                    const cur = pagination.page, tot = pagination.totalPages, pages: number[] = [];
                    for (let p = Math.max(1, cur - 2); p <= Math.min(tot, cur + 2); p++) pages.push(p);
                    return pages.map(p => (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-6 h-6 text-[11px] rounded border font-semibold ${p === cur ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'border-slate-200 hover:bg-white text-slate-600'}`}>
                        {p}
                      </button>
                    ));
                  })()}
                  <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page >= pagination.totalPages}
                    className="px-1.5 py-0.5 rounded border border-slate-200 hover:bg-white disabled:opacity-30 text-slate-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                  <button onClick={() => setPage(pagination.totalPages)} disabled={pagination.page >= pagination.totalPages}
                    className="px-2 py-0.5 text-[11px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 font-semibold text-slate-600">Last</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
