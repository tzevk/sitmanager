'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toBatchNumber } from '@/lib/batch-display';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface AdmissionRow {
  Admission_Id: number;
  Student_Id: string;
  Student_Name: string | null;
  Email: string | null;
  Present_Mobile: string | null;
  Batch_code: string | null;
  Admission_Date: string | null;
  Status_id: number | null;
  StatusLabel: string;
  StatusCategory: string;
  Cancel: string | null;
  IsActive: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const statusCategoryOptions = [
  { id: 'open', label: 'Open' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'closed', label: 'Closed' },
] as const;

export default function OnlineAdmissionPage() {
  const router = useRouter();
  const { canView, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('online_admission');
  const [rows, setRows] = useState<AdmissionRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 25, total: 0, totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  /* Filter state */
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (search) params.set('search', search);
      if (status) params.set('statusCategory', status);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/online-admission?${params.toString()}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch (e) {
      console.error('Failed to fetch admissions', e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fetchTrigger]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = () => { setPage(1); setFetchTrigger((t) => t + 1); };

  const handleClear = () => {
    setSearch('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    setFetchTrigger((t) => t + 1);
  };

  const handleExport = () => {
    /* Build CSV from current rows */
    const headers = ['Id', 'Student Name', 'Email', 'Mobile', 'Batch Code', 'Admission Date', 'Status'];
    const csvRows = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.Admission_Id,
          `"${(r.Student_Name || '').replace(/"/g, '""')}"`,
          `"${(r.Email || '').replace(/"/g, '""')}"`,
          r.Present_Mobile || '',
          r.Batch_code || '',
          r.Admission_Date || '',
          `"${r.StatusLabel}"`,
        ].join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `online-admissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rowTextColor = (category: string) => {
    if (category === 'accepted') return 'text-emerald-700';
    if (category === 'closed') return 'text-red-600';
    return 'text-slate-700';
  };

  const statusBadgeCls = (category: string) => {
    if (category === 'accepted') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    if (category === 'closed') return 'bg-red-50 text-red-600 border border-red-200';
    return 'bg-amber-50 text-amber-700 border border-amber-200';
  };

  const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';

  return (
    <div className="flex flex-col gap-2">
      {permLoading ? <PermissionLoading /> : !canView ? <AccessDenied message="You do not have permission to view online admissions." /> : (<>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-2.5 flex items-center justify-between relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10 flex items-center gap-3">
          <h2 className="text-sm font-black text-white tracking-tight">Online Admission</h2>
          <span className="text-[11px] text-white/60">{pagination.total.toLocaleString()} records</span>
        </div>
        <button onClick={handleExport} className="relative z-10 flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-2.5">
        <input
          ref={searchRef}
          type="text" value={search} placeholder="Search name, email, mobile, batch…"
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className={`${ctrl} flex-1 min-w-[180px]`}
        />
        <select value={status} onChange={e => setStatus(e.target.value)} className={`${ctrl} w-[130px]`}>
          <option value="">Status</option>
          {statusCategoryOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" className={`${ctrl} w-[130px]`} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" className={`${ctrl} w-[130px]`} />
        <button onClick={handleSearch} className="flex items-center gap-1 bg-[#2E3093] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#252880] transition-colors">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search
        </button>
        <button onClick={handleClear} className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">Clear</button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2 px-3 font-bold">Id</th>
                <th className="text-left py-2 px-3 font-bold">Name</th>
                <th className="text-left py-2 px-3 font-bold">Email</th>
                <th className="text-left py-2 px-3 font-bold">Mobile</th>
                <th className="text-left py-2 px-3 font-bold">Batch</th>
                <th className="text-left py-2 px-3 font-bold">Admission Date</th>
                <th className="text-center py-2 px-3 font-bold">Status</th>
                <th className="text-center py-2 px-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center">
                  <div className="inline-flex flex-col items-center gap-1.5">
                    <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-slate-400">Loading…</span>
                  </div>
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-xs text-slate-400">No admissions found</td></tr>
              ) : rows.map(r => {
                const tone = rowTextColor(r.StatusCategory);
                return (
                  <tr key={r.Admission_Id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className={`py-1.5 px-3 font-mono ${tone}`}>{r.Admission_Id}</td>
                    <td className={`py-1.5 px-3 font-semibold max-w-[180px] ${tone}`}>
                      <span className="truncate block">{r.Student_Name || '—'}</span>
                    </td>
                    <td className={`py-1.5 px-3 max-w-[180px] ${tone}`}>
                      <span className="truncate block">{r.Email || '—'}</span>
                    </td>
                    <td className={`py-1.5 px-3 font-mono whitespace-nowrap ${tone}`}>{r.Present_Mobile || '—'}</td>
                    <td className={`py-1.5 px-3 whitespace-nowrap font-semibold ${tone}`}>{toBatchNumber(r.Batch_code)}</td>
                    <td className={`py-1.5 px-3 whitespace-nowrap ${tone}`}>
                      {r.Admission_Date ? new Date(r.Admission_Date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBadgeCls(r.StatusCategory)}`}>
                        {r.StatusLabel}
                      </span>
                    </td>
                    <td className="py-1.5 px-3">
                      <div className="flex items-center justify-center gap-0.5">
                        <button title="View" className="p-1 rounded hover:bg-blue-50 text-slate-300 hover:text-[#2A6BB5] transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {canUpdate && (
                          <button title="Edit" onClick={() => router.push(`/dashboard/online-admission/edit/${r.Admission_Id}`)} className="p-1 rounded hover:bg-amber-50 text-slate-300 hover:text-amber-600 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {canDelete && (
                          <button title="Delete" className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
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

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50">
            <p className="text-[11px] text-slate-400">
              {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={pagination.page <= 1} className="px-2 py-0.5 text-[11px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 font-semibold text-slate-600">First</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pagination.page <= 1} className="px-1.5 py-0.5 rounded border border-slate-200 hover:bg-white disabled:opacity-30 text-slate-600">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              {(() => {
                const cur = pagination.page, tot = pagination.totalPages, pages = [];
                for (let p = Math.max(1, cur - 2); p <= Math.min(tot, cur + 2); p++) pages.push(p);
                return pages.map(p => (
                  <button key={p} onClick={() => setPage(p)} className={`w-6 h-6 text-[11px] rounded border font-semibold ${p === cur ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'border-slate-200 hover:bg-white text-slate-600'}`}>{p}</button>
                ));
              })()}
              <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page >= pagination.totalPages} className="px-1.5 py-0.5 rounded border border-slate-200 hover:bg-white disabled:opacity-30 text-slate-600">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
              <button onClick={() => setPage(pagination.totalPages)} disabled={pagination.page >= pagination.totalPages} className="px-2 py-0.5 text-[11px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 font-semibold text-slate-600">Last</button>
            </div>
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}
