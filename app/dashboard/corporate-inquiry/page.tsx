'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { PageHeader, FilterBar, GhostBtn, PrimaryBtn } from '@/components/ui/PageHeader';

interface CorporateInquiry {
  Id: number;
  Fname: string;
  Lname: string;
  MName: string;
  FullName: string;
  CompanyName: string;
  Designation: string;
  Address: string;
  City: string;
  State: string;
  Country: string;
  Pin: string;
  Phone: string;
  Mobile: string;
  Email: string;
  Course_Id: string;
  CourseName?: string | null;
  Place: string;
  business: string;
  Remark: string;
  Idate: string;
  IsActive: number;
  InquiryStatus?: string | null;
  CompanyType?: string | null;
  CompanyAuthority?: string | null;
  TrainingMode?: string | null;
  Participants_Fresher?: number | null;
  Participants_Experienced?: number | null;
  TrainingLocation?: string | null;
  TrainingDates?: string | null;
  Discussion?: string | null;
  DiscussionOutcome?: 'Awarded' | 'Regretted' | 'On Hold' | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const raw = String(dateStr).trim();
    let date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      const match = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
      if (match) date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    }
    if (Number.isNaN(date.getTime())) return '—';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]} ${date.getFullYear()}`;
  } catch { return '—'; }
}

function displayName(inq: CorporateInquiry): string {
  return inq.FullName || `${inq.Fname || ''} ${inq.Lname || ''}`.trim() || '—';
}

function displayCourse(inq: CorporateInquiry): string {
  return inq.CourseName || inq.Course_Id || '—';
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-xs text-slate-400">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    Rejected:        { label: 'Cancelled',   cls: 'border-red-300 bg-white/70 text-red-700' },
    Final:           { label: 'Converted',   cls: 'border-emerald-300 bg-white/70 text-emerald-700' },
    UnderDiscussion: { label: 'In Discussion', cls: 'border-blue-300 bg-white/70 text-blue-700' },
  };
  const s = map[status] ?? { label: status, cls: 'border-slate-300 bg-white/70 text-slate-700' };
  return (
    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  );
}

function rowColor(status: string | null | undefined) {
  if (status === 'Rejected')        return 'bg-red-100 hover:bg-red-200/80 [&>td]:text-red-950';
  if (status === 'Final')           return 'bg-emerald-100 hover:bg-emerald-200/80 [&>td]:text-emerald-950';
  if (status === 'UnderDiscussion') return 'bg-blue-100 hover:bg-blue-200/80 [&>td]:text-blue-950';
  return 'bg-white hover:bg-slate-50 [&>td]:text-slate-800';
}

function DiscussionOutcomeBadge({ outcome }: { outcome: string | null | undefined }) {
  if (!outcome) return null;
  const map: Record<string, { label: string; cls: string }> = {
    Awarded: { label: 'Awarded', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    Regretted: { label: 'Regretted', cls: 'border-rose-200 bg-rose-50 text-rose-700' },
    'On Hold': { label: 'On Hold', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  };
  const badge = map[outcome] ?? { label: outcome, cls: 'border-slate-200 bg-slate-50 text-slate-600' };
  return (
    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${badge.cls}`}>
      {badge.label}
    </span>
  );
}

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';

export default function CorporateInquiryPage() {
  const router = useRouter();
  const { canView, canCreate, canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');
  const [inquiries, setInquiries] = useState<CorporateInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [updating, setUpdating] = useState<number | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      setError('');
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        search,
      });
      const res = await fetch(`/api/admission-activity/corporate-inquiry?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch corporate inquiries');
      setInquiries(data.rows || []);
      setPagination((prev) => ({
        ...prev,
        total: data.pagination?.total ?? 0,
        totalPages: data.pagination?.totalPages ?? 0,
      }));
    } catch (e) {
      console.error('Fetch error:', e);
      setInquiries([]);
      setError(e instanceof Error ? e.message : 'Failed to load corporate inquiries');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, fetchTrigger, search]);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages)
      setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const doSearch = () => {
    setSearch(searchInput.trim());
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFetchTrigger((t) => t + 1);
  };

  const doClear = () => {
    setSearchInput('');
    setSearch('');
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFetchTrigger((t) => t + 1);
  };

  const updateStatus = async (id: number, status: 'Rejected' | 'Final') => {
    const verb = status === 'Rejected' ? 'cancel' : 'convert to training execution';
    if (!confirm(`Are you sure you want to ${verb} this inquiry?`)) return;
    const prevStatus = inquiries.find((r) => r.Id === id)?.InquiryStatus ?? null;
    setUpdating(id);
    // Optimistic: update color immediately
    setInquiries((prev) => prev.map((r) => r.Id === id ? { ...r, InquiryStatus: status } : r));
    try {
      const res = await fetch('/api/admission-activity/corporate-inquiry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Id: id, InquiryStatus: status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      if (status === 'Final') {
        router.push(`/dashboard/corporate-inquiry/execution/${id}?tab=execution`);
        return;
      }
      // Keep optimistic state — color is already correct; background refresh
      setFetchTrigger((t) => t + 1);
    } catch (e) {
      setInquiries((prev) => prev.map((r) => r.Id === id ? { ...r, InquiryStatus: prevStatus } : r));
      alert('Update failed');
      console.error(e);
    } finally {
      setUpdating(null);
    }
  };

  const handleExport = () => {
    const headers = ['Id','Enquiry Date','Training Programme','Company Name','Company Location','Company Type','Company Authority','Coordinator Name','Coordinator Mobile','Coordinator Email','Training Mode','Training Location','Status','Execution Outcome','Disciplines','Remarks'];
    const csvContent = [
      headers.join(','),
      ...inquiries.map((inq) => [
        inq.Id,
        `"${String(inq.Idate || '').replace(/"/g,'""')}"`,
        `"${String(displayCourse(inq) === '—' ? '' : displayCourse(inq)).replace(/"/g,'""')}"`,
        `"${String(inq.CompanyName || '').replace(/"/g,'""')}"`,
        `"${String(inq.Place || '').replace(/"/g,'""')}"`,
        `"${String(inq.CompanyType || '').replace(/"/g,'""')}"`,
        `"${String(inq.CompanyAuthority || '').replace(/"/g,'""')}"`,
        `"${String(inq.FullName || `${inq.Fname||''} ${inq.Lname||''}`.trim()).replace(/"/g,'""')}"`,
        `"${String(inq.Mobile || inq.Phone || '').replace(/"/g,'""')}"`,
        `"${String(inq.Email || '').replace(/"/g,'""')}"`,
        `"${String(inq.TrainingMode || '').replace(/"/g,'""')}"`,
        `"${String(inq.TrainingLocation || '').replace(/"/g,'""')}"`,
        `"${String(inq.InquiryStatus === 'Rejected' ? 'Cancelled' : (inq.InquiryStatus || '')).replace(/"/g,'""')}"`,
        `"${String(inq.DiscussionOutcome || '').replace(/"/g,'""')}"`,
        `"${String(inq.business || '').replace(/"/g,'""')}"`,
        `"${String(inq.Remark || '').replace(/"/g,'""')}"`,
      ].join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'corporate_inquiries.csv';
    link.click();
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view corporate inquiries." />;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-6">

      <PageHeader
        title="Corporate Inquiry"
        breadcrumbs={[{ label: 'Corporate Training' }, { label: 'Corporate Inquiry' }]}
        meta={`${pagination.total.toLocaleString()} records`}
        action={<>
          <GhostBtn onClick={handleExport}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
            </svg>
            Export
          </GhostBtn>
          {canCreate && (
            <PrimaryBtn onClick={() => router.push('/dashboard/corporate-inquiry/add')}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Inquiry
            </PrimaryBtn>
          )}
        </>}
      />

      <FilterBar>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          placeholder="Search company, contact, mobile, email..."
          className={`${ctrl} flex-1 min-w-[220px] h-8 py-1`}
        />
        <button onClick={doSearch} className="h-8 flex items-center gap-1 bg-[#2E3093] text-white px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-[#252880] transition-colors">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search
        </button>
        <button onClick={doClear} className="h-8 px-2.5 py-1 text-xs font-semibold text-slate-600 border border-zinc-300 rounded-lg hover:bg-slate-50 transition-colors">
          Clear
        </button>
        <span className="ml-auto text-[11px] font-medium text-slate-400 tabular-nums">
          {inquiries.length} shown
        </span>
      </FilterBar>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse [&_th]:border-r [&_th]:border-slate-300 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-slate-200 [&_td:last-child]:border-r-0">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-700 bg-slate-200 border-b border-slate-300">
                <th className="text-left py-2 px-3 font-bold">#</th>
                <th className="text-left py-2 px-3 font-bold">Inquiry</th>
                <th className="text-left py-2 px-3 font-bold">Training Programme</th>
                <th className="text-left py-2 px-3 font-bold">Company</th>
                <th className="text-left py-2 px-3 font-bold">Contact Person</th>
                <th className="text-left py-2 px-3 font-bold">Training Info</th>
                <th className="text-left py-2 px-3 font-bold">Participants</th>
                <th className="text-center py-2 px-3 font-bold">Status</th>
                <th className="text-center py-2 px-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center">
                    <div className="inline-flex flex-col items-center gap-1.5">
                      <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-400">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : inquiries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-xs text-slate-400">No corporate inquiries found</td>
                </tr>
              ) : inquiries.map((inq, idx) => {
                const name = displayName(inq);
                const participantCount = Number(inq.Participants_Fresher || 0) + Number(inq.Participants_Experienced || 0);
                return (
                  <tr key={inq.Id} className={`border-b border-slate-200 transition-colors ${rowColor(inq.InquiryStatus)}`}>
                    <td className="py-1 px-2 font-semibold font-mono tabular-nums relative pl-3">
                      {(pagination.page - 1) * pagination.limit + idx + 1}
                    </td>
                    <td className="py-1 px-2 whitespace-nowrap min-w-[108px]">
                      <div className="flex flex-col leading-tight">
                        <span className="font-semibold text-slate-700">{formatDate(inq.Idate)}</span>
                        <span className="text-[9px] text-slate-400 font-mono">#{inq.Id}</span>
                      </div>
                    </td>
                    <td className="py-1 px-2 max-w-[180px] align-top">
                      <span className="truncate block font-semibold text-red-600">{displayCourse(inq)}</span>
                      {inq.TrainingDates && <span className="truncate block text-[10px] text-slate-500">{inq.TrainingDates}</span>}
                    </td>
                    <td className="py-1 px-2 max-w-[180px] align-top">
                      <span className="truncate block font-semibold">{inq.CompanyName || '—'}</span>
                      <span className="truncate block text-[10px] text-slate-500">{inq.Place || inq.City || '—'}</span>
                      {inq.CompanyType && (
                        <span className="inline-flex mt-0.5 rounded-full border border-slate-300 bg-white/70 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                          {inq.CompanyType}
                        </span>
                      )}
                    </td>
                    <td className="py-1 px-2 min-w-[170px] max-w-[220px] align-top">
                      <span className="truncate block font-semibold">{name}</span>
                      {inq.Designation && <span className="truncate block text-[10px] text-slate-500">{inq.Designation}</span>}
                      <span className="truncate block text-[10px] text-slate-600 font-mono">{inq.Mobile || inq.Phone || '—'}</span>
                      {inq.Email && <span className="truncate block text-[10px] text-slate-500">{inq.Email}</span>}
                    </td>
                    <td className="py-1 px-2 min-w-[150px] align-top">
                      <div className="flex flex-col leading-tight">
                        <span className="font-semibold">{inq.TrainingMode || '—'}</span>
                        <span className="text-[10px] text-slate-500">{inq.TrainingLocation || '—'}</span>
                        {inq.CompanyAuthority && <span className="truncate text-[10px] text-slate-500">{inq.CompanyAuthority}</span>}
                      </div>
                    </td>
                    <td className="py-1 px-2 whitespace-nowrap align-top">
                      {participantCount > 0 ? (
                        <div className="flex flex-col leading-tight">
                          <span className="font-semibold tabular-nums">{participantCount}</span>
                          <span className="text-[10px] text-slate-500">F {inq.Participants_Fresher ?? 0} / E {inq.Participants_Experienced ?? 0}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="py-1 px-2 text-center align-top">
                      <div className="flex flex-col items-center gap-1">
                        <StatusBadge status={inq.InquiryStatus} />
                        <DiscussionOutcomeBadge outcome={inq.DiscussionOutcome} />
                      </div>
                    </td>
                    <td className="py-1.5 px-2 align-top">
                      <div className="flex items-center justify-center gap-1.5 flex-nowrap whitespace-nowrap">
                        {canUpdate && (
                          <button
                            onClick={() => router.push(`/dashboard/corporate-inquiry/edit/${inq.Id}`)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                            title="Edit inquiry"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {canUpdate && (
                          <button
                            onClick={() => updateStatus(inq.Id, 'Final')}
                            disabled={updating === inq.Id || inq.InquiryStatus === 'Final'}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-white bg-[#2E3093] border border-[#2E3093] hover:bg-[#24267A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Convert to Execution"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        {canUpdate && (
                          <button
                            onClick={() => router.push(`/dashboard/corporate-inquiry/proposal/${inq.Id}`)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                            title="Make Proposal"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                        )}
                        {canUpdate && (
                          <button
                            onClick={() => updateStatus(inq.Id, 'Rejected')}
                            disabled={updating === inq.Id || inq.InquiryStatus === 'Rejected'}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Cancel Inquiry"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[11px] text-slate-400">
            {inquiries.length ? (pagination.page - 1) * pagination.limit + 1 : 0}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => handlePageChange(1)} disabled={pagination.page <= 1} className="px-2 py-0.5 text-[11px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 font-semibold text-slate-600">First</button>
            <button onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page <= 1} className="px-1.5 py-0.5 rounded border border-slate-200 hover:bg-white disabled:opacity-30 text-slate-600">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            {(() => {
              const current = pagination.page;
              const total = pagination.totalPages || 1;
              const pages = [];
              for (let p = Math.max(1, current - 2); p <= Math.min(total, current + 2); p++) pages.push(p);
              return pages.map((p) => (
                <button key={p} onClick={() => handlePageChange(p)}
                  className={`w-6 h-6 text-[11px] rounded border font-semibold ${p === current ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'border-slate-200 hover:bg-white text-slate-600'}`}>
                  {p}
                </button>
              ));
            })()}
            <button onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="px-1.5 py-0.5 rounded border border-slate-200 hover:bg-white disabled:opacity-30 text-slate-600">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
            <button onClick={() => handlePageChange(pagination.totalPages || 1)} disabled={pagination.page >= pagination.totalPages} className="px-2 py-0.5 text-[11px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 font-semibold text-slate-600">Last</button>
          </div>
        </div>
      </div>
    </div>
  );
}
