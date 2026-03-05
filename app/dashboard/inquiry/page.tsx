'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

// Safe date formatter that avoids hydration mismatches
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  try {
    const d = new Date(dateStr);
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

interface InquiryRow {
  Student_Id: number;
  Student_Name: string;
  CourseName: string | null;
  Inquiry_Dt: string | null;
  Discussion: string | null;
  DiscussionDate: string | null;
  Present_Mobile: string | null;
  Email: string | null;
  Discipline: string | null;
  Inquiry_Type: string | null;
  Status_id: number | null;
  StatusLabel: string;
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
  const { canView, canCreate, canUpdate, loading: permLoading } = useResourcePermissions('inquiry');
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
      if (status) params.set('status', status);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/inquiry?${params.toString()}`);
      const data = await res.json();
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
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    setFetchTrigger(t => t + 1);
  };

  const handleAdd = () => {
    router.push('/dashboard/inquiry/add');
  };

  const handleEdit = (studentId: number) => {
    router.push(`/dashboard/inquiry/add?editId=${studentId}`);
  };

  const statusColor = (label: string) => {
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

  return (
    <div className="space-y-3">
      {permLoading ? <PermissionLoading /> : !canView ? <AccessDenied message="You do not have permission to view inquiries." /> : (<>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Inquiry Listing</h2>
          <p className="text-sm text-gray-400">
            {pagination.total.toLocaleString()} total inquiries
          </p>
        </div>
        {canCreate && (
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 bg-[#2E3093] hover:bg-[#252780] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Inquiry
        </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-2">
          {/* Search */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Name, email, mobile..."
              className="w-[160px] border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300"
            />
          </div>

          {/* Discipline */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Discipline</label>
            <select
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              className="w-[110px] border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-600"
            >
              <option value="">All</option>
              {filters.disciplines.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Inquiry Type */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Type</label>
            <select
              value={inquiryType}
              onChange={(e) => setInquiryType(e.target.value)}
              className="w-[110px] border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-600"
            >
              <option value="">All</option>
              {filters.inquiryTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-[110px] border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-600"
            >
              <option value="">All</option>
              {filters.statusOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[130px] border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-600"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[130px] border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-600"
            />
          </div>

          {/* Buttons */}
          <button
            onClick={handleSearch}
            className="flex items-center gap-1 bg-[#2A6BB5] hover:bg-[#2360A0] text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded text-xs font-semibold transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dashboard-table w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100">
                <th className="text-left py-3 px-4 font-semibold">#</th>
                <th className="text-left py-3 px-4 font-semibold">Student Name</th>
                <th className="text-left py-3 px-4 font-semibold">Course Name</th>
                <th className="text-left py-3 px-4 font-semibold">Mobile</th>
                <th className="text-left py-3 px-4 font-semibold">Email</th>
                <th className="text-left py-3 px-4 font-semibold">Discipline</th>
                <th className="text-left py-3 px-4 font-semibold">Inquiry Type</th>
                <th className="text-left py-3 px-4 font-semibold">Inquiry Date</th>
                <th className="text-left py-3 px-4 font-semibold">Discussion</th>
                <th className="text-center py-3 px-4 font-semibold">Status</th>
                <th className="text-center py-3 px-4 font-semibold">Action</th>
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
                rows.map((r, i) => (
                  <tr
                    key={r.Student_Id}
                    className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="py-2.5 px-4 text-gray-300 font-medium">
                      {(pagination.page - 1) * pagination.limit + i + 1}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-gray-800 max-w-[180px]">
                      <span className="truncate block">{r.Student_Name || '—'}</span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 max-w-[160px]">
                      <span className="truncate block">{r.CourseName || '—'}</span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap font-mono text-xs">
                      {r.Present_Mobile || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 max-w-[180px]">
                      <span className="truncate block text-xs">{r.Email || '—'}</span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap text-xs">
                      {r.Discipline && r.Discipline !== 'NULL' && r.Discipline !== 'Select' ? r.Discipline : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap text-xs">
                      {r.Inquiry_Type || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap">
                      {formatDate(r.DiscussionDate || r.Inquiry_Dt)}
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 max-w-[220px]">
                      <span className="truncate block text-xs" title={r.Discussion && r.Discussion !== 'NULL' ? r.Discussion : ''}>
                        {r.Discussion && r.Discussion !== 'NULL' ? r.Discussion : '\u2014'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${statusColor(
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
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-[#2A6BB5] transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          title="Edit"
                          onClick={() => handleEdit(r.Student_Id)}
                          className={`p-1.5 rounded-lg hover:bg-amber-50 transition-colors ${canUpdate ? 'text-gray-400 hover:text-amber-600' : 'text-gray-200 cursor-not-allowed'}`}
                          disabled={!canUpdate}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          title="Delete"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-400">
              Showing{' '}
              <span className="font-semibold text-gray-600">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>
              {' '}-{' '}
              <span className="font-semibold text-gray-600">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>
              {' '}of{' '}
              <span className="font-semibold text-gray-600">
                {pagination.total.toLocaleString()}
              </span>
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={pagination.page <= 1}
                className="px-2 py-1 text-xs rounded-md border border-gray-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                First
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="px-2 py-1 text-xs rounded-md border border-gray-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                    className={`w-8 h-8 text-xs rounded-md border transition-colors ${
                      p === current
                        ? 'bg-[#2E3093] text-white border-[#2E3093]'
                        : 'border-gray-200 hover:bg-white text-gray-600'
                    }`}
                  >
                    {p}
                  </button>
                ));
              })()}

              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-2 py-1 text-xs rounded-md border border-gray-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => setPage(pagination.totalPages)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-2 py-1 text-xs rounded-md border border-gray-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}
