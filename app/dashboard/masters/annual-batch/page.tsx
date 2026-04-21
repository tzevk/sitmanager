'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

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
  const { canView, canCreate, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('annual_batch');

  /* ---- form state ---- */
  const [courseId, setCourseId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  /* ---- data state ---- */
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [fetchTrigger, setFetchTrigger] = useState(0);

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
    setFromDate('');
    setToDate('');
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
    const headers = ['Id', 'Training Name', 'Batch No.', 'Category', 'Timings', 'Planned Start Date', 'Actual Start Date', 'Last Date of Admission', 'Training Completion Date', 'Duration', 'Training Coordinator'];
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
  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5';
  const inputCls =
    'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 focus:border-[#2E3093] placeholder:text-slate-400 transition-all font-medium';
  const selectCls =
    'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 focus:border-[#2E3093] transition-all font-medium';

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view annual batches." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-2xl px-8 py-6 shadow-[0_10px_30px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Annual Batch</h2>
            <p className="text-[14px] text-white/80 font-medium mt-1">Masters &gt; Annual Batch</p>
          </div>
          {canCreate && (
          <button
            onClick={() => router.push('/dashboard/masters/annual-batch/add')}
            className="flex items-center gap-2 bg-[#FAE452] text-[#2E3093] px-5 py-2.5 rounded-xl text-sm font-extrabold transition-all shadow-[0_10px_24px_rgba(0,0,0,0.14)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)] hover:-translate-y-0.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add New Batch
          </button>
          )}
        </div>
      </div>

      {/* Filters (single line) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-nowrap lg:items-end">
          {/* Course */}
          <div className="w-full lg:flex-1 lg:min-w-[260px]">
            <label className={labelCls}>Course</label>
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
          <div className="w-full lg:w-[190px]">
            <label className={labelCls}>From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={inputCls}
            />
          </div>
          {/* To Date */}
          <div className="w-full lg:w-[190px]">
            <label className={labelCls}>To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={inputCls}
            />
          </div>
          {/* Buttons */}
          <div className="w-full lg:w-auto">
            <div className={labelCls}>Actions</div>
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                className="w-full lg:w-[140px] flex items-center justify-center gap-2 bg-[#2E3093] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Submit
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

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-[#2E3093] bg-[#FAE452]/60 border border-[#FAE452] rounded-full px-3 py-1">
              {total}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl text-[#2E3093] bg-white hover:border-[#2E3093]/30 transition-colors"
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
                  setFetchTrigger(t => t + 1);
                }}
                placeholder="Search…"
                className="w-48 pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 focus:border-[#2E3093] placeholder:text-slate-400 transition-all"
              />
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="dashboard-table w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 font-bold text-slate-600">Id</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600">Training Name</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600">Batch No.</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600">Category</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600">Timings</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600">Planned Start Date</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600">Actual Start Date</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600">Last Date of Admission</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600">Training Completion Date</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600">Duration</th>
                <th className="text-left px-4 py-3 font-bold text-slate-600">Training Coordinator</th>
                <th className="text-center px-4 py-3 font-bold text-slate-600">Action</th>
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
                  <td colSpan={12} className="text-center py-12 text-slate-400">
                    No batches found
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.Batch_Id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 text-slate-700">{b.Batch_Id}</td>
                    <td className="px-4 py-3 text-slate-900 font-semibold">{b.Course_Name || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{b.Batch_code || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{b.Category || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{b.Timings || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(b.SDate)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(b.ActualDate)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(b.Admission_Date)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(b.EDate)}</td>
                    <td className="px-4 py-3 text-slate-700">{b.Duration || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{b.Training_Coordinator || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {canUpdate && (
                        <button
                          onClick={() => router.push(`/dashboard/masters/annual-batch/edit/${b.Batch_Id}`)}
                          className="p-2 rounded-lg hover:bg-[#FAE452]/70 text-[#2E3093] transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        )}
                        {canDelete && (
                        <button
                          onClick={() => setDeleteId(b.Batch_Id)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-500 font-medium">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl hover:border-[#2E3093]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                    className={`px-3 py-2 text-sm border rounded-xl transition-colors ${
                      page === p ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'border-slate-200 hover:border-[#2E3093]/30'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl hover:border-[#2E3093]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
