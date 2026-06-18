'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Download, Filter, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

type InterviewType = 'On Campus' | 'Company';

interface InterviewMasterRow {
  id: number;
  interview_code: string | null;
  interview_date: string | null;
  company_name: string | null;
  role: string | null;
  interview_type: InterviewType | string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const labelCls = 'block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5';
const inputCls =
  'w-full border-2 border-gray-300 rounded px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-700 placeholder:text-gray-300';
const compactInputCls =
  'max-w-[260px] w-full border-2 border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-700 placeholder:text-gray-300';

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-5 py-3 flex items-center gap-2 flex-shrink-0">
        <CalendarDays className="w-4 h-4 text-white" />
        <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
      </div>
      <div className="p-5 flex-1 overflow-auto min-h-0 flex flex-col">{children}</div>
    </div>
  );
}

function TypeBadge({ type }: { type: string | null }) {
  const isCompany = type === 'Company';
  return (
    <span
      className={
        isCompany
          ? 'inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-sky-50 text-sky-700 border-sky-200'
          : 'inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-indigo-50 text-indigo-700 border-indigo-200'
      }
    >
      {isCompany ? 'Company' : 'On Campus'}
    </span>
  );
}

export default function InterviewMasterPage() {
  const { canView, canCreate, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('interview_master');
  const [formData, setFormData] = useState({
    interviewDate: '',
    companyName: '',
    role: '',
    interviewType: 'On Campus' as InterviewType,
  });
  const [editId, setEditId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<InterviewMasterRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);

      const res = await fetch(`/api/masters/interview-master?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fetchTrigger]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({ interviewDate: '', companyName: '', role: '', interviewType: 'On Campus' });
    setEditId(null);
    setModalOpen(false);
  };

  const refreshFirstPage = () => {
    setPage(1);
    setFetchTrigger((t) => t + 1);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.interviewDate) {
      alert('Date is required');
      return;
    }
    if (!formData.companyName.trim()) {
      alert('Company name is required');
      return;
    }
    if (!formData.role.trim()) {
      alert('Role is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/masters/interview-master', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editId,
          interviewDate: formData.interviewDate,
          companyName: formData.companyName.trim(),
          role: formData.role.trim(),
          interviewType: formData.interviewType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      resetForm();
      refreshFirstPage();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (row: InterviewMasterRow) => {
    setEditId(row.id);
    setFormData({
      interviewDate: row.interview_date ? String(row.interview_date).slice(0, 10) : '',
      companyName: row.company_name || '',
      role: row.role || '',
      interviewType: row.interview_type === 'Company' ? 'Company' : 'On Campus',
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this interview plan?')) return;
    const previousRows = rows;
    setRows((current) => current.filter((row) => row.id !== id));
    try {
      const res = await fetch(`/api/masters/interview-master?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setFetchTrigger((t) => t + 1);
    } catch {
      setRows(previousRows);
      alert('Failed to delete interview plan');
    }
  };

  const handleExport = () => {
    const headers = ['Id', 'Code', 'Date', 'Company Name', 'Role', 'Type'];
    const csvRows = rows.map((row) => [
      row.id,
      row.interview_code || '',
      row.interview_date || '',
      row.company_name || '',
      row.role || '',
      row.interview_type || 'On Campus',
    ]);
    const csv = [headers, ...csvRows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'interview_master.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view interview master." />;

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6 flex flex-col">
      <div className="mb-6 flex-shrink-0">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <span>Dashboard</span>
          <span>/</span>
          <span>Masters</span>
          <span>/</span>
          <span className="text-[#2E3093] font-medium">Interview Master</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Interview Master</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <SectionCard title="Campus Interviews Planned">
          <div className="flex flex-wrap items-center gap-2 mb-4 flex-shrink-0">
            <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">{pagination.total}</span>
            <button
              onClick={() => {
                setShowFilters((value) => !value);
                if (!showFilters) setTimeout(() => searchRef.current?.focus(), 50);
              }}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                showFilters ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <div className="flex-1" />
            {canCreate && (
              <button
                onClick={() => {
                  setEditId(null);
                  setFormData({ interviewDate: '', companyName: '', role: '', interviewType: 'On Campus' });
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#2E3093] hover:bg-[#252773] text-white text-xs font-semibold shadow-sm ring-1 ring-[#2E3093]/20 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/30 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Interview
              </button>
            )}
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && refreshFirstPage()}
                  placeholder="Search code, company, role, date..."
                  className={`${compactInputCls} pl-7`}
                />
              </div>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={compactInputCls}>
                <option value="">All types</option>
                <option value="On Campus">On Campus</option>
                <option value="Company">Company</option>
              </select>
              <button onClick={refreshFirstPage} className="px-4 py-2 bg-[#2E3093] text-white text-xs font-semibold rounded-lg hover:bg-[#252773]">
                Search
              </button>
              <button
                onClick={() => {
                  setSearch('');
                  setTypeFilter('');
                  refreshFirstPage();
                }}
                className="px-4 py-2 border border-gray-300 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
          )}

          <div className="flex-1 overflow-auto min-h-0 rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 w-20">Id</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 w-32">Code</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 w-36">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Company Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Role</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 w-36">Campus / Company</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-center text-gray-400">Loading...</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-center text-gray-400">No interview plans found</td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{row.id}</td>
                      <td className="px-4 py-2 text-[#2E3093] font-black whitespace-nowrap">{row.interview_code || '-'}</td>
                      <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{row.interview_date || ''}</td>
                      <td className="px-4 py-2 text-gray-700 font-medium">{row.company_name || ''}</td>
                      <td className="px-4 py-2 text-gray-700">{row.role || ''}</td>
                      <td className="px-4 py-2"><TypeBadge type={row.interview_type} /></td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          {canUpdate && (
                            <button
                              onClick={() => handleEdit(row)}
                              className="p-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                              aria-label="Edit interview plan"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(row.id)}
                              className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                              aria-label="Delete interview plan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

          <div className="flex items-center justify-between mt-4 flex-shrink-0">
            <div className="text-xs text-gray-500">Page {pagination.page} of {pagination.totalPages || 1}</div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((value) => (pagination.totalPages ? Math.min(pagination.totalPages, value + 1) : value + 1))}
                disabled={pagination.totalPages ? page >= pagination.totalPages : rows.length < pagination.limit}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </SectionCard>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button className="absolute inset-0 bg-black/30" onClick={() => !submitting && resetForm()} aria-label="Close modal" />
          <div className="relative w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-5 py-3 flex items-center justify-between">
              <div className="text-sm font-bold text-white tracking-wide">{editId ? 'Edit Interview' : 'Add Interview'}</div>
              <button
                type="button"
                onClick={() => !submitting && resetForm()}
                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className={labelCls}>Date *</label>
                <input
                  type="date"
                  value={formData.interviewDate}
                  onChange={(event) => setFormData((current) => ({ ...current, interviewDate: event.target.value }))}
                  className={inputCls}
                  required
                  disabled={!(editId ? canUpdate : canCreate) || submitting}
                />
              </div>
              <div>
                <label className={labelCls}>Company Name *</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(event) => setFormData((current) => ({ ...current, companyName: event.target.value }))}
                  className={inputCls}
                  placeholder="Enter company name"
                  required
                  disabled={!(editId ? canUpdate : canCreate) || submitting}
                />
              </div>
              <div>
                <label className={labelCls}>Role *</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(event) => setFormData((current) => ({ ...current, role: event.target.value }))}
                  className={inputCls}
                  placeholder="Enter role"
                  required
                  disabled={!(editId ? canUpdate : canCreate) || submitting}
                />
              </div>
              <div>
                <label className={labelCls}>Interview Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['On Campus', 'Company'] as InterviewType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData((current) => ({ ...current, interviewType: type }))}
                      disabled={!(editId ? canUpdate : canCreate) || submitting}
                      className={
                        formData.interviewType === type
                          ? 'px-3 py-2 rounded-lg bg-[#2E3093] text-white text-xs font-semibold border border-[#2E3093]'
                          : 'px-3 py-2 rounded-lg bg-white text-gray-600 text-xs font-semibold border border-gray-300 hover:bg-gray-50'
                      }
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => !submitting && resetForm()}
                  className="px-4 py-2 border border-gray-300 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                {(editId ? canUpdate : canCreate) && (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-[#2E3093] hover:bg-[#252773] text-white text-xs font-semibold rounded-lg shadow-sm ring-1 ring-[#2E3093]/20 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/30 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : editId ? 'Update' : 'Save'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}