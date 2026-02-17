'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';

interface BatchCategory {
  id: number;
  batch: string | null;
  batchtype: string | null;
  prefix: string | null;
  description: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/* ---- Reusable styles ---- */
const labelCls = 'block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5';
const inputCls = 'max-w-[220px] w-full border-2 border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-700 placeholder:text-gray-300';
const selectCls = 'max-w-[220px] w-full border-2 border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-700';

/* ---- SectionCard ---- */
function SectionCard({ title, children, className = '', contentClassName = '' }: { title: string; children: React.ReactNode; className?: string; contentClassName?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col ${className}`}>
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-5 py-3 flex-shrink-0">
        <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
      </div>
      <div className={`p-5 flex-1 ${contentClassName}`}>{children}</div>
    </div>
  );
}

export default function BatchCategoryPage() {
  const { canView, canCreate, canUpdate, loading: permLoading } = useResourcePermissions('batch_category');

  /* ---- Form state ---- */
  const [formData, setFormData] = useState({
    batch: '',
    batchtype: '',
    prefix: '',
    description: '',
  });
  const [editId, setEditId] = useState<number | null>(null);
  const [originalBatch, setOriginalBatch] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  /* ---- List state ---- */
  const [rows, setRows] = useState<BatchCategory[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  /* ---- Batch types for dropdown ---- */
  const [batchTypes, setBatchTypes] = useState<string[]>([]);

  const searchRef = useRef<HTMLInputElement>(null);

  /* ---- Fetch batch types ---- */
  useEffect(() => {
    const fetchBatchTypes = async () => {
      try {
        const res = await fetch('/api/masters/batch-category/options');
        const data = await res.json();
        setBatchTypes(data.batchTypes || []);
      } catch {
        /* ignore */
      }
    };
    fetchBatchTypes();
  }, []);

  /* ---- Fetch list ---- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (search) params.set('search', search);

      const res = await fetch(`/api/masters/batch-category?${params.toString()}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fetchTrigger]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ---- Handlers ---- */
  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClear = () => {
    setFormData({ batch: '', batchtype: '', prefix: '', description: '' });
    setEditId(null);
    setOriginalBatch('');
  };

  const handleSubmit = async () => {
    if (!formData.batch.trim()) {
      alert('Batch Category is required');
      return;
    }

    setSubmitting(true);
    try {
      const method = editId ? 'PUT' : 'POST';
      const body = editId 
        ? { originalBatch, batch: formData.batch } 
        : formData;

      const res = await fetch('/api/masters/batch-category', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      handleClear();
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      alert(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (row: BatchCategory) => {
    setFormData({
      batch: row.batch || '',
      batchtype: '',
      prefix: '',
      description: '',
    });
    setEditId(row.id);
    setOriginalBatch(row.batch || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = () => { setPage(1); setFetchTrigger(t => t + 1); };

  const handleClearFilters = () => {
    setSearch('');
    setPage(1);
    setFetchTrigger(t => t + 1);
  };

  const handleExport = () => {
    const headers = ['Id', 'Batch Category'];
    const csvRows = [
      headers.join(','),
      ...rows.map(r => [r.id, `"${(r.batch || '').replace(/"/g, '""')}"`].join(',')),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-categories-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = pagination.totalPages;

  if (permLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <p className="text-sm font-semibold">Access Denied</p>
        <p className="text-xs">You do not have permission to view batch categories.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] rounded-xl shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">Batch Category</h1>
          <p className="text-xs text-gray-400">Manage batch categories</p>
        </div>
      </div>

      {/* Stacked Layout: Form on top, Table below */}
      <div className="space-y-4">
        {/* Left Column - Form Section */}
        {(canCreate || canUpdate) && (
        <SectionCard title="Batch Information">
          <div className="flex flex-wrap items-end gap-3">
          {/* Batch Category */}
          <div>
            <label className={labelCls}>Batch Category <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={formData.batch}
              onChange={e => handleFormChange('batch', e.target.value)}
              placeholder="Batch Category"
              className={inputCls}
            />
          </div>

          {/* Batch Type */}
          <div>
            <label className={labelCls}>Batch Type</label>
            <select
              value={formData.batchtype}
              onChange={e => handleFormChange('batchtype', e.target.value)}
              className={selectCls}
            >
              <option value="">Select Type</option>
              {batchTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Prefix */}
          <div>
            <label className={labelCls}>Prefix</label>
            <input
              type="text"
              value={formData.prefix}
              onChange={e => handleFormChange('prefix', e.target.value)}
              placeholder="Prefix"
              className={inputCls}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={formData.description}
              onChange={e => handleFormChange('description', e.target.value)}
              placeholder="Description"
              className={inputCls}
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 self-end">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 bg-[#2E3093] hover:bg-[#252780] disabled:opacity-60 text-white px-4 py-1.5 rounded text-xs font-semibold transition-all shadow-md whitespace-nowrap"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {editId ? 'Update' : 'Submit'}
                </>
              )}
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
          </div>
        </div>
      </SectionCard>
        )}
        <SectionCard title="View Batch Category" contentClassName="overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center justify-between mb-4">
          <p className="text-sm text-gray-400">{pagination.total.toLocaleString()} total records</p>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search..."
                className="w-56 border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 bg-white shadow-sm"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Filters toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm border ${
                showFilters ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
          </div>
        </div>

        {/* Expandable filters panel */}
        {showFilters && (
          <div className="flex-shrink-0 bg-gray-50 rounded-lg p-4 mb-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-end gap-3">
              <button
                onClick={handleSearch}
                className="flex items-center gap-1.5 bg-[#2A6BB5] hover:bg-[#2360A0] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                Apply
              </button>
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1.5 bg-gray-200 hover:bg-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto rounded-lg border border-gray-100">
          <table className="dashboard-table w-full text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="text-[11px] uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100">
                <th className="text-left py-3 px-4 font-semibold">Id</th>
                <th className="text-left py-3 px-4 font-semibold">Batch Category</th>
                <th className="text-center py-3 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-400">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-300">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-sm">No batch categories found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="py-2.5 px-4 text-gray-400 font-mono text-xs">{r.id}</td>
                    <td className="py-2.5 px-4 font-semibold text-gray-800">{r.batch || '—'}</td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canUpdate && (
                        <button
                          title="Edit"
                          onClick={() => handleEdit(r)}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex-shrink-0 flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${p === page ? 'bg-[#2E3093] text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
        </SectionCard>
      </div>
    </div>
  );
}
