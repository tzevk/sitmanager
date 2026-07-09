'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface VoucherRow {
  id: number;
  company: string | null;
  voucherno: string | null;
  date: string | null;
  paidto: string | null;
  paidby: string | null;
  prepaired_by: string | null;
  opening_balance: number | null;
  total_amount: number;
}

interface Pagination { page: number; limit: number; total: number; totalPages: number }

const fmtMoney = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CashVoucherPage() {
  const router = useRouter();
  const { canView, canCreate, loading: permLoading } = useResourcePermissions('finance');

  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const searchRef = useRef<HTMLInputElement>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (search) params.set('search', search);

      const res = await fetch(`/api/account-master/cash-voucher?${params.toString()}`);
      const data = await res.json();
      setRows(data.vouchers ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fetchTrigger]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setPage(1);
      setFetchTrigger((t) => t + 1);
    }
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view cash vouchers." />;

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6 flex flex-col">
      <div className="mb-6 flex-shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <span>Dashboard</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span>Admin/Accounts</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span className="text-[#2E3093] font-medium">Cash Voucher</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Cash Voucher</h1>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push('/dashboard/account-master/cash-voucher/add')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-sm font-semibold rounded-lg shadow hover:shadow-md transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Cash Voucher
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-5 py-3 flex-shrink-0">
          <h3 className="text-sm font-bold text-white tracking-wide">All Cash Vouchers</h3>
        </div>
        <div className="p-5 flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex flex-wrap items-center gap-2 mb-4 flex-shrink-0">
            <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">
              {pagination.total.toLocaleString()}
            </span>
            <div className="flex-1" />
            <div className="relative">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search voucher no, paid to, company…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-64 pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden flex-1 min-h-0">
            <div className="overflow-auto max-h-full">
              <table className="dashboard-table w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="bg-gradient-to-r from-[#2E3093]/10 to-[#2A6BB5]/10">
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Voucher No.</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Date</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Company</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Paid To</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Prepared By</th>
                    <th className="text-right px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Opening Balance</th>
                    <th className="text-right px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                          Loading...
                        </div>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No cash vouchers found</td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2.5 font-mono font-semibold text-[#2E3093]">{row.voucherno || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-700">{row.date || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-700">{row.company || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-900 font-medium truncate max-w-[180px]" title={row.paidto || ''}>{row.paidto || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-700">{row.prepaired_by || '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700">{fmtMoney(row.opening_balance)}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-900">{fmtMoney(row.total_amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 flex-shrink-0">
              <span className="text-xs text-gray-500">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total.toLocaleString()} total)
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1 text-xs font-medium border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="px-2.5 py-1 text-xs font-medium border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
