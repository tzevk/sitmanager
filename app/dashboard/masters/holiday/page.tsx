'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface Holiday {
  Id: number;
  Holiday: string | null;
  Date_of_Holiday: string | null; // YYYY-MM-DD
  IsActive: number | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const labelCls = 'block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5';
const inputCls =
  'max-w-[260px] w-full border-2 border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-700 placeholder:text-gray-300';

function SectionCard({
  title,
  children,
  className = '',
  contentClassName = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0 ${className}`}>
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-5 py-3 flex-shrink-0">
        <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
      </div>
      <div className={`p-5 flex-1 overflow-auto min-h-0 ${contentClassName}`}>{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  onLabel = 'Active',
  offLabel = 'Not Active',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 select-none">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span
        className="relative w-10 h-5 rounded-full bg-gray-200 border border-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#2E3093]/30 peer-checked:bg-[#2E3093] peer-checked:border-[#2E3093] peer-disabled:opacity-60 peer-disabled:cursor-not-allowed transition-colors"
        aria-hidden="true"
      >
        <span className="absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white border border-gray-300 shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
      <span
        className={
          checked
            ? 'px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-gray-50 text-gray-600 border-gray-200'
        }
      >
        {checked ? onLabel : offLabel}
      </span>
    </label>
  );
}

export default function HolidayMasterPage() {
  const { canView, canCreate, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('holiday');

  const [formData, setFormData] = useState({
    holiday: '',
    dateOfHoliday: '',
    isActive: true,
  });
  const [editId, setEditId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [rows, setRows] = useState<Holiday[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (search) params.set('search', search);

      const res = await fetch(`/api/masters/holiday?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fetchTrigger]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({ holiday: '', dateOfHoliday: '', isActive: true });
    setEditId(null);
    setModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.holiday.trim()) {
      alert('Holiday name is required');
      return;
    }
    if (!formData.dateOfHoliday) {
      alert('Date is required');
      return;
    }

    setSubmitting(true);
    try {
      const method = editId ? 'PUT' : 'POST';
      const body = editId
        ? {
            id: editId,
            holiday: formData.holiday.trim(),
            dateOfHoliday: formData.dateOfHoliday,
            isActive: formData.isActive,
          }
        : {
            holiday: formData.holiday.trim(),
            dateOfHoliday: formData.dateOfHoliday,
            isActive: formData.isActive,
          };

      const res = await fetch('/api/masters/holiday', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save');

      resetForm();
      setPage(1);
      setFetchTrigger((t) => t + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (row: Holiday) => {
    setEditId(row.Id);
    setFormData({
      holiday: row.Holiday || '',
      dateOfHoliday: row.Date_of_Holiday ? String(row.Date_of_Holiday).slice(0, 10) : '',
      isActive: Number(row.IsActive ?? 1) ? true : false,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return;
    try {
      const res = await fetch(`/api/masters/holiday?id=${id}`, { method: 'DELETE' });
      if (res.ok) setFetchTrigger((t) => t + 1);
    } catch {
      /* ignore */
    }
  };

  const handleExport = () => {
    const headers = ['Id', 'Holiday', 'Date_of_Holiday', 'IsActive'];
    const csvRows = rows.map((r) => [r.Id, r.Holiday || '', (r.Date_of_Holiday || '').slice(0, 10), Number(r.IsActive ?? 1) ? 'Yes' : 'No']);
    const csv = [headers.join(','), ...csvRows.map((r) => r.map((v) => String(v).replace(/"/g, '""')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'holiday_list.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setPage(1);
      setFetchTrigger((t) => t + 1);
    }
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view holidays." />;

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6 flex flex-col">
      {/* Header */}
      <div className="mb-6 flex-shrink-0">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <span>Dashboard</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span>Masters</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-[#2E3093] font-medium">Holiday</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Holiday Master</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <SectionCard title="Holiday Master" contentClassName="flex flex-col min-h-0">
          <div className="flex flex-wrap items-center gap-2 mb-4 flex-shrink-0">
            <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">{pagination.total}</span>
            <button
              onClick={() => {
                setShowFilters((s) => !s);
                if (!showFilters) setTimeout(() => searchRef.current?.focus(), 50);
              }}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                showFilters ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              Filters
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Export
            </button>
            <div className="flex-1" />
            {canCreate && (
              <button
                onClick={() => {
                  setEditId(null);
                  setFormData({ holiday: '', dateOfHoliday: '', isActive: true });
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#2E3093] hover:bg-[#252773] text-white text-xs font-semibold shadow-sm ring-1 ring-[#2E3093]/20 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Holiday
              </button>
            )}
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search holiday..."
                className={inputCls}
              />
              <button
                onClick={() => {
                  setPage(1);
                  setFetchTrigger((t) => t + 1);
                }}
                className="px-4 py-2 bg-[#2E3093] text-white text-xs font-semibold rounded-lg hover:bg-[#252773]"
              >
                Search
              </button>
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                  setFetchTrigger((t) => t + 1);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
          )}

          <div className="flex-1 overflow-auto min-h-0 rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Id</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Holiday</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Active</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-gray-400">
                      No holidays found
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.Id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{row.Id}</td>
                      <td className="px-4 py-2 text-gray-700">{row.Holiday || ''}</td>
                      <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{row.Date_of_Holiday || ''}</td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            Number(row.IsActive ?? 1)
                              ? 'px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-gray-50 text-gray-600 border-gray-200'
                          }
                        >
                          {Number(row.IsActive ?? 1) ? 'Active' : 'Not Active'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          {canUpdate && (
                            <button
                              onClick={() => handleEdit(row)}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(row.Id)}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                            >
                              Delete
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
            <div className="text-xs text-gray-500">
              Page {pagination.page} of {pagination.totalPages || 1}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => (pagination.totalPages ? Math.min(pagination.totalPages, p + 1) : p + 1))}
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
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              if (!submitting) resetForm();
            }}
          />
          <div className="relative w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-5 py-3 flex items-center justify-between">
              <div className="text-sm font-bold text-white tracking-wide">{editId ? 'Edit Holiday' : 'Add Holiday'}</div>
              <button
                type="button"
                onClick={() => {
                  if (!submitting) resetForm();
                }}
                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className={labelCls}>Holiday *</label>
                <input
                  type="text"
                  value={formData.holiday}
                  onChange={(e) => setFormData((p) => ({ ...p, holiday: e.target.value }))}
                  className="w-full border-2 border-gray-300 rounded px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-700 placeholder:text-gray-300"
                  placeholder="Enter holiday name"
                  required
                  disabled={!(editId ? canUpdate : canCreate) || submitting}
                />
              </div>
              <div>
                <label className={labelCls}>Date *</label>
                <input
                  type="date"
                  value={formData.dateOfHoliday}
                  onChange={(e) => setFormData((p) => ({ ...p, dateOfHoliday: e.target.value }))}
                  className="w-full border-2 border-gray-300 rounded px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-700"
                  required
                  disabled={!(editId ? canUpdate : canCreate) || submitting}
                />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <Toggle
                  checked={formData.isActive}
                  onChange={(checked) => setFormData((p) => ({ ...p, isActive: checked }))}
                  disabled={!(editId ? canUpdate : canCreate) || submitting}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!submitting) resetForm();
                  }}
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
                    {submitting ? 'Saving…' : editId ? 'Update' : 'Save'}
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
