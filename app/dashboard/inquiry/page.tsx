'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

// Safe date formatter that avoids hydration mismatches
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  try {
    const raw = String(dateStr).trim();
    let d = new Date(raw);

    // Handle legacy formats explicitly when Date.parse fails.
    if (isNaN(d.getTime())) {
      const m1 = raw.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})/);
      if (m1) {
        const day = parseInt(m1[1], 10);
        const mon = parseInt(m1[2], 10) - 1;
        const year = parseInt(m1[3], 10);
        d = new Date(year, mon, day);
      }
    }

    if (isNaN(d.getTime())) return '\u2014';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mon = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${mon} ${year}`;
  } catch {
    return '\u2014';
  }
}

function formatStudentName(name: string | null | undefined): string {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return '\u2014';
  const parts = trimmed.split(/\s+/);
  const first = parts[0] || '';
  const formattedFirst = first
    ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
    : '';
  return [formattedFirst, ...parts.slice(1)].filter(Boolean).join(' ');
}

interface InquiryRow {
  Student_Id: number;
  Student_Name: string;
  CourseName: string | null;
  Inquiry_Dt: string | null;
  Discussion: string | null;
  DiscussionDate: string | null;
  NextFollowUpDate?: string | null;
  Present_Mobile: string | null;
  Email: string | null;
  Location: string | null;
  Discipline: string | null;
  Inquiry_From: string | null;
  Inquiry_Type: string | null;
  Status_id: number | null;
  StatusLabel: string;
  FollowUpBy?: string | null;
}

function hasLatestFollowUp(row: InquiryRow): boolean {
  return Boolean(row.Discussion && row.Discussion !== 'NULL' && row.Discussion.trim());
}

function isPendingFollowUp(row: InquiryRow): boolean {
  if (row.Status_id != null && [4, 12, 15].includes(row.Status_id)) return true;
  const label = String(row.StatusLabel || '').toLowerCase();
  return label.includes('follow up') || label.includes('pending') || label.includes('callback');
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Filters {
  disciplines: string[];
  inquiryTypes: string[];
  statusOptions: { id: number; label: string }[];
}

export default function InquiryPage() {
  const router = useRouter();
  const { canView, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('inquiry');
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 25, total: 0, totalPages: 0,
  });
  const [filters, setFilters] = useState<Filters>({
    disciplines: [], inquiryTypes: [], statusOptions: [],
  });
  const [loading, setLoading] = useState(true);

  // Search / filter state
  const [search, setSearch] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [inquiryType, setInquiryType] = useState('');
  const [location, setLocation] = useState<'' | 'pune' | 'mumbai'>('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (search) params.set('search', search);
      if (discipline) params.set('discipline', discipline);
      if (inquiryType) params.set('inquiryType', inquiryType);
      if (location) params.set('location', location);
      if (status) params.set('status', status);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/inquiry?${params.toString()}`);
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : { rows: [], pagination: null, filters: null };
      setRows(data.rows ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
      if (data.filters) setFilters(data.filters);
    } catch (e) {
      console.error('Failed to fetch inquiries', e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fetchTrigger]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    setPage(1);
    setFetchTrigger(t => t + 1);
  };

  const handleClear = () => {
    setSearch('');
    setDiscipline('');
    setInquiryType('');
    setLocation('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    setFetchTrigger(t => t + 1);
  };

  const handleEdit = (studentId: number) => {
    router.push(`/dashboard/inquiry/add?editId=${studentId}`);
  };

  const statusPillColor = (statusId: number | null, label: string) => {
    // Prefer id grouping (stable), fallback to label
    if (statusId != null) {
      if ([7, 10, 27].includes(statusId)) return 'bg-emerald-100 text-emerald-700'; // admitted/converted/enrolled
      if ([1, 2, 3].includes(statusId)) return 'bg-blue-100 text-blue-700'; // new/contacted/inquiry
      if ([5, 24].includes(statusId)) return 'bg-orange-100 text-orange-700'; // interested/hot lead
      if ([4, 15, 25].includes(statusId)) return 'bg-amber-100 text-amber-700'; // follow up/callback/warm lead
      if ([6, 9, 19, 29].includes(statusId)) return 'bg-red-100 text-red-600'; // not interested/dnc/lost/dropped
      if ([8, 33].includes(statusId)) return 'bg-gray-100 text-gray-600'; // closed/archived
      if ([12, 16].includes(statusId)) return 'bg-purple-100 text-purple-700'; // pending/visited
      if ([18, 26].includes(statusId)) return 'bg-slate-100 text-slate-600'; // on hold/cold lead
    }

    const l = label.toLowerCase();
    if (['admitted', 'converted', 'enrolled'].includes(l)) return 'bg-emerald-100 text-emerald-700';
    if (['inquiry', 'new', 'contacted'].includes(l)) return 'bg-blue-100 text-blue-700';
    if (['hot lead', 'interested'].includes(l)) return 'bg-orange-100 text-orange-700';
    if (['warm lead', 'follow up', 'callback'].includes(l)) return 'bg-amber-100 text-amber-700';
    if (['not interested', 'lost', 'dropped', 'dnc'].includes(l)) return 'bg-red-100 text-red-600';
    if (['closed', 'archived'].includes(l)) return 'bg-gray-100 text-gray-600';
    if (['visited', 'pending'].includes(l)) return 'bg-purple-100 text-purple-700';
    if (['on hold', 'cold lead'].includes(l)) return 'bg-slate-100 text-slate-600';
    return 'bg-gray-100 text-gray-600';
  };

  const statusBarColor = (statusId: number | null, label: string) => {
    if (statusId != null) {
      if ([7, 10, 27].includes(statusId)) return 'bg-emerald-400';
      if ([1, 2, 3].includes(statusId)) return 'bg-blue-400';
      if ([5, 24].includes(statusId)) return 'bg-orange-400';
      if ([4, 15, 25].includes(statusId)) return 'bg-amber-400';
      if ([6, 9, 19, 29].includes(statusId)) return 'bg-red-400';
      if ([8, 33].includes(statusId)) return 'bg-slate-300';
      if ([12, 16].includes(statusId)) return 'bg-purple-400';
      if ([18, 26].includes(statusId)) return 'bg-slate-400';
    }

    const l = label.toLowerCase();
    if (['admitted', 'converted', 'enrolled'].includes(l)) return 'bg-emerald-400';
    if (['inquiry', 'new', 'contacted'].includes(l)) return 'bg-blue-400';
    if (['hot lead', 'interested'].includes(l)) return 'bg-orange-400';
    if (['warm lead', 'follow up', 'callback'].includes(l)) return 'bg-amber-400';
    if (['not interested', 'lost', 'dropped', 'dnc'].includes(l)) return 'bg-red-400';
    if (['visited', 'pending'].includes(l)) return 'bg-purple-400';
    if (['closed', 'archived'].includes(l)) return 'bg-slate-300';
    if (['on hold', 'cold lead'].includes(l)) return 'bg-slate-400';
    return 'bg-slate-300';
  };

  /* ---- shared classes (match Annual Batch styling) ---- */
  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5';
  const inputCls =
    'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 focus:border-[#2E3093] placeholder:text-slate-400 transition-all font-medium';
  const selectCls =
    'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 focus:border-[#2E3093] transition-all font-medium';

  return (
    <div className="space-y-6">
      {permLoading ? <PermissionLoading /> : !canView ? <AccessDenied message="You do not have permission to view inquiries." /> : (<>
      {/* Header (match Annual Batch styling) */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-2xl px-8 py-6 shadow-[0_10px_30px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="flex items-center justify-between gap-4 flex-wrap relative z-10">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Inquiry Listing</h2>
            <p className="text-[14px] text-white/80 font-medium mt-1">
              {pagination.total.toLocaleString()} total inquiries
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          {/* Search */}
          <div className="w-full sm:w-[260px]">
            <label className={labelCls}>Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Name, email, mobile..."
              className={inputCls}
            />
          </div>

          {/* Discipline */}
          <div className="w-full sm:w-[200px]">
            <label className={labelCls}>Discipline</label>
            <select
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              className={selectCls}
            >
              <option value="">All</option>
              {filters.disciplines.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Inquiry Type */}
          <div className="w-full sm:w-[200px]">
            <label className={labelCls}>Type</label>
            <select
              value={inquiryType}
              onChange={(e) => setInquiryType(e.target.value)}
              className={selectCls}
            >
              <option value="">All</option>
              {filters.inquiryTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div className="w-full sm:w-[200px]">
            <label className={labelCls}>Location</label>
            <div className="flex w-full rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-sm">
              {[{ key: '', label: 'All' }, { key: 'pune', label: 'Pune' }, { key: 'mumbai', label: 'Mumbai' }].map((opt) => {
                const active = location === (opt.key as any);
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      setLocation(opt.key as any);
                      setPage(1);
                      setFetchTrigger(t => t + 1);
                    }}
                    className={
                      (active
                        ? 'bg-[#2E3093] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white')
                      + ' flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors'
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <div className="w-full sm:w-[200px]">
            <label className={labelCls}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={selectCls}
            >
              <option value="">All</option>
              {filters.statusOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div className="w-full sm:w-[200px]">
            <label className={labelCls}>From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Date To */}
          <div className="w-full sm:w-[200px]">
            <label className={labelCls}>To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Buttons */}
          <div className="w-full lg:w-auto">
            <div className={labelCls}>Actions</div>
            <div className="flex gap-3">
              <button
                onClick={handleSearch}
                className="w-full lg:w-[140px] flex items-center justify-center gap-2 bg-[#2E3093] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
              <button
                onClick={handleClear}
                className="w-full lg:w-[140px] px-5 py-2.5 text-sm font-bold text-[#2E3093] bg-white border border-slate-200 rounded-xl hover:border-[#2E3093]/30 transition-all shadow-sm"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dashboard-table w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200">
                <th className="text-left py-3 px-4 font-bold">#</th>
                <th className="text-left py-3 px-4 font-bold">Student Name</th>
                <th className="text-left py-3 px-4 font-bold">Training Name</th>
                <th className="text-left py-3 px-4 font-bold">Mobile</th>
                <th className="text-left py-3 px-4 font-bold">Email</th>
                <th className="text-left py-3 px-4 font-bold">Location</th>
                <th className="text-left py-3 px-4 font-bold">Discipline</th>
                <th className="text-left py-3 px-4 font-bold">Inquiry Type</th>
                <th className="text-left py-3 px-4 font-bold">Inquiry Date</th>
                <th className="text-center py-3 px-4 font-bold">Status</th>
                <th className="text-center py-3 px-4 font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-400">Loading inquiries...</span>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-300">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                      <p className="text-sm">No inquiries found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const attended = hasLatestFollowUp(r);
                  const rowTextColorClass = isPendingFollowUp(r)
                    ? '[&>td]:text-purple-600'
                    : attended
                      ? '[&>td]:text-black'
                      : '[&>td]:text-red-600';

                  return (
                  <tr
                    key={r.Student_Id}
                    className={`border-b border-slate-100 bg-white transition-[filter] ${rowTextColorClass} hover:brightness-[0.98]`}
                  >
                    <td className="py-2.5 px-4 font-semibold relative pl-6">
                      <span
                        aria-hidden
                        className={`absolute left-0 inset-y-0 w-1.5 ${statusBarColor(r.Status_id, r.StatusLabel)} rounded-r`}
                      />
                      {(pagination.page - 1) * pagination.limit + i + 1}
                    </td>
                    <td className="py-2.5 px-4 font-semibold max-w-[180px]">
                      <span className="truncate block">{formatStudentName(r.Student_Name)}</span>
                    </td>
                    <td className="py-2.5 px-4 max-w-[160px]">
                      <span className="truncate block">{r.CourseName || '—'}</span>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap font-mono text-xs">
                      {r.Present_Mobile || '—'}
                    </td>
                    <td className="py-2.5 px-4 max-w-[180px]">
                      <span className="truncate block text-xs">{r.Email || '—'}</span>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap text-xs">
                      {r.Location || '—'}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap text-xs">
                      {r.Discipline && r.Discipline !== 'NULL' && r.Discipline !== 'Select' ? r.Discipline : '—'}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap text-xs">
                      {r.Inquiry_Type || r.Inquiry_From || '—'}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {formatDate(r.Inquiry_Dt)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${statusPillColor(
                          r.Status_id,
                          r.StatusLabel
                        )}`}
                      >
                        {r.StatusLabel}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          title="View"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-[#2A6BB5] transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          title="Edit"
                          onClick={() => handleEdit(r.Student_Id)}
                          className={
                            canUpdate
                              ? 'p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors'
                              : 'p-1.5 rounded-lg text-slate-200 cursor-not-allowed'
                          }
                          disabled={!canUpdate}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          title="Delete"
                          className={
                            canDelete
                              ? 'p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors'
                              : 'p-1.5 rounded-lg text-slate-200 cursor-not-allowed'
                          }
                          disabled={!canDelete}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200 bg-slate-50/50">
            <p className="text-xs text-slate-500">
              Showing{' '}
              <span className="font-semibold text-slate-700">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>
              {' '}-{' '}
              <span className="font-semibold text-slate-700">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>
              {' '}of{' '}
              <span className="font-semibold text-slate-700">
                {pagination.total.toLocaleString()}
              </span>
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={pagination.page <= 1}
                className="px-2 py-1 text-xs rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-semibold text-slate-700"
              >
                First
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="px-2 py-1 text-xs rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Page numbers */}
              {(() => {
                const pages: number[] = [];
                const total = pagination.totalPages;
                const current = pagination.page;
                const start = Math.max(1, current - 2);
                const end = Math.min(total, current + 2);
                for (let i = start; i <= end; i++) pages.push(i);
                return pages.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 text-xs rounded-lg border transition-colors font-semibold ${
                      p === current
                        ? 'bg-[#2E3093] text-white border-[#2E3093]'
                        : 'border-slate-200 hover:bg-white text-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                ));
              })()}

              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-2 py-1 text-xs rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => setPage(pagination.totalPages)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-2 py-1 text-xs rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-semibold text-slate-700"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Next Date Follow Up */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] px-5 py-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-base font-black text-slate-900 tracking-tight">Next Date Follow Up</h3>
          <span className="text-xs font-semibold text-slate-500">
            {rows.filter((r) => hasLatestFollowUp(r)).length} inquiries
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading discussion details...</p>
        ) : rows.some((r) => hasLatestFollowUp(r)) ? (
          <div className="space-y-2.5">
            {rows
              .filter((r) => hasLatestFollowUp(r))
              .map((r) => (
                <div key={`followup-${r.Student_Id}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div>
                      <p className="text-sm font-bold text-black">{formatStudentName(r.Student_Name)}</p>
                      <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{r.CourseName || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Next Date Follow Up</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{formatDate(r.NextFollowUpDate || null)}</p>
                      <p className="text-[11px] font-bold text-[#2E3093] mt-0.5">Interacted by: {r.FollowUpBy || 'System'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2.5">
                    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Mobile</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{r.Present_Mobile || '—'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Inquiry Type</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{r.Inquiry_Type || r.Inquiry_From || '—'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Status</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{r.StatusLabel}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Latest Interaction Note</p>
                    <p className="text-sm text-slate-700">{r.Discussion}</p>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No discussion notes available for current listing.</p>
        )}
      </div>
      </>)}
    </div>
  );
}
