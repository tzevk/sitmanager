'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaSearch, FaChevronLeft, FaChevronRight, FaEdit, FaCheckCircle } from 'react-icons/fa';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface ConvertedInquiryRow {
  Id: number;
  Idate: string | null;
  Course_Id: string | null;
  CompanyName: string | null;
  TrainingMode: string | null;
  DiscussionOutcome: string | null;
  InitialFollowUpDate: string | null;
  NextFollowUpDate: string | null;
  FollowUp: string | null;
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

function getRecentFollowUp(raw: unknown, nextDate: string | null | undefined): string {
  const fallback = toDate(nextDate);
  if (!raw) return fallback;
  const s = String(raw);
  if (!s.trim()) return fallback;
  try {
    const obj = JSON.parse(s) as unknown;
    const rec: Record<string, unknown> = typeof obj === 'object' && obj !== null ? (obj as Record<string, unknown>) : {};
    const items = Array.isArray(rec.items) ? (rec.items as unknown[]) : [];
    const last = items.length ? items[items.length - 1] : null;
    const lastRec: Record<string, unknown> = typeof last === 'object' && last !== null ? (last as Record<string, unknown>) : {};
    const lastDate = String(lastRec.date ?? '').trim();
    if (lastDate) return toDate(lastDate);
    const next = String(rec.nextDate ?? '').trim();
    if (next) return toDate(next);
    return fallback;
  } catch {
    return fallback;
  }
}

export default function TrainingDiscussionIndexPage() {
  const router = useRouter();
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');

  const [rows, setRows] = useState<ConvertedInquiryRow[]>([]);
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
        status: 'UnderDiscussion',
      });
      const res = await fetch(`/api/admission-activity/corporate-inquiry?${params.toString()}`);
      const data = await res.json();
      setRows((data.rows ?? []) as ConvertedInquiryRow[]);
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

  const handleConvert = async (id: number) => {
    if (!confirm('Are you sure you want to convert to training execution?')) return;
    try {
      const res = await fetch('/api/admission-activity/corporate-inquiry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Id: id, InquiryStatus: 'Final' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Convert failed');
      router.push(`/dashboard/corporate-inquiry/final/${id}`);
    } catch (e) {
      alert('Convert failed');
      console.error(e);
    }
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view training discussions." />;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Training Discussion</h2>
            <p className="text-sm text-gray-400">Corporate inquiries under discussion</p>
          </div>
          <div className="relative min-w-[220px] max-w-md flex-1">
            <FaSearch className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="Search name, email, company..."
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 bg-white shadow-sm"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 rounded-lg bg-[#2E3093] hover:bg-[#25277A] text-white font-semibold text-sm shadow-sm transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dashboard-table w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100">
                <th className="text-left py-3 px-4 font-semibold">Enquiry Date</th>
                <th className="text-left py-3 px-4 font-semibold">Training Programme</th>
                <th className="text-left py-3 px-4 font-semibold">Company Name</th>
                <th className="text-left py-3 px-4 font-semibold">Training Mode</th>
                <th className="text-left py-3 px-4 font-semibold">Discussion Outcome</th>
                <th className="text-left py-3 px-4 font-semibold">Meeting Date</th>
                <th className="text-left py-3 px-4 font-semibold">Recent Follow Up</th>
                <th className="text-center py-3 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-400">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-gray-400">No training discussion inquiries found</td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={r.Id} className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="py-3 px-4 text-gray-700">{toDate(r.Idate)}</td>
                    <td className="py-3 px-4 text-gray-700">{r.Course_Id || '-'}</td>
                    <td className="py-3 px-4 text-gray-700">{r.CompanyName || '-'}</td>
                    <td className="py-3 px-4 text-gray-700">{r.TrainingMode || '-'}</td>
                    <td className="py-3 px-4 text-gray-700">{r.DiscussionOutcome || '-'}</td>
                    <td className="py-3 px-4 text-gray-700">{toDate(r.InitialFollowUpDate)}</td>
                    <td className="py-3 px-4 text-gray-700">{getRecentFollowUp(r.FollowUp, r.NextFollowUpDate)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canUpdate && (
                          <button
                            onClick={() => router.push(`/dashboard/corporate-inquiry/convert/${r.Id}`)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#2A6BB5] transition-colors"
                            title="Edit"
                          >
                            <FaEdit className="w-4 h-4" />
                          </button>
                        )}

                        {canUpdate && (
                          <button
                            onClick={() => handleConvert(r.Id)}
                            className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                            title="Convert to Training Execution"
                          >
                            <FaCheckCircle className="w-4 h-4" />
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
      </div>

      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-gray-600">
          Showing {rows.length ? (pagination.page - 1) * pagination.limit + 1 : 0} -{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="p-2 rounded-lg bg-white border border-gray-300 disabled:opacity-50 hover:bg-gray-50 transition"
          >
            <FaChevronLeft />
          </button>
          <span className="text-sm">Page {pagination.page} of {pagination.totalPages || 1}</span>
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= (pagination.totalPages || 1)}
            className="p-2 rounded-lg bg-white border border-gray-300 disabled:opacity-50 hover:bg-gray-50 transition"
          >
            <FaChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}
