'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PermissionGate } from '@/components/ui/PermissionGate';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface FinalResult {
  Result_Id: number;
  Course_Id: number | null;
  Course_Name: string | null;
  Batch_Id: number | null;
  Batch_code: string | null;
  Result_Dt: string | null;
  Print_Dt: string | null;
  Approved_By: number | null;
  Approved_By_Name: string | null;
  Period_Start: string | null;
  Period_End: string | null;
}

interface FilterOption { Course_Id?: number; Course_Name?: string; Batch_Id?: number; Batch_code?: string; }
interface Pagination { page: number; limit: number; total: number; totalPages: number; }

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function GenerateFinalResultPage() {
  return (
    <PermissionGate resource="final_result" deniedMessage="You do not have permission to view final results.">
      {(perms) => <GenerateFinalResultContent {...perms} />}
    </PermissionGate>
  );
}

function GenerateFinalResultContent({ canCreate }: { canView: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean; canExport: boolean }) {
  const router = useRouter();

  /* ---- Data ---- */
  const [rows, setRows] = useState<FinalResult[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  /* ---- Filters ---- */
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCourses, setFilterCourses] = useState<FilterOption[]>([]);
  const [filterBatches, setFilterBatches] = useState<FilterOption[]>([]);

  const searchRef = useRef<HTMLInputElement>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  /* ================================================================ */
  /*  Fetch final results                                              */
  /* ================================================================ */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (search) params.set('search', search);
      if (courseId) params.set('courseId', courseId);
      if (batchId) params.set('batchId', batchId);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/daily-activities/generate-final-result?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRows(data.rows ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
      setFilterCourses(data.filters?.courses ?? []);
      setFilterBatches(data.filters?.batches ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, search, courseId, batchId, dateFrom, dateTo, fetchTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ---- Handlers ---- */
  const handleSearch = () => { setPage(1); setFetchTrigger(t => t + 1); };
  const handleClearFilters = () => {
    setSearch(''); setCourseId(''); setBatchId('');
    setDateFrom(''); setDateTo('');
    setPage(1); setFetchTrigger(t => t + 1);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this final result record?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/daily-activities/generate-final-result?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setFetchTrigger(t => t + 1);
    } catch { alert('Failed to delete final result record'); }
    setDeleting(null);
  };

  const handleExport = () => {
    const headers = ['Id', 'Batch Code', 'Course Name', 'Result Date', 'Approved By'];
    const csvRows = [
      headers.join(','),
      ...rows.map(r => [
        r.Result_Id,
        `"${(r.Batch_code || '').replace(/"/g, '""')}"`,
        `"${(r.Course_Name || '').replace(/"/g, '""')}"`,
        `"${formatDate(r.Result_Dt)}"`,
        `"${(r.Approved_By_Name || '').replace(/"/g, '""')}"`,
      ].join(',')),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generate-final-result-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return d; }
  };

  const totalPages = pagination.totalPages;

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */
  return (
    <div className="space-y-6">

      {/* ──── Page Header ──── */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] rounded-xl shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">Generate Final Result</h1>
          <p className="text-xs text-gray-400">Daily Activities / Generate Final Result</p>
        </div>
      </div>

      {/* ──── Main Card ──── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">

        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Add button */}
            {canCreate && (
            <button
              onClick={() => router.push('/dashboard/daily-activities/generate-final-result/add')}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#2E3093] text-white hover:bg-[#23257A] transition-colors shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add +
            </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filters toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                showFilters ? 'border-[#2E3093] text-[#2E3093] bg-[#2E3093]/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>

            {/* Search */}
            <div className="relative">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                placeholder="Search…"
                className="w-52 pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-400"
              />
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 max-w-4xl">
              <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setPage(1); setFetchTrigger(t => t + 1); }}
                className="h-9 rounded-lg border border-gray-200 px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 bg-white">
                <option value="">All Courses</option>
                {filterCourses.map((c: FilterOption) => (
                  <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>
                ))}
              </select>
              <select value={batchId} onChange={(e) => { setBatchId(e.target.value); setPage(1); setFetchTrigger(t => t + 1); }}
                className="h-9 rounded-lg border border-gray-200 px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 bg-white">
                <option value="">All Batches</option>
                {filterBatches.map((b: FilterOption) => (
                  <option key={b.Batch_Id} value={b.Batch_Id}>{b.Batch_code}</option>
                ))}
              </select>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); setFetchTrigger(t => t + 1); }}
                placeholder="From date"
                className="h-9 rounded-lg border border-gray-200 px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 bg-white" />
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); setFetchTrigger(t => t + 1); }}
                placeholder="To date"
                className="h-9 rounded-lg border border-gray-200 px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 bg-white" />
              <button onClick={handleClearFilters}
                className="h-9 px-3 text-xs font-medium border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
                Clear All
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto flex-1">
          <table className="dashboard-table w-full text-sm min-w-[800px]">
            <thead className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100/80 z-10">
              <tr className="text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4 border-b border-gray-200 w-16">Id</th>
                <th className="py-3 px-4 border-b border-gray-200">Batch Code</th>
                <th className="py-3 px-4 border-b border-gray-200">Course Name</th>
                <th className="py-3 px-4 border-b border-gray-200 w-28">Result Date</th>
                <th className="py-3 px-4 border-b border-gray-200">Approved By</th>
                <th className="py-3 px-4 border-b border-gray-200 w-28 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex justify-center items-center gap-2 text-gray-400">
                      <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      Loading final results...
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-400">No final result records found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.Result_Id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-semibold bg-[#2E3093]/8 text-[#2E3093] rounded">
                        {r.Result_Id}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded">
                        {r.Batch_code || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-gray-800 text-sm">
                      {r.Course_Name || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 text-xs font-medium">
                      {formatDate(r.Result_Dt)}
                    </td>
                    <td className="py-2.5 px-4 text-gray-700 text-sm">
                      {r.Approved_By_Name || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canCreate && (
                        <button
                          onClick={() => router.push(`/dashboard/daily-activities/generate-final-result/add?id=${r.Result_Id}`)}
                          className="p-1.5 rounded-lg text-[#2A6BB5] hover:bg-[#2A6BB5]/10 transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        )}
                        {canCreate && (
                        <button
                          onClick={() => handleDelete(r.Result_Id)}
                          disabled={deleting === r.Result_Id}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deleting === r.Result_Id ? (
                            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: Pagination */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-[#2E3093] bg-[#2E3093]/10 rounded-full px-2.5 py-0.5">
              Total Records: {pagination.total}
            </span>
            {totalPages > 1 && (
              <>
                <span className="text-xs text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(1)} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed" title="First">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed" title="Prev">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed" title="Next">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed" title="Last">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
          <span className="text-xs text-gray-400">
            Showing {rows.length > 0 ? (page - 1) * pagination.limit + 1 : 0}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
        </div>
      </div>
    </div>
  );
}
