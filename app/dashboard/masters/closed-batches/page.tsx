'use client';

import { useEffect, useState } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { toBatchNumber } from '@/lib/batch-display';

type Row = {
  Batch_Id: number;
  Batch_code: string;
  Course_Name?: string | null;
  SDate?: string | null;
  EDate?: string | null;
  Timings?: string | null;
  Category?: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function formatDate(raw?: string | null) {
  if (!raw) return '-';
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return String(raw);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ClosedBatchesPage() {
  const { canView, loading: permLoading } = useResourcePermissions('batch');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', '25');
        if (search) params.set('search', search);

        const res = await fetch(`/api/masters/closed-batches?${params.toString()}`);
        const data = await res.json();
        setRows(Array.isArray(data?.rows) ? data.rows : []);
        setPagination(data?.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
      } catch {
        setRows([]);
        setPagination({ page: 1, limit: 25, total: 0, totalPages: 0 });
      } finally {
        setLoading(false);
      }
    })();
  }, [page, search]);

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view closed batches." />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <span>Dashboard</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span>Masters</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-[#2E3093] font-medium">Closed Batches</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Closed Batches</h1>
        <p className="text-sm text-gray-500 mt-1">Automatically listed after batch end date.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-6 py-4">
          <h2 className="text-lg font-bold text-white">Closed Batch List</h2>
        </div>

        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center gap-3">
          <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">{pagination.total}</span>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search batch/course/category"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  setSearch(searchInput.trim());
                }
              }}
              className="w-60 pl-3 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
            />
            <button
              onClick={() => {
                setPage(1);
                setSearch(searchInput.trim());
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#2E3093] text-white hover:bg-[#25277a]"
            >
              Search
            </button>
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">No closed batches found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="dashboard-table w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-[#2E3093]/10 to-[#2A6BB5]/10">
                  <th className="text-left px-6 py-3 font-semibold text-[#2E3093]">Batch</th>
                  <th className="text-left px-6 py-3 font-semibold text-[#2E3093]">Course</th>
                  <th className="text-left px-6 py-3 font-semibold text-[#2E3093]">Start Date</th>
                  <th className="text-left px-6 py-3 font-semibold text-[#2E3093]">End Date</th>
                  <th className="text-left px-6 py-3 font-semibold text-[#2E3093]">Timing</th>
                  <th className="text-left px-6 py-3 font-semibold text-[#2E3093]">Category</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.Batch_Id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-800 font-medium">{toBatchNumber(row.Batch_code)}</td>
                    <td className="px-6 py-3 text-gray-700">{row.Course_Name || '-'}</td>
                    <td className="px-6 py-3 text-gray-700">{formatDate(row.SDate)}</td>
                    <td className="px-6 py-3 text-gray-700">{formatDate(row.EDate)}</td>
                    <td className="px-6 py-3 text-gray-700">{row.Timings || '-'}</td>
                    <td className="px-6 py-3 text-gray-700">{row.Category || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
