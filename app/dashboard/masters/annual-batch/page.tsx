'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Batch {
  Batch_Id: number;
  Course_Id: number;
  Course_Name: string | null;
  Batch_code: string | null;
  Category: string | null;
  Timings: string | null;
  SDate: string | null;
  ActualDate: string | null;
  Admission_Date: string | null;
  EDate: string | null;
  Duration: string | null;
  Training_Coordinator: string | null;
  IsActive: number;
}

interface Course {
  Course_Id: number;
  Course_Name: string;
}

export default function AnnualBatchPage() {
  const router = useRouter();

  /* ---- form state ---- */
  const [courseId, setCourseId] = useState('');
  const [fromDate, setFromDate] = useState('2025-04-01');
  const [toDate, setToDate] = useState('2026-03-31');

  /* ---- data state ---- */
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  /* ---- filter panel ---- */
  const [showFilters, setShowFilters] = useState(false);

  /* ---- delete modal ---- */
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ---- load courses for dropdown ---- */
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch('/api/masters/course?limit=1000');
        const json = await res.json();
        setCourses(json.rows || []);
      } catch {
        /* ignore */
      }
    };
    fetchCourses();
  }, []);

  /* ---- fetch batches ---- */
  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (courseId) params.set('courseId', courseId);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      if (search) params.set('search', search);

      const res = await fetch(`/api/masters/annual-batch?${params.toString()}`);
      const json = await res.json();
      setBatches(json.data || []);
      setTotal(json.total || 0);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, fetchTrigger]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  /* ---- handlers ---- */
  const handleSubmit = () => {
    setPage(1);
    setFetchTrigger(t => t + 1);
  };

  const handleClear = () => {
    setCourseId('');
    setFromDate('2025-04-01');
    setToDate('2026-03-31');
    setSearch('');
    setPage(1);
    setFetchTrigger(t => t + 1);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/masters/annual-batch?id=${deleteId}`, { method: 'DELETE' });
      fetchBatches();
    } catch {
      /* ignore */
    }
    setDeleting(false);
    setDeleteId(null);
  };

  const handleExport = () => {
    const headers = ['Id', 'Course Name', 'Batch No.', 'Category', 'Timings', 'Planned Start Date', 'Actual Start Date', 'Last Date of Admission', 'Training Completion Date', 'Duration', 'Training Coordinator'];
    const rows = batches.map((b) => [
      b.Batch_Id,
      b.Course_Name || '',
      b.Batch_code || '',
      b.Category || '',
      b.Timings || '',
      formatDate(b.SDate),
      formatDate(b.ActualDate),
      formatDate(b.Admission_Date),
      formatDate(b.EDate),
      b.Duration || '',
      b.Training_Coordinator || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'annual-batches.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleDateString('en-GB');
    } catch {
      return d;
    }
  };

  const totalPages = Math.ceil(total / limit);

  /* ---- shared classes ---- */
  const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-0.5';
  const inputCls =
    'max-w-[220px] w-full bg-white border-2 border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 shadow-sm hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';
  const selectCls =
    'max-w-[220px] w-full bg-white border-2 border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 shadow-sm hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] transition-colors';

  const SectionCard = ({ title, icon, children, badge }: { title: string; icon: React.ReactNode; children: React.ReactNode; badge?: React.ReactNode }) => (
    <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-3 py-1.5 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-[#2E3093] flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-[#2E3093]/10 flex items-center justify-center">
            {icon}
          </span>
          {title}
        </h3>
        {badge}
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Annual Batch</h2>
            <p className="text-xs text-white/70">Masters &gt; Annual Batch</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/masters/annual-batch/add')}
            className="flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add +
          </button>
        </div>
      </div>

      {/* Filter Form Card */}
      <SectionCard
        title="Filter Batches"
        icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-1.5">
          {/* Course */}
          <div>
            <label className={labelCls}>
              Course <span className="text-red-400">*</span>
            </label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={selectCls}>
              <option value="">Select</option>
              {courses.map((c) => (
                <option key={c.Course_Id} value={c.Course_Id}>
                  {c.Course_Name}
                </option>
              ))}
            </select>
          </div>
          {/* From Date */}
          <div>
            <label className={labelCls}>From Date <span className="text-red-400">*</span></label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={inputCls}
            />
          </div>
          {/* To Date */}
          <div>
            <label className={labelCls}>To Date <span className="text-red-400">*</span></label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={inputCls}
            />
          </div>
          {/* Buttons */}
          <div className="flex items-end gap-2">
            <button
              onClick={handleSubmit}
              className="flex items-center justify-center gap-2 bg-[#2E3093] hover:bg-[#252780] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all shadow-md"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Submit
            </button>
            <button
              onClick={handleClear}
              className="px-5 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all shadow-sm"
            >
              Clear
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
              {total}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                showFilters ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search…"
                className="w-44 pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-400"
              />
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-medium text-gray-500 mb-1">Status</label>
                <select className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs">
                  <option value="">All</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-gray-500 mb-1">Category</label>
                <select className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs">
                  <option value="">All</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="dashboard-table w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Id</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Course Name</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Batch No.</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Category</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Timings</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Planned Start Date</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Actual Start Date</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Last Date of Admission</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Training Completion Date</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Duration</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Training Coordinator</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-gray-400">
                    No batches found
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.Batch_Id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-3 py-2.5 text-gray-700">{b.Batch_Id}</td>
                    <td className="px-3 py-2.5 text-gray-900 font-medium">{b.Course_Name || '-'}</td>
                    <td className="px-3 py-2.5 text-gray-700">{b.Batch_code || '-'}</td>
                    <td className="px-3 py-2.5 text-gray-700">{b.Category || '-'}</td>
                    <td className="px-3 py-2.5 text-gray-700">{b.Timings || '-'}</td>
                    <td className="px-3 py-2.5 text-gray-700">{formatDate(b.SDate)}</td>
                    <td className="px-3 py-2.5 text-gray-700">{formatDate(b.ActualDate)}</td>
                    <td className="px-3 py-2.5 text-gray-700">{formatDate(b.Admission_Date)}</td>
                    <td className="px-3 py-2.5 text-gray-700">{formatDate(b.EDate)}</td>
                    <td className="px-3 py-2.5 text-gray-700">{b.Duration || '-'}</td>
                    <td className="px-3 py-2.5 text-gray-700">{b.Training_Coordinator || '-'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => router.push(`/dashboard/masters/annual-batch/edit/${b.Batch_Id}`)}
                          className="p-1.5 rounded-md hover:bg-[#2E3093]/10 text-[#2E3093] transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteId(b.Batch_Id)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors"
                          title="Delete"
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
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                if (p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-2.5 py-1.5 text-xs border rounded-md transition-colors ${
                      page === p ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Batch</h3>
            <p className="text-sm text-gray-600 mb-5">Are you sure you want to delete this batch? This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
