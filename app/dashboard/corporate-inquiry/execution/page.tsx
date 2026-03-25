'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaSearch, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface ExecutionRow {
  Id: number;
  Idate: string | null;
  Course_Id: string | null;
  FullName: string | null;
  CompanyName: string | null;
  Place: string | null;
  InquiryStatus: string | null;

  TrainingNumber: string | null;
  TrainingDate: string | null;
  TrainerName: string | null;
  NumberOfDays: number | null;
  TotalStudents: number | null;
  TrainingCoordinator: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const toDate = (v: string | null | undefined) => {
  if (!v) return '-';
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return String(v);
  }
};

export default function TrainingExecutionIndexPage() {
  const router = useRouter();
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');

  const [rows, setRows] = useState<ExecutionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        search,
        status: 'Final',
      });
      const res = await fetch(`/api/admission-activity/corporate-inquiry?${params.toString()}`);
      const data = await res.json();
      setRows((data.rows ?? []) as ExecutionRow[]);
      setPagination((prev) => ({
        ...prev,
        total: data.pagination?.total ?? 0,
        totalPages: data.pagination?.totalPages ?? 0,
      }));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, fetchTrigger]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    setPagination((p) => ({ ...p, page: 1 }));
    setFetchTrigger((t) => t + 1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= (pagination.totalPages || 1)) {
      setPagination((p) => ({ ...p, page: newPage }));
    }
  };

  if (permLoading || loading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view training executions." />;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Training Execution</h2>
            <p className="text-sm text-gray-400">{pagination.total.toLocaleString()} total records</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative min-w-[240px]">
              <FaSearch className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                placeholder="Search company, coordinator..."
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 bg-white shadow-sm"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 rounded-lg bg-[#2E3093] hover:bg-[#262a7d] text-white text-sm font-semibold"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dashboard-table w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs">
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">Company</th>
                <th className="text-left p-3">Coordinator</th>
                <th className="text-left p-3">Training No.</th>
                <th className="text-left p-3">Trainer</th>
                <th className="text-left p-3">Training Date</th>
                <th className="text-left p-3">Students</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-gray-400" colSpan={8}>
                    No records found
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.Id} className="border-t border-gray-100">
                    <td className="p-3 text-gray-700">{r.Id}</td>
                    <td className="p-3 text-gray-700">{r.CompanyName || '-'}</td>
                    <td className="p-3 text-gray-700">{r.FullName || '-'}</td>
                    <td className="p-3 text-gray-700">{r.TrainingNumber || '-'}</td>
                    <td className="p-3 text-gray-700">{r.TrainerName || '-'}</td>
                    <td className="p-3 text-gray-700">{toDate(r.TrainingDate)}</td>
                    <td className="p-3 text-gray-700">{r.TotalStudents ?? '-'}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/dashboard/corporate-inquiry/execution/${r.Id}`)}
                          className="px-3 py-1.5 rounded-lg bg-[#2E3093] hover:bg-[#262a7d] text-white text-xs font-semibold"
                          title="Open training execution"
                        >
                          Open
                        </button>
                        {canUpdate && (
                          <button
                            onClick={() => router.push(`/dashboard/corporate-inquiry/edit/${r.Id}`)}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50"
                            title="Inquiry details"
                          >
                            Inquiry
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

        <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50">
          <div className="text-sm text-gray-500">
            Page <span className="font-semibold text-gray-700">{pagination.page}</span> of{' '}
            <span className="font-semibold text-gray-700">{pagination.totalPages || 1}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white flex items-center gap-2"
            >
              <FaChevronLeft /> Prev
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= (pagination.totalPages || 1)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white flex items-center gap-2"
            >
              Next <FaChevronRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
