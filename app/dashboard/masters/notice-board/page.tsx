'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface Notice {
  id: number;
  title: string | null;
  specification: string | null;
  startdate: string | null;
  enddate: string | null;
  created_date: string | null;
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

function isCurrentlyActive(n: Notice): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (n.startdate && n.startdate > today) return false;
  if (n.enddate && n.enddate < today) return false;
  return true;
}

export default function NoticeBoardMasterPage() {
  const { canView, canCreate, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('notice_board');

  const emptyForm = { title: '', specification: '', startdate: '', enddate: '' };
  const [formData, setFormData] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [rows, setRows] = useState<Notice[]>([]);
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

      const res = await fetch(`/api/masters/notice-board?${params.toString()}`);
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
    setFormData(emptyForm);
    setEditId(null);
    setModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }
    if (!formData.specification.trim()) {
      alert('Specification is required');
      return;
    }

    setSubmitting(true);
    try {
      const method = editId ? 'PUT' : 'POST';
      const body = editId ? { id: editId, ...formData } : formData;

      const res = await fetch('/api/masters/notice-board', {
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

  const handleEdit = (row: Notice) => {
    setEditId(row.id);
    setFormData({
      title: row.title || '',
      specification: row.specification || '',
      startdate: row.startdate ? String(row.startdate).slice(0, 10) : '',
      enddate: row.enddate ? String(row.enddate).slice(0, 10) : '',
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this notice?')) return;
    try {
      const res = await fetch(`/api/masters/notice-board?id=${id}`, { method: 'DELETE' });
      if (res.ok) setFetchTrigger((t) => t + 1);
    } catch {
      /* ignore */
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setPage(1);
      setFetchTrigger((t) => t + 1);
    }
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view the notice board." />;

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
          <span className="text-[#2E3093] font-medium">Notice Board</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Notice Board</h1>
        <p className="text-xs text-gray-500 mt-1">Announcements shown here (within their date range) also appear on the student portal.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <SectionCard title="Notices" contentClassName="flex flex-col min-h-0">
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
            <div className="flex-1" />
            {canCreate && (
              <button
                onClick={() => {
                  setEditId(null);
                  setFormData(emptyForm);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#2E3093] hover:bg-[#252773] text-white text-xs font-semibold shadow-sm ring-1 ring-[#2E3093]/20 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Notice
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
                placeholder="Search notices..."
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
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Title</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Specification</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Start</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">End</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-center text-gray-400">Loading...</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-center text-gray-400">No notices found</td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const active = isCurrentlyActive(row);
                    return (
                      <tr key={row.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-700">{row.id}</td>
                        <td className="px-4 py-2 text-gray-700 font-medium">{row.title || ''}</td>
                        <td className="px-4 py-2 text-gray-600 max-w-[320px] truncate">{row.specification || ''}</td>
                        <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{row.startdate || '—'}</td>
                        <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{row.enddate || '—'}</td>
                        <td className="px-4 py-2">
                          <span
                            className={
                              active
                                ? 'px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-gray-50 text-gray-600 border-gray-200'
                            }
                          >
                            {active ? 'Live on portal' : 'Not shown'}
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
                                onClick={() => handleDelete(row.id)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                              >
                                Delete
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
            onClick={() => { if (!submitting) resetForm(); }}
          />
          <div className="relative w-full max-w-lg bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-5 py-3 flex items-center justify-between">
              <div className="text-sm font-bold text-white tracking-wide">{editId ? 'Edit Notice' : 'Add Notice'}</div>
              <button
                type="button"
                onClick={() => { if (!submitting) resetForm(); }}
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
                <label className={labelCls}>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  className="w-full border-2 border-gray-300 rounded px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-700 placeholder:text-gray-300"
                  placeholder="e.g. Annual Sports Day"
                  required
                  disabled={!(editId ? canUpdate : canCreate) || submitting}
                />
              </div>
              <div>
                <label className={labelCls}>Specification *</label>
                <textarea
                  value={formData.specification}
                  onChange={(e) => setFormData((p) => ({ ...p, specification: e.target.value }))}
                  rows={4}
                  className="w-full border-2 border-gray-300 rounded px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-700 placeholder:text-gray-300 resize-y"
                  placeholder="Details students should see..."
                  required
                  disabled={!(editId ? canUpdate : canCreate) || submitting}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Start Date</label>
                  <input
                    type="date"
                    value={formData.startdate}
                    onChange={(e) => setFormData((p) => ({ ...p, startdate: e.target.value }))}
                    className="w-full border-2 border-gray-300 rounded px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-700"
                    disabled={!(editId ? canUpdate : canCreate) || submitting}
                  />
                </div>
                <div>
                  <label className={labelCls}>End Date</label>
                  <input
                    type="date"
                    value={formData.enddate}
                    onChange={(e) => setFormData((p) => ({ ...p, enddate: e.target.value }))}
                    className="w-full border-2 border-gray-300 rounded px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-700"
                    disabled={!(editId ? canUpdate : canCreate) || submitting}
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-400">Leave dates blank to show the notice indefinitely.</p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { if (!submitting) resetForm(); }}
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
