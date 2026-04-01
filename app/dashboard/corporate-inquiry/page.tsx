'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FaPlus, FaFilter, FaFileExport, FaEdit, FaSearch, FaChevronLeft, FaChevronRight, FaTimesCircle, FaCheckCircle } from 'react-icons/fa';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

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
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function CorporateInquiryPage() {
  const router = useRouter();
  const { canView, canCreate, canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');
  const [inquiries, setInquiries] = useState<CorporateInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });
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
        search: search,
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

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  // Debounced search: typing should actually update results.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setPagination((prev) => ({ ...prev, page: 1 }));
      setFetchTrigger((t) => t + 1);
    }, 400);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search]);

  const handleSearch = () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFetchTrigger((t) => t + 1);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleClear = () => {
    setSearch('');
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFetchTrigger((t) => t + 1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  const updateStatus = async (id: number, status: 'Rejected' | 'UnderDiscussion') => {
    const verb = status === 'Rejected' ? 'cancel' : 'move to under discussion';
    if (!confirm(`Are you sure you want to ${verb} this inquiry?`)) return;
    const prevStatus = inquiries.find((r) => r.Id === id)?.InquiryStatus ?? null;
    setUpdating(id);
    // Optimistic UI: immediately reflect status + row color.
    setInquiries((prev) => prev.map((r) => (r.Id === id ? { ...r, InquiryStatus: status } : r)));
    try {
      const res = await fetch('/api/admission-activity/corporate-inquiry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Id: id, InquiryStatus: status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');

      if (status === 'UnderDiscussion') {
        router.push(`/dashboard/corporate-inquiry/execution/${id}`);
        return;
      }

      fetchInquiries();
    } catch (e) {
      // Revert optimistic update on failure.
      setInquiries((prev) => prev.map((r) => (r.Id === id ? { ...r, InquiryStatus: prevStatus } : r)));
      alert('Update failed');
      console.error(e);
    } finally {
      setUpdating(null);
    }
  };

  const handleExport = () => {
    const headers = [
      'Id',
      'Enquiry Date',
      'Training Programme',
      'Company Name',
      'Company Location',
      'Company Type',
      'Company Authority',
      'Coordinator Name',
      'Coordinator Mobile',
      'Coordinator Email',
      'Training Mode',
      'Training Location',
      'Status',
      'Disciplines',
      'Remarks',
    ];
    const csvContent = [
      headers.join(','),
      ...inquiries.map((inq) =>
        [
          inq.Id,
          `"${String(inq.Idate || '').replace(/"/g, '""')}"`,
          `"${String(inq.Course_Id || '').replace(/"/g, '""')}"`,
          `"${String(inq.CompanyName || '').replace(/"/g, '""')}"`,
          `"${String(inq.Place || '').replace(/"/g, '""')}"`,
          `"${String(inq.CompanyType || '').replace(/"/g, '""')}"`,
          `"${String(inq.CompanyAuthority || '').replace(/"/g, '""')}"`,
          `"${String(inq.FullName || `${inq.Fname || ''} ${inq.Lname || ''}`.trim()).replace(/"/g, '""')}"`,
          `"${String(inq.Mobile || inq.Phone || '').replace(/"/g, '""')}"`,
          `"${String(inq.Email || '').replace(/"/g, '""')}"`,
          `"${String(inq.TrainingMode || '').replace(/"/g, '""')}"`,
          `"${String(inq.TrainingLocation || '').replace(/"/g, '""')}"`,
          `"${String(inq.InquiryStatus === 'Rejected' ? 'Cancelled' : (inq.InquiryStatus || '')).replace(/"/g, '""')}"`,
          `"${String(inq.business || '').replace(/"/g, '""')}"`,
          `"${String(inq.Remark || '').replace(/"/g, '""')}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'corporate_inquiries.csv';
    link.click();
  };

  return (
    <div className="space-y-3">
      {permLoading ? <PermissionLoading /> : !canView ? <AccessDenied message="You do not have permission to view corporate inquiries." /> : (<>
      {/* Header Container */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col gap-4">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Corporate Inquiry</h2>
              <p className="text-sm text-gray-400">
                {pagination.total.toLocaleString()} total inquiries
              </p>
            </div>
            {/* Add Button */}
            {canCreate && (
            <button
              onClick={() => router.push('/dashboard/corporate-inquiry/add')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2A6BB5] hover:bg-[#2360A0] text-white font-semibold text-sm shadow-sm transition-colors"
            >
              <FaPlus className="w-4 h-4" /> Add
            </button>
            )}
          </div>

          {/* Controls Row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
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

            {/* Filters toggle */}
            <button
              onClick={() => setShowFilters((p) => !p)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm border ${
                showFilters
                  ? 'bg-[#2E3093] text-white border-[#2E3093]'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <FaFilter className="w-4 h-4" /> Filters
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
            >
              <FaFileExport className="w-4 h-4" /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <div className="text-sm text-gray-500">Additional filters can be added here.</div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dashboard-table w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100">
                <th className="text-left py-3 px-4 font-semibold">Id</th>
                <th className="text-left py-3 px-4 font-semibold">Enquiry Date</th>
                <th className="text-left py-3 px-4 font-semibold">Training Programme</th>
                <th className="text-left py-3 px-4 font-semibold">Company</th>
                <th className="text-left py-3 px-4 font-semibold">Company Location</th>
                <th className="text-left py-3 px-4 font-semibold">Company Type</th>
                <th className="text-left py-3 px-4 font-semibold">Authority</th>
                <th className="text-left py-3 px-4 font-semibold">Coordinator</th>
                <th className="text-left py-3 px-4 font-semibold">Mobile</th>
                <th className="text-left py-3 px-4 font-semibold">Email</th>
                <th className="text-left py-3 px-4 font-semibold">Mode</th>
                <th className="text-left py-3 px-4 font-semibold">Training Location</th>
                <th className="text-left py-3 px-4 font-semibold">Status</th>
                <th className="text-center py-3 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={14} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-400">Loading inquiries...</span>
                    </div>
                  </td>
                </tr>
              ) : inquiries.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-300">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <p className="text-sm">No inquiries found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                inquiries.map((inq, idx) => {
                  const isRejected = inq.InquiryStatus === 'Rejected';
                  const isUnderDiscussion = inq.InquiryStatus === 'UnderDiscussion';
                  const rowBase = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
                  const rowBg = isRejected ? 'bg-red-50' : isUnderDiscussion ? 'bg-blue-50' : rowBase;
                  const rowHover = isRejected
                    ? 'hover:bg-red-100'
                    : isUnderDiscussion
                      ? 'hover:bg-blue-100'
                      : 'hover:bg-gray-50';

                  return (
                    <tr key={inq.Id} className={`${rowHover} transition-colors ${rowBg}`}>
                    <td className="py-3 px-4 text-gray-600">{inq.Id}</td>
                    <td className="py-3 px-4 text-gray-600">{inq.Idate ? String(inq.Idate).slice(0, 10) : '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{inq.Course_Id || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{inq.CompanyName || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{inq.Place || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{inq.CompanyType || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{inq.CompanyAuthority || '-'}</td>
                    <td className="py-3 px-4 font-medium text-gray-800">{inq.FullName || `${inq.Fname || ''} ${inq.Lname || ''}`.trim()}</td>
                    <td className="py-3 px-4 text-gray-600">{inq.Mobile || inq.Phone || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{inq.Email || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{inq.TrainingMode || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{inq.TrainingLocation || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{inq.InquiryStatus === 'Rejected' ? 'Cancelled' : (inq.InquiryStatus || '-')}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canUpdate && (
                        <button
                          onClick={() => router.push(`/dashboard/corporate-inquiry/edit/${inq.Id}`)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#2A6BB5] transition-colors"
                          title="Edit"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                        )}

                        {canUpdate && (
                        <button
                          onClick={() => updateStatus(inq.Id, 'Rejected')}
                          disabled={updating === inq.Id}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="Cancel"
                        >
                          <FaTimesCircle className="w-4 h-4" />
                        </button>
                        )}

                        {canUpdate && (
                        <button
                          onClick={() => updateStatus(inq.Id, 'UnderDiscussion')}
                          disabled={updating === inq.Id}
                          className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
                          title="Convert to Execution"
                        >
                          <FaCheckCircle className="w-4 h-4" />
                        </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-gray-600">
          Showing {inquiries.length ? (pagination.page - 1) * pagination.limit + 1 : 0} -{' '}
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
          <span className="text-sm">
            Page {pagination.page} of {pagination.totalPages || 1}
          </span>
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="p-2 rounded-lg bg-white border border-gray-300 disabled:opacity-50 hover:bg-gray-50 transition"
          >
            <FaChevronRight />
          </button>
        </div>
      </div>
      </>)}
    </div>
  );
}
