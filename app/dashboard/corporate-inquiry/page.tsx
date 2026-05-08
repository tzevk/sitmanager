'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FaPlus, FaFileExport, FaEdit, FaSearch, FaChevronLeft, FaChevronRight, FaTimesCircle, FaCheckCircle, FaFileSignature } from 'react-icons/fa';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { PageHeader, GhostBtn, PrimaryBtn } from '@/components/ui/PageHeader';

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

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-xs text-gray-400">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    Rejected:        { label: 'Cancelled',   cls: 'bg-red-100 text-red-700 border border-red-200' },
    Final:           { label: 'Converted',   cls: 'bg-green-100 text-green-700 border border-green-200' },
    UnderDiscussion: { label: 'In Discussion', cls: 'bg-blue-100 text-blue-700 border border-blue-200' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600 border border-gray-200' };
  return (
    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  );
}

function rowColor(status: string | null | undefined, idx: number) {
  if (status === 'Rejected')        return 'bg-red-50 hover:bg-red-100';
  if (status === 'Final')           return 'bg-green-50 hover:bg-green-100';
  if (status === 'UnderDiscussion') return 'bg-blue-50 hover:bg-blue-100';
  return idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/40 hover:bg-gray-50';
}

function DiscussionOutcomeBadge({ outcome }: { outcome: string | null | undefined }) {
  if (!outcome) return <span className="text-xs text-gray-400">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    Awarded: { label: 'Awarded', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
    Regretted: { label: 'Regretted', cls: 'bg-rose-100 text-rose-700 border border-rose-200' },
    'On Hold': { label: 'On Hold', cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
  };
  const badge = map[outcome] ?? { label: outcome, cls: 'bg-gray-100 text-gray-600 border border-gray-200' };
  return (
    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${badge.cls}`}>
      {badge.label}
    </span>
  );
}

export default function CorporateInquiryPage() {
  const router = useRouter();
  const { canView, canCreate, canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');
  const [inquiries, setInquiries] = useState<CorporateInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [updating, setUpdating] = useState<number | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        search,
      });
      const res = await fetch(`/api/admission-activity/corporate-inquiry?${params}`);
      const data = await res.json();
      setInquiries(data.rows || []);
      setPagination((prev) => ({
        ...prev,
        total: data.pagination?.total ?? 0,
        totalPages: data.pagination?.totalPages ?? 0,
      }));
    } catch (e) {
      console.error('Fetch error:', e);
      setInquiries([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, fetchTrigger]);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setPagination((prev) => ({ ...prev, page: 1 }));
      setFetchTrigger((t) => t + 1);
    }, 400);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [search]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages)
      setPagination((prev) => ({ ...prev, page: newPage }));
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
        `"${String(inq.Course_Id || '').replace(/"/g,'""')}"`,
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
    <div className="space-y-6">

      <PageHeader
        title="Corporate Inquiry"
        breadcrumbs={[{ label: 'Corporate Training' }, { label: 'Corporate Inquiry' }]}
        meta={`${pagination.total.toLocaleString()} records`}
        action={<>
          <GhostBtn onClick={handleExport}>
            <FaFileExport className="w-3 h-3" /> Export
          </GhostBtn>
          {canCreate && (
            <PrimaryBtn onClick={() => router.push('/dashboard/corporate-inquiry/add')}>
              <FaPlus className="w-3 h-3" /> Add Inquiry
            </PrimaryBtn>
          )}
        </>}
      />

      {/* ── Table Card ── */}
      <div className="bg-white rounded-xl border border-[#2E3093]/10 overflow-hidden flex flex-col">

        {/* Search bar */}
        <div className="px-3 py-2 border-b border-zinc-100 bg-zinc-50 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <FaSearch className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, company, email..."
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 bg-white"
            />
          </div>
          <span className="text-xs text-gray-400 ml-auto">
            {inquiries.length} shown
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[#2A6BB5]/60 bg-zinc-50 border-b border-zinc-200">
                <th className="text-left py-2 px-3 font-semibold w-10 font-mono">#</th>
                <th className="text-left py-3 px-4 font-semibold">Date</th>
                <th className="text-left py-3 px-4 font-semibold">Training Programme</th>
                <th className="text-left py-3 px-4 font-semibold">Company</th>
                <th className="text-left py-3 px-4 font-semibold">Contact Person</th>
                <th className="text-left py-3 px-4 font-semibold">Training Info</th>
                <th className="text-left py-3 px-4 font-semibold">Participants</th>
                <th className="text-left py-3 px-4 font-semibold">Requirement</th>
                <th className="text-center py-3 px-4 font-semibold">Status</th>
                <th className="text-center py-3 px-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-7 h-7 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-400">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : inquiries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-300">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <p className="text-sm">No inquiries found</p>
                    </div>
                  </td>
                </tr>
              ) : inquiries.map((inq, idx) => {
                const name = inq.FullName || `${inq.Fname || ''} ${inq.Lname || ''}`.trim();
                return (
                  <tr key={inq.Id} className={`border-b border-gray-100 transition-colors ${rowColor(inq.InquiryStatus, idx)}`}>

                    {/* # */}
                    <td className="py-3 px-4 text-gray-400 text-xs">{inq.Id}</td>

                    {/* Date */}
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap text-xs">
                      {inq.Idate ? String(inq.Idate).slice(0, 10) : '—'}
                    </td>

                    {/* Training Programme */}
                    <td className="py-3 px-4">
                      <p className="font-semibold text-gray-800 text-sm leading-tight">{inq.Course_Id || '—'}</p>
                      {inq.TrainingDates && <p className="text-xs text-gray-400 mt-0.5">{inq.TrainingDates}</p>}
                    </td>

                    {/* Company */}
                    <td className="py-3 px-4">
                      <p className="font-semibold text-gray-800 text-sm leading-tight">{inq.CompanyName || '—'}</p>
                      {inq.Place && <p className="text-xs text-gray-400 mt-0.5">{inq.Place}</p>}
                      {inq.CompanyType && (
                        <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                          {inq.CompanyType}
                        </span>
                      )}
                    </td>

                    {/* Contact Person */}
                    <td className="py-3 px-4 min-w-[180px]">
                      {name && <p className="font-semibold text-gray-800 text-sm leading-tight">{name}</p>}
                      {inq.Designation && <p className="text-xs text-gray-500">{inq.Designation}</p>}
                      {(inq.Mobile || inq.Phone) && (
                        <p className="text-xs text-gray-500 mt-0.5">📞 {inq.Mobile || inq.Phone}</p>
                      )}
                      {inq.Email && <p className="text-xs text-gray-400">{inq.Email}</p>}
                    </td>

                    {/* Training Info */}
                    <td className="py-3 px-4 min-w-[160px]">
                      {inq.TrainingMode && (
                        <p className="text-xs text-gray-600"><span className="font-medium text-gray-700">Mode:</span> {inq.TrainingMode}</p>
                      )}
                      {inq.TrainingLocation && (
                        <p className="text-xs text-gray-600 mt-0.5"><span className="font-medium text-gray-700">Location:</span> {inq.TrainingLocation}</p>
                      )}
                      {inq.CompanyAuthority && (
                        <p className="text-xs text-gray-600 mt-0.5"><span className="font-medium text-gray-700">Authority:</span> {inq.CompanyAuthority}</p>
                      )}
                    </td>

                    {/* Participants */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        {(inq.Participants_Fresher != null) && (
                          <span className="text-xs text-gray-600">
                            <span className="font-medium text-gray-700">F:</span> {inq.Participants_Fresher}
                          </span>
                        )}
                        {(inq.Participants_Experienced != null) && (
                          <span className="text-xs text-gray-600">
                            <span className="font-medium text-gray-700">E:</span> {inq.Participants_Experienced}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Requirement */}
                    <td className="py-3 px-4 min-w-[200px]">
                      {inq.business && (
                        <p className="text-xs text-gray-600"><span className="font-medium text-gray-700">Disciplines:</span> {inq.business}</p>
                      )}
                      {(inq.Discussion || inq.Remark) && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{inq.Discussion || inq.Remark}</p>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <StatusBadge status={inq.InquiryStatus} />
                        <DiscussionOutcomeBadge outcome={inq.DiscussionOutcome} />
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        {canUpdate && (
                          <button
                            onClick={() => router.push(`/dashboard/corporate-inquiry/edit/${inq.Id}`)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#2A6BB5] transition-colors"
                            title="Edit"
                          >
                            <FaEdit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canUpdate && (
                          <button
                            onClick={() => updateStatus(inq.Id, 'Rejected')}
                            disabled={updating === inq.Id || inq.InquiryStatus === 'Rejected'}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Cancel Inquiry"
                          >
                            <FaTimesCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canUpdate && (
                          <button
                            onClick={() => updateStatus(inq.Id, 'Final')}
                            disabled={updating === inq.Id || inq.InquiryStatus === 'Final'}
                            className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Convert to Execution"
                          >
                            <FaCheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canUpdate && (
                          <button
                            onClick={() => router.push(`/dashboard/corporate-inquiry/proposal/${inq.Id}`)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Make Proposal"
                          >
                            <FaFileSignature className="w-3.5 h-3.5" />
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

        {/* Pagination footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <p className="text-xs text-gray-500">
            Showing {inquiries.length ? (pagination.page - 1) * pagination.limit + 1 : 0}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-lg bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition text-gray-600"
            >
              <FaChevronLeft className="w-3 h-3" />
            </button>
            <span className="text-xs text-gray-600 px-2">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded-lg bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition text-gray-600"
            >
              <FaChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
