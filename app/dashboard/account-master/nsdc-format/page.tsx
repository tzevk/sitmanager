'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';

interface NsdcRow {
  Student_Id: number;
  Student_Name: string;
  Father_Name: string | null;
  Mother_Name: string | null;
  Sex: string | null;
  DOB: string | null;
  Aadhar_Number: string | null;
  Social_Category: string | null;
  Present_Mobile: string | null;
  Email: string | null;
  Present_City: string | null;
  Present_State: string | null;
  Qualification: string | null;
  Batch_Code: string | null;
  Course_Name: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const PAGE_SIZE = 25;
const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] placeholder:text-slate-400 transition-colors';

export default function NsdcFormatListPage() {
  const router = useRouter();
  const perms = useResourcePermissions('nsdc_format');
  const { loading: permLoading, canView } = perms;

  const [rows, setRows] = useState<NsdcRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      const res = await fetch(`/api/account-master/nsdc-format?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRows(Array.isArray(data.rows) ? data.rows : []);
        setPagination(data.pagination || { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    if (canView) fetchRows();
  }, [canView, fetchRows]);

  const doSearch = () => { setSearch(searchInput.trim()); setPage(1); };
  const doClear = () => { setSearch(''); setSearchInput(''); setPage(1); };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view NSDC Format." />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="NSDC Format"
        breadcrumbs={[{ label: 'Admin/Accounts' }, { label: 'NSDC Format' }]}
        meta={`${pagination.total.toLocaleString()} students`}
      />

      <FilterBar>
        <input
          type="text"
          value={searchInput}
          placeholder="Search name, mobile, email, Aadhar…"
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          className={`${ctrl} flex-1 min-w-[220px]`}
        />
        <button type="button" onClick={doSearch} className="px-3 py-1.5 rounded-lg bg-[#6366F1] text-white text-xs font-semibold hover:bg-[#6366F1]/90">Search</button>
        {search && <button type="button" onClick={doClear} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Clear</button>}
      </FilterBar>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">ID</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Candidate Name</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Father&apos;s Name</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Gender</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">DOB</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Aadhar Number</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Category</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Mobile</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Email</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">City</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">State</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Qualification</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Course</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Batch Code</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-500">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={15} className="px-3 py-10 text-center text-slate-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={15} className="px-3 py-10 text-center text-slate-400">No students found.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.Student_Id} className="hover:bg-slate-50">
                    <td className="px-3 py-1.5 text-slate-400">{r.Student_Id}</td>
                    <td className="px-3 py-1.5 font-medium text-slate-800 whitespace-nowrap">{r.Student_Name}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.Father_Name || '—'}</td>
                    <td className="px-3 py-1.5">{r.Sex || '—'}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.DOB || '—'}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.Aadhar_Number || <span className="text-amber-500">Missing</span>}</td>
                    <td className="px-3 py-1.5">{r.Social_Category || <span className="text-amber-500">Missing</span>}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.Present_Mobile || '—'}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.Email || '—'}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.Present_City || '—'}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.Present_State || '—'}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.Qualification || '—'}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.Course_Name || '—'}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.Batch_Code || '—'}</td>
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => router.push(`/dashboard/account-master/nsdc-format/${r.Student_Id}`)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-[#2A6BB5] hover:bg-slate-50"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <span className="text-[11px] text-slate-500">Page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
              <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
