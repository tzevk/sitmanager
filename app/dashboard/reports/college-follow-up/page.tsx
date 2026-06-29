'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { GhostBtn, PageHeader } from '@/components/ui/PageHeader';

type CollegeFollowUp = {
  id: number;
  college_name: string | null;
  CollegeName?: string | null;
  university: string | null;
  address: string | null;
  city: string | null;
  contact_person: string | null;
  telephone: string | null;
  email: string | null;
  mobile: string | null;
  website: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';

function cleanUrl(value: string | null) {
  const text = String(value || '').trim();
  if (!text) return '';
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

export default function CollegeFollowUpPage() {
  const router = useRouter();
  const { canView, loading: permLoading } = useResourcePermissions('report_college_followup');
  const { canUpdate: canUpdateCollege } = useResourcePermissions('college');

  const [rows, setRows] = useState<CollegeFollowUp[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (submittedSearch) params.set('search', submittedSearch);
      const res = await fetch(`/api/reports/college-follow-up?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load college follow ups');
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch (err: unknown) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load college follow ups');
    } finally {
      setLoading(false);
    }
  }, [page, submittedSearch]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleSearch = () => {
    setSubmittedSearch(search.trim());
    setPage(1);
  };

  const handleClear = () => {
    setSearch('');
    setSubmittedSearch('');
    setPage(1);
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view college follow ups." />;

  return (
    <div className="h-full overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col gap-3">
      <PageHeader
        title="College Follow Ups"
        breadcrumbs={[{ label: 'Reports' }, { label: 'College Follow Up' }]}
        meta={`${pagination.total.toLocaleString()} college${pagination.total === 1 ? '' : 's'}`}
        action={(
          <GhostBtn onClick={() => router.back()}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </GhostBtn>
        )}
      />

      <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
          placeholder="Search college, city, contact, email..."
          className={`${ctrl} w-full sm:w-[320px]`}
        />
        <button type="button" onClick={handleSearch} className="h-8 px-3 rounded-lg bg-[#2E3093] text-xs font-bold text-white hover:bg-[#24267A] transition-colors">
          Search
        </button>
        <button type="button" onClick={handleClear} className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:border-slate-300 transition-colors">
          Clear
        </button>
      </div>

      {error && <div className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      <div className="flex-1 min-h-0 rounded-xl border border-slate-200 overflow-hidden bg-white flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full min-w-[1180px] text-xs border-collapse [&_th]:border-r [&_th]:border-slate-200 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-slate-100 [&_td:last-child]:border-r-0">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="text-left py-2 px-3 font-bold w-[210px]">College Name</th>
                <th className="text-left py-2 px-3 font-bold w-[170px]">University</th>
                <th className="text-left py-2 px-3 font-bold w-[260px]">Address</th>
                <th className="text-left py-2 px-3 font-bold w-[110px]">City</th>
                <th className="text-left py-2 px-3 font-bold w-[150px]">Contact Person</th>
                <th className="text-left py-2 px-3 font-bold w-[120px]">Telephone</th>
                <th className="text-left py-2 px-3 font-bold w-[190px]">Email</th>
                <th className="text-left py-2 px-3 font-bold w-[130px]">Mobile</th>
                <th className="text-left py-2 px-3 font-bold w-[160px]">Website</th>
                <th className="text-center py-2 px-3 font-bold w-[90px]">Options</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="py-10 text-center text-xs text-slate-400">Loading college follow ups...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="py-10 text-center text-xs text-slate-400">No college follow ups found.</td></tr>
              ) : rows.map((row) => {
                const websiteUrl = cleanUrl(row.website);
                const collegeName = String(row.college_name || row.CollegeName || '').trim();
                return (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors align-top">
                    <td className="py-2 px-3 font-semibold text-slate-800 break-words">{collegeName || '-'}</td>
                    <td className="py-2 px-3 text-slate-600 break-words">{row.university || '-'}</td>
                    <td className="py-2 px-3 text-slate-600 whitespace-pre-wrap break-words">{row.address || '-'}</td>
                    <td className="py-2 px-3 text-slate-600">{row.city || '-'}</td>
                    <td className="py-2 px-3 text-slate-700 font-medium break-words">{row.contact_person || '-'}</td>
                    <td className="py-2 px-3 text-slate-600 font-mono">{row.telephone || '-'}</td>
                    <td className="py-2 px-3 text-slate-600 break-all">{row.email ? <a href={`mailto:${row.email}`} className="text-[#2E3093] hover:underline">{row.email}</a> : '-'}</td>
                    <td className="py-2 px-3 text-slate-600 font-mono">{row.mobile || '-'}</td>
                    <td className="py-2 px-3 text-slate-600 break-all">{websiteUrl ? <a href={websiteUrl} target="_blank" rel="noreferrer" className="text-[#2E3093] hover:underline">{row.website}</a> : '-'}</td>
                    <td className="py-2 px-3 text-center">
                      {canUpdateCollege ? (
                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard/masters/college/edit/${row.id}`)}
                          className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#2E3093]/10 text-[#2E3093] text-[11px] font-semibold hover:bg-[#2E3093]/15 transition-colors"
                        >
                          Edit
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-4 py-2 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">
            Page {pagination.page} of {Math.max(1, pagination.totalPages)}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed">Prev</button>
            <button type="button" onClick={() => setPage((value) => Math.min(Math.max(1, pagination.totalPages), value + 1))} disabled={page >= pagination.totalPages} className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}